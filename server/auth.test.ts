import { test } from 'node:test';
import type { AuthConfig } from './auth.ts';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { createHash, createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import * as oidc from 'openid-client';
import { readAuthConfig, SlackAuth, slackConfiguration, entraConfiguration, entraUser, readEntraConfig, OfficeAuth } from './auth.ts';
import { attachOffice } from './office.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ServerMessage } from '../src/network/protocol.ts';
import { MemberStore } from './members.ts';

const config = { clientId: 'client123', clientSecret: 'test-secret', redirectUri: 'https://office.example/auth/slack/callback' };
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
const base64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(claims: Record<string, unknown>, wrongSignature = false) {
  const body = base64({ alg: 'RS256', kid: 'slack-key' }) + '.' + base64(claims);
  return body + '.' + createSign('RSA-SHA256').update(body).sign(wrongSignature ? otherKey : privateKey, 'base64url');
}

test('Slack configuration is optional but requires a complete server-side HTTPS setup', () => {
  assert.equal(readAuthConfig({}), undefined);
  assert.deepEqual(readAuthConfig({ SLACK_CLIENT_ID: config.clientId, SLACK_CLIENT_SECRET: config.clientSecret, SLACK_REDIRECT_URI: config.redirectUri }), config);
  for (const uri of ['http://localhost/auth/slack/callback', 'https://user:secret@office.example/auth/slack/callback', 'https://office.example/other', config.redirectUri + '?x=1']) {
    assert.throws(() => readAuthConfig({ SLACK_CLIENT_ID: 'id', SLACK_CLIENT_SECRET: 'secret', SLACK_REDIRECT_URI: uri }));
  }
  assert.throws(() => readAuthConfig({ SLACK_CLIENT_ID: 'id' }));
});

async function fixture(t: TestContext, enabled = true, policy: Partial<AuthConfig> = {}, membersFile?: string) {
  const currentConfig = { ...config, ...policy };
  const microsoft = currentConfig.provider === 'entra', route = microsoft ? '/auth/microsoft' : '/auth/slack';
  const issuer = `https://login.microsoftonline.com/${currentConfig.tenantId}/v2.0`;
  let time = Date.now();
  let overrides: Record<string, unknown> = {};
  let wrongSignature = false;
  let tokenCalls = 0;
  let expectedNonce = '';
  let expectedChallenge = '';
  const client = (microsoft ? entraConfiguration(currentConfig) : slackConfiguration(currentConfig));
  client[oidc.customFetch] = async (input, options) => {
    const url = String(input);
    if (url === (microsoft ? `https://login.microsoftonline.com/${currentConfig.tenantId}/discovery/v2.0/keys` : 'https://slack.com/openid/connect/keys')) return Response.json({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'slack-key', alg: 'RS256', use: 'sig' }] });
    assert.equal(url, microsoft ? `https://login.microsoftonline.com/${currentConfig.tenantId}/oauth2/v2.0/token` : 'https://slack.com/api/openid.connect.token');
    tokenCalls++;
    const form = new URLSearchParams(String(options?.body));
    assert.equal(form.get('client_secret'), currentConfig.clientSecret);
    assert.equal(form.get('client_id'), currentConfig.clientId);
    assert.equal(form.get('redirect_uri'), currentConfig.redirectUri);
    assert.equal(createHash('sha256').update(form.get('code_verifier')!).digest('base64url'), expectedChallenge);
    if (form.get('code') === 'bad') return Response.json({ error: 'invalid_grant', private: 'must-not-leak' }, { status: 400 });
    const now = Math.floor(Date.now() / 1000);
    return Response.json({ access_token: 'secret-access-token', token_type: 'Bearer', id_token: jwt({
      iss: microsoft ? issuer : 'https://slack.com', sub: 'U012ABCDEF', aud: currentConfig.clientId, iat: now, exp: now + 300,
      ...(microsoft ? { tid: currentConfig.tenantId, oid: '22222222-2222-2222-2222-222222222222', email: 'before@example.test' } : {}),
      nonce: expectedNonce, name: 'はな Slack', 'https://slack.com/team_id': 'T012ABCDEF', 'https://slack.com/user_id': 'U012ABCDEF', ...overrides,
    }, wrongSignature) });
  };
  const auth = new SlackAuth(enabled ? currentConfig : undefined, { ...(enabled ? { client } : {}), now: () => time });
  const server = createServer((request, response) => {
    void auth.handle(request, response).then((handled) => { if (!handled) response.writeHead(404).end(); });
  });
  const dispose = attachOffice(server, auth, { membersFile });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sockets: WebSocket[] = [];
  t.after(async () => {
    sockets.forEach((ws) => ws.terminate()); dispose(); auth.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  // Model an HTTPS reverse proxy's original Host over this loopback-only transport.
  const request = (path: string, options: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
    const request = httpRequest(origin + path, { method: options.method ?? 'GET', headers: {
      Host: 'office.example', ...Object.fromEntries(new Headers(options.headers)),
    } }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const headers = new Headers();
        for (let index = 0; index < response.rawHeaders.length; index += 2) headers.append(response.rawHeaders[index], response.rawHeaders[index + 1]);
        resolve(new Response(response.statusCode === 204 ? null : Buffer.concat(chunks), { status: response.statusCode, headers }));
      });
    });
    request.on('error', reject);
    request.end(options.body ? String(options.body) : undefined);
  });
  const begin = async () => {
    const response = await request(route);
    const target = new URL(response.headers.get('location')!);
    expectedNonce = target.searchParams.get('nonce')!;
    expectedChallenge = target.searchParams.get('code_challenge')!;
    return { response, target, state: target.searchParams.get('state')!, cookie: response.headers.getSetCookie()[0].split(';')[0] };
  };
  const callback = (flow: { state: string; cookie: string }, params: Record<string, string> = {}) => request(route + '/callback', {
    method: 'POST', headers: { Cookie: flow.cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ state: flow.state, code: 'ok', ...params }),
  });
  const login = async () => {
    const result = await callback(await begin());
    assert.equal(result.headers.get('location'), '/');
    return result.headers.getSetCookie().find((value) => value.startsWith('waiwai_session='))!.split(';')[0];
  };
  const connect = async (cookie: string) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + '/office', { origin: 'https://office.example', headers: { Host: 'office.example', Cookie: cookie } });
    sockets.push(ws);
    const inbox: ServerMessage[] = [], waiters = new Set<() => void>();
    ws.on('message', (raw) => { inbox.push(JSON.parse(String(raw))); for (const notify of [...waiters]) notify(); });
    const next = <T extends ServerMessage['type']>(type: T, predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true) =>
      new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
        const check = () => {
          const index = inbox.findIndex((m) => m.type === type && predicate(m as Extract<ServerMessage, { type: T }>));
          if (index < 0) return;
          clearTimeout(timer); waiters.delete(check); resolve(inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>);
        };
        const timer = setTimeout(() => { waiters.delete(check); reject(new Error(`Timed out waiting for ${type}`)); }, 2000);
        waiters.add(check); check();
      });
    const welcome = await new Promise<Extract<ServerMessage, { type: 'welcome' }>>((resolve, reject) => {
      ws.once('error', reject); void next('welcome').then(resolve, reject);
    });
    return { ws, welcome, next };
  };
  return { request, begin, callback, login, connect, change: (claims: Record<string, unknown>, badSignature = false) => { overrides = claims; wrongSignature = badSignature; },
    advance: (ms: number) => { time += ms; }, tokenCalls: () => tokenCalls };
}

