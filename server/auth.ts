import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as oidc from 'openid-client';
import { normalizeName } from '../src/network/protocol.ts';
import { parseSlackIdentity } from '../src/slack/dm.ts';
import type { AuthUser } from '../src/slack/auth.ts';

const SESSION_COOKIE = 'waiwai_session';
const FLOW_COOKIE = 'waiwai_login';
const FLOW_MS = 10 * 60_000;
const SESSION_MS = 8 * 60 * 60_000;
const random = () => randomBytes(32).toString('base64url');
export type AuthConfig = { clientId: string; clientSecret: string; redirectUri: string; required?: boolean; teamId?: string };
type Session = { user: AuthUser; expires: number };
type Flow = { state: string; nonce: string; verifier: string; expires: number };

export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | undefined {
  if (env.REQUIRE_SLACK_LOGIN && !['true', 'false'].includes(env.REQUIRE_SLACK_LOGIN)) throw new Error('REQUIRE_SLACK_LOGIN must be true or false.');
  if (env.SLACK_TEAM_ID && !/^T[A-Z0-9]{8,39}$/.test(env.SLACK_TEAM_ID)) throw new Error('Invalid SLACK_TEAM_ID.');
  const values = [env.SLACK_CLIENT_ID, env.SLACK_CLIENT_SECRET, env.SLACK_REDIRECT_URI];
  if (values.every((value) => !value) && env.REQUIRE_SLACK_LOGIN !== 'true' && !env.SLACK_TEAM_ID) return;
  if (values.some((value) => !value?.trim())) throw new Error('Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI together.');
  const url = new URL(values[2]!);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/auth/slack/callback') {
    throw new Error('SLACK_REDIRECT_URI must be https://<your-host>/auth/slack/callback');
  }
  return { clientId: values[0]!.trim(), clientSecret: values[1]!.trim(), redirectUri: url.href,
    ...(env.REQUIRE_SLACK_LOGIN === 'true' || env.SLACK_TEAM_ID ? { required: true } : {}),
    ...(env.SLACK_TEAM_ID ? { teamId: env.SLACK_TEAM_ID } : {}) };
}

export function slackConfiguration(config: AuthConfig): oidc.Configuration {
  // Fixed provider endpoints: credentials cannot be sent to a browser-supplied URL.
  const client = new oidc.Configuration({
    issuer: 'https://slack.com', authorization_endpoint: 'https://slack.com/openid/connect/authorize',
    token_endpoint: 'https://slack.com/api/openid.connect.token', jwks_uri: 'https://slack.com/openid/connect/keys',
    id_token_signing_alg_values_supported: ['RS256'], response_types_supported: ['code'],
  }, config.clientId, { id_token_signed_response_alg: 'RS256' }, oidc.ClientSecretPost(config.clientSecret));
  oidc.enableNonRepudiationChecks(client);
  client.timeout = 10;
  return client;
}

