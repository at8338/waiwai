import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { persistentIdentity } from '../src/game/identity.ts';
import { normalizeName } from '../src/network/protocol.ts';
import type { AuthUser } from '../src/slack/auth.ts';

const SESSION_MS = 8 * 60 * 60_000, FLOW_MS = 10 * 60_000, CHECK_MS = 60_000;
const random = () => randomBytes(32).toString('base64url');
const UID = /^[A-Za-z0-9_-]{1,128}$/;
export type IdentityPlatformConfig = { projectId: string; apiKey: string; origin: string; accountLinks: Record<string, string> };
export type IdentityVerifier = {
  verifyIdToken(token: string, checkRevoked: boolean): Promise<DecodedIdToken>;
  getUser(uid: string): Promise<UserRecord>;
};
export function readIdentityPlatformConfig(env: Record<string, string | undefined>): IdentityPlatformConfig | undefined {
  if (env.REQUIRE_IDENTITY_PLATFORM_LOGIN && !['true', 'false'].includes(env.REQUIRE_IDENTITY_PLATFORM_LOGIN)) throw new Error('Invalid REQUIRE_IDENTITY_PLATFORM_LOGIN');
  const fields = [env.GCIP_PROJECT_ID, env.GCIP_API_KEY, env.GCIP_ORIGIN];
  if (fields.every(v => !v) && env.REQUIRE_IDENTITY_PLATFORM_LOGIN !== 'true' && !env.GCIP_ACCOUNT_LINKS_FILE) return;
  if (fields.some(v => !v?.trim()) || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(fields[0]!) || !/^[A-Za-z0-9_-]{20,200}$/.test(fields[1]!)) throw new Error('Configure GCIP_PROJECT_ID, GCIP_API_KEY and GCIP_ORIGIN together');
  if (env.REQUIRE_IDENTITY_PLATFORM_LOGIN !== 'true') throw new Error('Identity Platform requires REQUIRE_IDENTITY_PLATFORM_LOGIN=true');
  if (env.REQUIRE_ENTRA_LOGIN === 'true' || env.REQUIRE_SLACK_LOGIN === 'true') throw new Error('Choose one required login provider');
  if (env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Authentication emulator is not permitted in Identity Platform mode');
  const url = new URL(fields[2]!);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('GCIP_ORIGIN must be an HTTPS origin');
  let links: unknown = {};
  if (env.GCIP_ACCOUNT_LINKS_FILE) links = JSON.parse(readFileSync(env.GCIP_ACCOUNT_LINKS_FILE, 'utf8'));
  if (!links || typeof links !== 'object' || Array.isArray(links)) throw new Error('Invalid account links');
  const entries = Object.entries(links);
  if (entries.length > 1000 || entries.some(([uid, account]) => !UID.test(uid) || !persistentIdentity(account) || !/^(slack|entra):/.test(account)) || new Set(entries.map(([, id]) => id)).size !== entries.length) throw new Error('Account links must map unique UIDs to unique legacy Slack/Entra IDs');
  return { projectId: fields[0]!, apiKey: fields[1]!, origin: url.origin, accountLinks: Object.fromEntries(entries) };
}
export function identityVerifier(config: IdentityPlatformConfig): IdentityVerifier {
  const name = `waiwai-identity-${config.projectId}`;
  const app = getApps().find(a => a.name === name) ?? initializeApp({ projectId: config.projectId, credential: applicationDefault() }, name);
  return getAuth(app);
}
function readCookie(request: IncomingMessage, name: string): string | undefined {
  const values = request.headers.cookie?.split(';').map(s => s.trim()).filter(s => s.startsWith(name + '='));
  if (values?.length !== 1) return;
  const value = values[0].slice(name.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
}
const cookie = (name: string, value: string, seconds: number) => `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
type Session = { user: AuthUser; uid: string; factorUid: string; authTime: number; expires: number; checked: number };
export class IdentityPlatformAuth {
  private sessions = new Map<string, Session>();
  private flows = new Map<string, number>();
  private revoked = new Set<(id: string) => void>();
  private verifier: IdentityVerifier;
  private timer: ReturnType<typeof setInterval>;
  private now: () => number;
  private checking = false;
  private inflight = 0;
  readonly config: IdentityPlatformConfig;
  constructor(config: IdentityPlatformConfig, options: { verifier?: IdentityVerifier; now?: () => number } = {}) {
    this.config = config;
    this.verifier = options.verifier ?? identityVerifier(config); this.now = options.now ?? Date.now;
    this.timer = setInterval(() => { void this.revalidate(); }, 30_000); this.timer.unref();
  }
  private host(request: IncomingMessage): boolean { return request.headers.host === new URL(this.config.origin).host; }
  private account(uid: string): string { return Object.hasOwn(this.config.accountLinks, uid) ? this.config.accountLinks[uid] : `gcip:${this.config.projectId}:${uid}`; }
  private allowed(record: UserRecord): boolean {
    return UID.test(record.uid) && !record.disabled && record.emailVerified && !!record.email && record.customClaims?.waiwaiInvited === true;
  }
  private revoke(id: string): void { if (this.sessions.delete(id)) for (const fn of this.revoked) fn(id); }
  onRevoke(fn: (id: string) => void): () => void { this.revoked.add(fn); return () => { this.revoked.delete(fn); }; }
  identify(request: IncomingMessage): { id: string; user: AuthUser } | undefined {
    if (!this.host(request)) return;
    const id = readCookie(request, 'waiwai_session'), s = id ? this.sessions.get(id) : undefined;
    if (!id || !s) return;
    if (s.expires <= this.now() || s.checked + CHECK_MS <= this.now()) { this.revoke(id); return; }
    return { id, user: s.user };
  }
  canJoin(request: IncomingMessage): boolean { return !!this.identify(request); }
  async revalidate(): Promise<void> {
    if (this.checking) return;
    this.checking = true;
    try {
      const now = this.now();
      for (const [id, expires] of this.flows) if (expires <= now) this.flows.delete(id);
      // One lookup per account, even when the member has several open tabs.
      const users = new Map<string, Promise<UserRecord>>();
      await Promise.all([...this.sessions].map(async ([id, s]) => {
        if (s.expires <= now) { this.revoke(id); return; }
        try {
          let lookup = users.get(s.uid); if (!lookup) { lookup = this.verifier.getUser(s.uid); users.set(s.uid, lookup); }
          const record = await lookup;
          if (record.uid !== s.uid || !this.allowed(record) || Math.floor(Date.parse(record.tokensValidAfterTime ?? '') / 1000) > s.authTime || !record.multiFactor?.enrolledFactors.some(f => f.factorId === 'totp' && f.uid === s.factorUid)) { this.revoke(id); return; }
          s.checked = this.now();
        } catch { this.revoke(id); }
      }));
    } finally { this.checking = false; }
  }
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const path = request.url?.split('?')[0];
    if (!['/api/auth/identity/config', '/api/auth/identity/session', '/auth/logout'].includes(path ?? '')) return false;
    const reply = (status: number, data: unknown) => response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }).end(JSON.stringify(data));
    if (!this.host(request)) { reply(400, { error: '送信先を確認できません。' }); return true; }
    if (path === '/api/auth/identity/config') {
      if (request.method !== 'GET') { reply(405, {}); return true; }
      if (this.flows.size >= 1000) { reply(429, { error: '少し待ってからお試しください。' }); return true; }
      const previous = readCookie(request, 'waiwai_identity_flow'); if (previous) this.flows.delete(previous);
      const csrf = random(); this.flows.set(csrf, this.now() + FLOW_MS);
      response.setHeader('Set-Cookie', cookie('waiwai_identity_flow', csrf, FLOW_MS / 1000));
      reply(200, { projectId: this.config.projectId, apiKey: this.config.apiKey, csrf }); return true;
    }
    if (request.method !== 'POST') { reply(405, {}); return true; }
    if (request.headers.origin !== this.config.origin) { reply(403, {}); return true; }
    if (path === '/auth/logout') {
      const id = readCookie(request, 'waiwai_session'); if (id) this.revoke(id);
      response.setHeader('Set-Cookie', cookie('waiwai_session', '', 0)); reply(200, {}); return true;
    }
    const flow = readCookie(request, 'waiwai_identity_flow'), expires = flow ? this.flows.get(flow) : undefined;
    if (!flow || !expires || expires <= this.now() || request.headers['x-waiwai-csrf'] !== flow || !request.headers['content-type']?.startsWith('application/json')) { reply(403, {}); return true; }
    this.flows.delete(flow);
    response.setHeader('Set-Cookie', cookie('waiwai_identity_flow', '', 0));
    if (this.inflight >= 20 || this.sessions.size >= 1000) { reply(429, {}); return true; }
    this.inflight++;
    try {
      let body = '';
      for await (const chunk of request) { body += chunk.toString(); if (Buffer.byteLength(body) > 16_384) throw new Error('Too large'); }
      const { idToken } = JSON.parse(body);
      if (typeof idToken !== 'string' || idToken.length > 15_000) throw new Error('Invalid token');
      // Official SDK validates issuer, audience, signature, expiration and revocation.
      const claims = await this.verifier.verifyIdToken(idToken, true);
      const now = Math.floor(this.now() / 1000);
      if (!UID.test(claims.uid) || claims.aud !== this.config.projectId || claims.iss !== `https://securetoken.google.com/${this.config.projectId}` || claims.sub !== claims.uid || claims.email_verified !== true || claims.waiwaiInvited !== true || claims.firebase?.sign_in_provider !== 'password' || claims.firebase?.sign_in_second_factor !== 'totp' || claims.firebase?.tenant || !Number.isSafeInteger(claims.auth_time) || claims.auth_time > now || now - claims.auth_time > 300) throw new Error('Login policy');
      const record = await this.verifier.getUser(claims.uid);
      const factorUid = claims.firebase.second_factor_identifier;
      if (typeof factorUid !== 'string' || record.uid !== claims.uid || !this.allowed(record) || record.email !== claims.email || Math.floor(Date.parse(record.tokensValidAfterTime ?? '') / 1000) > claims.auth_time || !record.multiFactor?.enrolledFactors.some(f => f.factorId === 'totp' && f.uid === factorUid)) throw new Error('Member unavailable');
      if (this.sessions.size >= 1000) throw new Error('Capacity');
      const previous = readCookie(request, 'waiwai_session'); if (previous) this.revoke(previous);
      const id = random();
      this.sessions.set(id, { uid: record.uid, factorUid, authTime: claims.auth_time, checked: this.now(), expires: this.now() + SESSION_MS,
        user: { name: normalizeName(record.displayName ?? 'メンバー'), accountId: this.account(record.uid), email: record.email, emailVerified: true, provider: 'gcip' } });
      // Neither ID/refresh tokens nor passwords are stored in the Waiwai session.
      response.setHeader('Set-Cookie', [cookie('waiwai_identity_flow', '', 0), cookie('waiwai_session', id, SESSION_MS / 1000)]);
      reply(200, { ok: true });
    } catch { reply(401, { error: '招待・メール確認・認証コードを確認し、もう一度ログインしてください。' }); }
    finally { this.inflight--; }
    return true;
  }
  close(): void { clearInterval(this.timer); for (const id of this.sessions.keys()) this.revoke(id); this.flows.clear(); }
}