test('unconfigured login preserves guests and does not expose credentials', async (t) => {
  const f = await fixture(t, false);
  assert.deepEqual(await (await f.request('/api/auth/session')).json(), { configured: false, loginUrl: null, user: null });
  assert.equal((await f.request('/auth/slack')).status, 503);
});

test('login requests identity and email scopes with browser-bound cookies, PKCE and a fixed Slack endpoint', async (t) => {
  const f = await fixture(t);
  const { target, response } = await f.begin();
  assert.equal(target.origin + target.pathname, 'https://slack.com/openid/connect/authorize');
  assert.equal(target.searchParams.get('scope'), 'openid profile email');
  assert.equal(target.searchParams.get('response_mode'), 'form_post');
  assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(target.searchParams.get('redirect_uri'), config.redirectUri);
  assert.ok(target.searchParams.get('nonce') && target.searchParams.get('state'));
  assert.ok(!target.href.includes(config.clientSecret));
  assert.match(response.headers.get('set-cookie')!, /HttpOnly; Secure; SameSite=None/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('signed Slack identity persists across page reloads without exposing provider tokens', async (t) => {
  const f = await fixture(t);
  const session = await f.login();
  for (let index = 0; index < 2; index++) {
    const response = await f.request('/api/auth/session', { headers: { Cookie: session } });
    const text = await response.text();
    assert.ok(!text.includes('secret') && !text.includes('id_token'));
    assert.deepEqual(JSON.parse(text).user, { name: 'はな Slack', provider: 'slack', slack: { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' } });
  }
});

test('administrator policy uses signed verified Slack email, denies spoofing, evacuates closed floors and filters live content', async t => {
  const f = await fixture(t);
  f.change({ name: 'tt-asahara', email: 'tt-asahara@kddi.com', email_verified: false });
  const unverified = await f.connect(await f.login());
  assert.equal((await unverified.next('world-policy')).administrator, false);
  const forged = randomUUID(); unverified.ws.send(JSON.stringify({ type: 'policy-set', actionId: forged, revision: 0, group: 'rooms', id: 'library', allowed: false, administrator: true, email: 'tt-asahara@kddi.com' }));
  assert.match((await unverified.next('policy-result')).error!, /管理者/);
  f.change({ email: 'tt-asahara@kddi.com', email_verified: true });
  const admin = await f.connect(await f.login());
  assert.equal((await admin.next('world-policy')).administrator, true);
  f.change({ sub: 'U999ABCDEF', 'https://slack.com/user_id': 'U999ABCDEF', name: 'tt-asahara', email: 'other@example.test', email_verified: true });
  const other = await f.connect(await f.login());
  assert.equal((await other.next('world-policy')).administrator, false);
  other.ws.send(JSON.stringify({ type: 'change-room', roomId: 'library', requestId: 1 }));
  await other.next('player', m => m.reason === 'room' && m.requestId === 1);
  let revision = 0;
  const set = async (group: string, id: string, allowed = false) => {
    const actionId = randomUUID(); admin.ws.send(JSON.stringify({ type: 'policy-set', actionId, revision, group, id, allowed }));
    assert.equal((await admin.next('policy-result', m => m.actionId === actionId)).error, undefined); revision++;
    return other.next('world-policy', m => m.policy.revision === revision);
  };
  await set('rooms', 'library');
  assert.equal((await other.next('player', m => m.reason === 'policy')).player.roomId, 'office');
  other.ws.send(JSON.stringify({ type: 'change-room', roomId: 'library', requestId: 2 }));
  assert.equal((await other.next('player', m => m.reason === 'room' && m.requestId === 2)).player.roomId, 'office');
  assert.match((await other.next('travel-error')).error, /停止/);
  other.ws.send(JSON.stringify({ type: 'profile', name: 'tt-asahara', outfit: 0, buddy: 'pikachu', administrator: true }));
  assert.equal((await other.next('player', m => m.reason === 'profile' && m.player.id === other.welcome.id)).player.buddy, 'pikachu');
  await set('pokemon', 'pikachu');
  assert.equal((await other.next('player', m => m.reason === 'profile' && m.player.id === other.welcome.id)).player.buddy, null);
  other.ws.send(JSON.stringify({ type: 'profile', name: 'tt-asahara', outfit: 0, buddy: 'pikachu' }));
  assert.equal((await other.next('player', m => m.reason === 'profile' && m.player.id === other.welcome.id)).player.buddy, null);
  await set('residents', 'dog');
  assert.ok(!(await other.next('pets', m => m.roomId === 'office' && !m.pets.some(p => p.kind === 'dog'))).pets.some(p => p.kind === 'dog'));
  await set('residents', 'dog', true);
  await other.next('pets', m => m.roomId === 'office' && m.pets.some(p => p.kind === 'dog'));
  await set('incidents', '*');
  assert.equal((await other.next('daily-event', m => !!m.disabled)).disabled, true);
  await set('pokemon', '*');
  const late = await f.connect('');
  const state = await late.next('world-policy'); assert.equal(state.administrator, false); assert.equal(state.policy.revision, revision);
  assert.ok((await late.next('pets')).pets.every(p => ['dog', 'cat', 'vacuum'].includes(p.kind)));
  assert.equal((await late.next('daily-event')).disabled, true);
});

test('only the verified administrator can enable dummies; floor bans relocate them and hiding cancels pending replies', async t => {
  const f = await fixture(t);
  f.change({ email: 'tt-asahara@kddi.com', email_verified: true });
  const admin = await f.connect(await f.login());
  assert.equal(admin.welcome.players.some(p => p.dummy), false);
  assert.equal((await admin.next('dummy-state')).editable, true);
  const enable = randomUUID(); admin.ws.send(JSON.stringify({ type: 'dummy-control', enabled: true, roomId: 'library', actionId: enable }));
  assert.equal((await admin.next('dummy-result')).error, undefined);
  assert.equal((await admin.next('dummy-state', m => m.enabled)).roomId, 'library');
  const bot = (await admin.next('player', m => !!m.player.dummy)).player;
  const ban = randomUUID(); admin.ws.send(JSON.stringify({ type: 'policy-set', revision: 0, group: 'rooms', id: 'library', allowed: false, actionId: ban }));
  assert.equal((await admin.next('policy-result')).error, undefined);
  assert.equal((await admin.next('dummy-state', m => m.enabled && m.roomId === 'office')).count, 3);
  await new Promise(r => setTimeout(r, 1050));
  const target = { kind: 'dm', peerId: `guest:${bot.id}` }, send = randomUUID();
  admin.ws.send(JSON.stringify({ type: 'chat-send', target, text: 'cancel this reply', shareSlack: false, actionId: send }));
  assert.equal((await admin.next('chat-result', m => m.actionId === send)).error, undefined);
  const hide = randomUUID(); admin.ws.send(JSON.stringify({ type: 'dummy-control', enabled: false, actionId: hide }));
  assert.equal((await admin.next('dummy-result', m => m.actionId === hide)).error, undefined);
  await admin.next('dummy-state', m => !m.enabled);
  // Retransmitting a successful command cannot recreate or relocate the avatars.
  admin.ws.send(JSON.stringify({ type: 'dummy-control', enabled: true, roomId: 'library', actionId: enable }));
  assert.equal((await admin.next('dummy-result', m => m.actionId === enable)).error, undefined);
  await new Promise(r => setTimeout(r, 750));
  const history = randomUUID(); admin.ws.send(JSON.stringify({ type: 'chat-history', target, actionId: history }));
  assert.equal((await admin.next('chat-history', m => m.actionId === history)).messages.length, 1);
  const late = await f.connect(''); assert.equal(late.welcome.players.some(p => p.dummy), false);
  await new Promise(r => setTimeout(r, 300));
  const closed = randomUUID(); admin.ws.send(JSON.stringify({ type: 'dummy-control', enabled: true, roomId: 'library', actionId: closed }));
  assert.match((await admin.next('dummy-result', m => m.actionId === closed)).error!, /公開中/);
});

test('session cookies are secure and host-only; guest messages cannot claim a verified Slack identity', async (t) => {
  const f = await fixture(t);
  const result = await f.callback(await f.begin());
  const sessionCookie = result.headers.getSetCookie().find((value) => value.startsWith('waiwai_session='))!;
  assert.match(sessionCookie, /HttpOnly; Secure; SameSite=Lax; Max-Age=28800/);
  assert.ok(!sessionCookie.includes('Domain='));
  const { ws, welcome, next } = await f.connect('');
  const changed = next('player', (m) => m.reason === 'profile' && m.player.id === welcome.id);
  ws.send(JSON.stringify({ type: 'profile', name: '手動', outfit: 0, slackVerified: true, slack: { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' } }));
  const player = (await changed).player;
  assert.equal(player.id, welcome.id); assert.equal(player.slackVerified, false);
});

test('callback rejects wrong state, missing browser cookie, replay, cancellation and expired flows', async (t) => {
  const f = await fixture(t);
  let flow = await f.begin();
  assert.equal((await f.callback({ ...flow, cookie: '' })).headers.get('location'), '/?login=expired');
  assert.equal((await f.callback(flow, { state: 'wrong' })).headers.get('location'), '/?login=failed');
  assert.equal((await f.callback(flow)).headers.get('location'), '/?login=expired');
  flow = await f.begin();
  assert.equal((await f.callback(flow, { error: 'access_denied' })).headers.get('location'), '/?login=failed');
  flow = await f.begin(); f.advance(11 * 60_000);
  assert.equal((await f.callback(flow)).headers.get('location'), '/?login=expired');
  assert.equal(f.tokenCalls(), 0);
});

for (const [label, claims, badSignature] of [
  ['nonce', { nonce: 'wrong' }, false], ['issuer', { iss: 'https://evil.example' }, false],
  ['audience', { aud: 'another-client' }, false], ['expiry', { exp: 1 }, false],
  ['signature', {}, true], ['Slack IDs', { 'https://slack.com/user_id': 'https://evil.example' }, false],
  ['subject mismatch', { sub: 'UOTHER' }, false], ['missing name', { name: '' }, false],
] as const) test(`authentication rejects invalid ${label}`, async (t) => {
  const f = await fixture(t); f.change(claims, badSignature);
  const result = await f.callback(await f.begin());
  assert.equal(result.headers.get('location'), '/?login=failed');
  assert.ok(!result.headers.getSetCookie().some((value) => value.startsWith('waiwai_session=')));
  assert.equal((await (await f.request('/api/auth/session')).json()).user, null);
});

test('token errors are generic, and successful callbacks cannot be replayed', async (t) => {
  const f = await fixture(t);
  const failure = await f.callback(await f.begin(), { code: 'bad' });
  assert.equal(failure.headers.get('location'), '/?login=failed');
  assert.ok(!(await failure.text()).includes('must-not-leak'));
  const flow = await f.begin();
  assert.equal((await f.callback(flow)).headers.get('location'), '/');
  assert.equal((await f.callback(flow)).headers.get('location'), '/?login=expired');
});

test('authenticated WebSocket profiles cannot change Slack identity; logout revokes all tab connections', async (t) => {
  const f = await fixture(t);
  const session = await f.login();
  const a = await f.connect(session); const b = await f.connect(session);
  const self = a.welcome.players.find((player) => player.id === a.welcome.id)!;
  assert.equal(self.name, 'はな Slack'); assert.equal(self.slackVerified, true);
  a.ws.send(JSON.stringify({ type: 'profile', name: '偽装', outfit: 2, slack: { teamId: 'TOTHER', userId: 'UOTHER' } }));
  const player = (await a.next('player', (m) => m.reason === 'profile')).player;
  assert.equal(player.name, 'はな Slack'); assert.deepEqual(player.slack, self.slack); assert.equal(player.outfit, 2);
  assert.equal((await f.request('/auth/logout', { method: 'GET', headers: { Cookie: session } })).status, 405);
  assert.equal((await f.request('/auth/logout', { method: 'POST', headers: { Cookie: session, Origin: 'https://evil.example' } })).status, 403);
  const closed = [a.ws, b.ws].map((ws) => new Promise<number>((resolve) => ws.once('close', resolve)));
  const logout = await f.request('/auth/logout', { method: 'POST', headers: { Cookie: session, Origin: 'https://office.example' } });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie')!, /Max-Age=0/);
  assert.deepEqual(await Promise.all(closed), [4001, 4001]);
  assert.equal((await (await f.request('/api/auth/session', { headers: { Cookie: session } })).json()).user, null);
});

test('expired sessions are revoked and disconnect authenticated avatars', async (t) => {
  const f = await fixture(t); const session = await f.login(); const { ws } = await f.connect(session);
  const closed = new Promise<number>((resolve) => ws.once('close', resolve));
  f.advance(8 * 60 * 60_000 + 1);
  assert.equal((await (await f.request('/api/auth/session', { headers: { Cookie: session } })).json()).user, null);
  assert.equal(await closed, 4001);
});

test('production requires Slack authentication and rejects another workspace', async (t) => {
  const f = await fixture(t, true, { required: true, teamId: 'T012ABCDEF' });
  assert.equal((await (await f.request('/api/auth/session')).json()).required, true);
  await assert.rejects(f.connect(''), /401/);
  f.change({ 'https://slack.com/team_id': 'T999ABCDEF' });
  assert.equal((await f.callback(await f.begin())).headers.get('location'), '/?login=failed');
  f.change({});
  const { welcome } = await f.connect(await f.login());
  assert.equal(welcome.players[0].slackVerified, true);
  assert.throws(() => readAuthConfig({ REQUIRE_SLACK_LOGIN: 'true' }));
  assert.throws(() => readAuthConfig({ SLACK_TEAM_ID: 'bad' }));
});

test('verified directory membership survives logout and server restart, merges tabs and rejects guest impersonation', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-auth-members-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'members.json'), f = await fixture(t, true, {}, file);
  const watcher = await f.connect(''); const session = await f.login();
  const a = await f.connect(session), b = await f.connect(session);
  b.ws.send(JSON.stringify({ type: 'change-room', roomId: 'cafe', requestId: 1 }));
  const online = await watcher.next('directory', (m) => m.people.some((p) => p.verified && p.roomId === 'cafe'));
  assert.equal(online.people.filter((p) => p.verified).length, 1);
  const id = online.people.find((p) => p.verified)!.id;
  assert.equal(online.people.find((p) => p.id === id)!.playerId, b.welcome.id);
  watcher.ws.send(JSON.stringify({ type: 'profile', name: 'なりすまし', outfit: 0, slack: { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' }, slackVerified: true }));
  const guest = await watcher.next('directory', (m) => m.people.some((p) => p.name === 'なりすまし'));
  assert.equal(guest.people.find((p) => p.name === 'なりすまし')!.verified, false);
  assert.equal(guest.people.filter((p) => p.verified).length, 1);
  b.ws.close();
  const remaining = await watcher.next('directory', (m) => m.people.some((p) => p.id === id && p.playerId === a.welcome.id));
  assert.equal(remaining.people.find((p) => p.id === id)!.online, true);
  const revoked = new Promise<number>((resolve) => a.ws.once('close', resolve));
  await f.request('/auth/logout', { method: 'POST', headers: { Cookie: session, Origin: 'https://office.example' } });
  assert.equal(await revoked, 4001);
  const offline = await watcher.next('directory', (m) => m.people.some((p) => p.id === id && !p.online));
  assert.equal(offline.people.find((p) => p.id === id)!.playerId, undefined);
  assert.equal(new MemberStore(file).list().length, 1);
  const restarted = await fixture(t, false, {}, file), observer = await restarted.connect('');
  const restored = await observer.next('directory');
  assert.equal(restored.people.find((p) => p.id === id)!.online, false);
  assert.equal(restored.people.find((p) => p.id === id)!.name, 'はな Slack');
});

const tenant = '11111111-1111-1111-1111-111111111111';
const entra = { provider: 'entra' as const, tenantId: tenant, clientId: '33333333-3333-3333-3333-333333333333', redirectUri: 'https://office.example/auth/microsoft/callback', required: true };
test('Microsoft login validates signed tenant identity and keeps the same account when email changes', async t => {
  const f = await fixture(t, true, entra);
  const flow = await f.begin(); assert.equal(flow.target.origin, 'https://login.microsoftonline.com'); assert.equal(flow.target.searchParams.get('scope'), 'openid profile email');
  const cookie = (await f.callback(flow)).headers.getSetCookie().find(v=>v.startsWith('waiwai_session='))!.split(';')[0];
  const first = await (await f.request('/api/auth/session', { headers: { Cookie: cookie } })).json();
  assert.equal(first.user.accountId, `entra:${tenant}:22222222-2222-2222-2222-222222222222`); assert.equal(first.user.slack, undefined);
  const peer = await f.connect(cookie); assert.equal(peer.welcome.players.find(p=>p.id===peer.welcome.id)!.accountId, first.user.accountId);
  f.change({ email: 'changed@example.test' }); const later = await f.login();
  const second = await (await f.request('/api/auth/session', { headers: { Cookie: later } })).json(); assert.equal(second.user.accountId, first.user.accountId); assert.notEqual(second.user.email,first.user.email);
  peer.ws.send(JSON.stringify({ type: 'profile', name: 'forged', outfit: 0, accountId: 'slack:T012ABCDEF:U012ABCDEF', slack: { teamId:'T012ABCDEF',userId:'U012ABCDEF' } }));
  const updated = (await peer.next('player',m=>m.reason==='profile')).player; assert.equal(updated.accountId, first.user.accountId); assert.equal(updated.slack,null);
});
for (const [name, claims] of Object.entries({ tenant: {tid:'99999999-9999-9999-9999-999999999999'}, issuer:{iss:'https://example.invalid'}, audience:{aud:'wrong'}, object:{oid:'forged'}, nonce:{nonce:'wrong'} })) test(`Microsoft rejects invalid ${name}`,async t=>{
  const f=await fixture(t,true,entra);f.change(claims);assert.equal((await f.callback(await f.begin())).headers.get('location'),'/?login=failed');
});
test('Entra requires a complete single-tenant HTTPS configuration, and does not use email as identity',()=>{
  assert.equal(readEntraConfig({}),undefined);assert.throws(()=>readEntraConfig({REQUIRE_ENTRA_LOGIN:'true'}));
  assert.throws(()=>readEntraConfig({ENTRA_TENANT_ID:'common',ENTRA_CLIENT_ID:entra.clientId,ENTRA_CLIENT_SECRET:'test',ENTRA_REDIRECT_URI:entra.redirectUri}));
  const cfg=readEntraConfig({ENTRA_TENANT_ID:tenant,ENTRA_CLIENT_ID:entra.clientId,ENTRA_CLIENT_SECRET:'test',ENTRA_REDIRECT_URI:entra.redirectUri,REQUIRE_ENTRA_LOGIN:'true'})!;
  const auth=new OfficeAuth(undefined,cfg);assert.equal(auth.canJoin({headers:{}} as never),false);auth.close();
  assert.throws(()=>entraUser({tid:tenant,oid:'bad',email:'trusted@example.test',name:'A'},tenant));
});