function cookie(request: IncomingMessage, name: string): string | undefined {
  const values = request.headers.cookie?.split(';').map((part) => part.trim()).filter((part) => part.startsWith(name + '='));
  if (values?.length !== 1) return;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
function setCookie(name: string, value: string, seconds: number, flow = false): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=${flow ? 'None' : 'Lax'}; Max-Age=${seconds}`;
}
function redirect(response: ServerResponse, target: string, cookies?: string[]) {
  if (cookies) response.setHeader('Set-Cookie', cookies);
  response.writeHead(303, { Location: target }).end();
}
async function readForm(request: IncomingMessage): Promise<string> {
  let body = '';
  for await (const chunk of request) {
    body += chunk.toString();
    if (Buffer.byteLength(body) > 8192) throw new Error('Callback too large');
  }
  return body;
}

export class SlackAuth {
  private sessions = new Map<string, Session>();
  private flows = new Map<string, Flow>();
  private revoked = new Set<(id: string) => void>();
  private client?: oidc.Configuration;
  private origin?: string;
  private timer: ReturnType<typeof setInterval>;
  private now: () => number;
  private config?: AuthConfig;
  constructor(config?: AuthConfig, options: { client?: oidc.Configuration; now?: () => number } = {}) {
    this.config = config;
    this.client = options.client ?? (config ? slackConfiguration(config) : undefined);
    this.origin = config ? new URL(config.redirectUri).origin : undefined;
    this.now = options.now ?? Date.now;
    this.timer = setInterval(() => this.sweep(), 15_000);
    this.timer.unref();
  }

  private revoke(id: string) {
    if (this.sessions.delete(id)) for (const notify of this.revoked) notify(id);
  }
  private sweep() {
    for (const [id, flow] of this.flows) if (flow.expires <= this.now()) this.flows.delete(id);
    for (const [id, session] of this.sessions) if (session.expires <= this.now()) this.revoke(id);
  }
  onRevoke(notify: (id: string) => void): () => void { this.revoked.add(notify); return () => { this.revoked.delete(notify); }; }
  canJoin(request: IncomingMessage): boolean {
    const identity = this.identify(request);
    return !this.config?.required || (!!identity && (!this.config.teamId || identity.user.slack.teamId === this.config.teamId));
  }
  identify(request: IncomingMessage): { id: string; user: AuthUser } | undefined {
    const id = cookie(request, SESSION_COOKIE);
    const session = id ? this.sessions.get(id) : undefined;
    if (!id || !session) return;
    if (session.expires <= this.now()) { this.revoke(id); return; }
    return { id, user: session.user };
  }
  private canonicalHost(request: IncomingMessage): boolean { return request.headers.host === new URL(this.origin!).host; }

  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!['/api/auth/session', '/auth/slack', '/auth/slack/callback', '/auth/logout'].includes(url.pathname)) return false;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname === '/api/auth/session') {
      if (request.method !== 'GET') { response.writeHead(405).end(); return true; }
      const session = this.config && this.canonicalHost(request) ? this.identify(request) : undefined;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ configured: !!this.config, loginUrl: this.origin ? this.origin + '/auth/slack' : null, user: session?.user ?? null,
        ...(this.config?.required ? { required: true } : {}) }));
      return true;
    }
    if (!this.config || !this.client) { response.writeHead(503).end('Slack login is not configured.'); return true; }
    if (!this.canonicalHost(request)) {
      if (url.pathname === '/auth/slack' && request.method === 'GET') redirect(response, this.origin + '/auth/slack');
      else response.writeHead(400).end('Unexpected host');
      return true;
    }
    if (url.pathname === '/auth/logout') {
      if (request.method !== 'POST') { response.writeHead(405).end(); return true; }
      if (request.headers.origin !== this.origin) { response.writeHead(403).end(); return true; }
      const id = cookie(request, SESSION_COOKIE);
      if (id) this.revoke(id);
      response.setHeader('Set-Cookie', setCookie(SESSION_COOKIE, '', 0));
      response.writeHead(204).end();
      return true;
    }
    if (url.pathname === '/auth/slack') {
      if (request.method !== 'GET') { response.writeHead(405).end(); return true; }
      this.sweep();
      if (this.flows.size >= 1000 || this.sessions.size >= 1000) { response.writeHead(503).end('Please try again later.'); return true; }
      const previous = cookie(request, FLOW_COOKIE);
      if (previous) this.flows.delete(previous);
      const id = random();
      const flow: Flow = { state: oidc.randomState(), nonce: oidc.randomNonce(), verifier: oidc.randomPKCECodeVerifier(), expires: this.now() + FLOW_MS };
      const target = oidc.buildAuthorizationUrl(this.client, {
        redirect_uri: this.config.redirectUri, response_type: 'code', response_mode: 'form_post', scope: 'openid profile',
        state: flow.state, nonce: flow.nonce, code_challenge: await oidc.calculatePKCECodeChallenge(flow.verifier), code_challenge_method: 'S256',
      });
      this.flows.set(id, flow);
      redirect(response, target.href, [setCookie(FLOW_COOKIE, id, FLOW_MS / 1000, true)]);
      return true;
    }
    if (request.method !== 'POST' && request.method !== 'GET') { response.writeHead(405).end(); return true; }
    const id = cookie(request, FLOW_COOKIE);
    const flow = id ? this.flows.get(id) : undefined;
    if (id) this.flows.delete(id); // A callback can be used only once, including failures.
    const expiredFlow = setCookie(FLOW_COOKIE, '', 0, true);
    if (!flow || flow.expires <= this.now()) { redirect(response, '/?login=expired', [expiredFlow]); return true; }
    try {
      let callback: URL | Request;
      if (request.method === 'POST') {
        if (!request.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) throw new Error('Unexpected callback type');
        callback = new Request(this.config.redirectUri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: await readForm(request) });
      } else callback = new URL(this.config.redirectUri + url.search);
      const tokens = await oidc.authorizationCodeGrant(this.client, callback, {
        expectedState: flow.state, expectedNonce: flow.nonce, pkceCodeVerifier: flow.verifier, idTokenExpected: true,
      });
      const claims = tokens.claims()!;
      const slack = parseSlackIdentity({ teamId: claims['https://slack.com/team_id'], userId: claims['https://slack.com/user_id'] });
      if (!slack || typeof claims.name !== 'string' || !claims.name.trim() || claims.sub !== slack.userId) throw new Error('Missing Slack identity');
      if (this.config.teamId && slack.teamId !== this.config.teamId) throw new Error('Workspace not allowed');
      if (this.sessions.size >= 1000) throw new Error('Session capacity');
      const user = { name: normalizeName(claims.name), slack };
      const previous = cookie(request, SESSION_COOKIE);
      if (previous) this.revoke(previous);
      const sessionId = random();
      this.sessions.set(sessionId, { user, expires: this.now() + SESSION_MS });
      // Tokens are intentionally discarded: DM links do not need Slack API access.
      redirect(response, '/', [expiredFlow, setCookie(SESSION_COOKIE, sessionId, SESSION_MS / 1000)]);
    } catch {
      // Provider responses may contain credentials or personal data. Never echo or log them.
      redirect(response, '/?login=failed', [expiredFlow]);
    }
    return true;
  }
  close(): void { clearInterval(this.timer); for (const id of this.sessions.keys()) this.revoke(id); this.flows.clear(); }
}
