import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { DecodedIdToken, UserRecord } from 'firebase-admin/auth';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IdentityPlatformAuth, readIdentityPlatformConfig } from './identity-platform.ts';
import { OfficeAuth } from './auth.ts';
import { persistentIdentity } from '../src/game/identity.ts';
import { PersonalStore } from './personal-data.ts';
import { WorldPolicyStore } from './world-policy.ts';
import { prepareIdentityInvitation } from './identity-invites.ts';
import { PERSONAL_KEYS } from '../src/game/personal-data.ts';

const projectId = 'waiwai-dev-example', uid = 'member0123456789';
const config = { projectId, apiKey: 'test-key-0000000000000000000', origin: 'https://office.example', accountLinks: {} };
async function fixture(t: TestContext, links = {}) {
  let now = Date.now(), rejected = false;
  let claims = { uid, sub: uid, aud: projectId, iss: `https://securetoken.google.com/${projectId}`, email: 'member@example.test', email_verified: true, waiwaiInvited: true, auth_time: Math.floor(now / 1000), firebase: { sign_in_provider: 'password', sign_in_second_factor: 'totp', second_factor_identifier: 'factor1' } } as unknown as DecodedIdToken;
  let record = { uid, email: claims.email, emailVerified: true, disabled: false, displayName: 'ソラ', customClaims: { waiwaiInvited: true }, tokensValidAfterTime: new Date(now - 1000).toISOString(), multiFactor: { enrolledFactors: [{ factorId: 'totp', uid: 'factor1' }] } } as unknown as UserRecord;
  let verifications = 0;
  const identity = new IdentityPlatformAuth({ ...config, accountLinks: links }, { now: () => now, verifier: {
    async verifyIdToken(token, checkRevoked) { assert.equal(token, 'test-id-token'); assert.equal(checkRevoked, true); verifications++; if (rejected) throw new Error('bad signature/expired/revoked'); return claims; },
    async getUser(id) { assert.equal(id, uid); return record; },
  } });
  // Even an existing optional Slack configuration cannot bypass Identity Platform.
  const auth = new OfficeAuth({ clientId: 'unused', clientSecret: 'unused', redirectUri: config.origin + '/auth/slack/callback' }, undefined, identity);
  const server = createServer((req, res) => { void auth.handle(req, res).then(handled => { if (!handled) res.writeHead(auth.canJoin(req) ? 200 : 401).end(JSON.stringify(auth.identify(req)?.user ?? null)); }).catch(() => res.writeHead(500).end()); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  t.after(async () => { auth.close(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const request = (path: string, options: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
    const req = httpRequest(origin + path, { method: options.method ?? 'GET', headers: { Host: 'office.example', ...Object.fromEntries(new Headers(options.headers)) } }, res => {
      const chunks: Buffer[] = []; res.on('data', b => chunks.push(b)); res.on('end', () => {
        const headers = new Headers(); for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    }); req.on('error', reject); req.end(options.body ? String(options.body) : undefined);
  });
  const begin = async () => { const r = await request('/api/auth/identity/config'); assert.equal(r.status, 200); return { cookie: r.headers.getSetCookie()[0].split(';')[0], csrf: (await r.json()).csrf as string }; };
  const login = async (headers = {}) => { const flow = await begin(); return request('/api/auth/identity/session', { method: 'POST', headers: { Origin: config.origin, Cookie: flow.cookie, 'Content-Type': 'application/json', 'X-Waiwai-CSRF': flow.csrf, ...headers }, body: JSON.stringify({ idToken: 'test-id-token' }) }); };
  const session = (r: Response) => r.headers.getSetCookie().find(v => v.startsWith('waiwai_session='))!.split(';')[0];
  return { request, begin, login, session, identity, auth, change: (c: Partial<DecodedIdToken>) => { claims = { ...claims, ...c }; }, user: (c: Partial<UserRecord>) => { record = { ...record, ...c } as UserRecord; }, reject: () => { rejected = true; }, advance: (ms: number) => { now += ms; }, verifications: () => verifications };
}
test('Identity Platform requires complete HTTPS configuration and cannot silently weaken mandatory login', () => {
  assert.equal(readIdentityPlatformConfig({}), undefined);
  const env = { GCIP_PROJECT_ID: projectId, GCIP_API_KEY: config.apiKey, GCIP_ORIGIN: config.origin, REQUIRE_IDENTITY_PLATFORM_LOGIN: 'true' };
  assert.equal(readIdentityPlatformConfig(env)?.origin, config.origin);
  for (const change of [{ REQUIRE_IDENTITY_PLATFORM_LOGIN: 'false' }, { GCIP_API_KEY: '' }, { GCIP_ORIGIN: 'http://office.example' }, { GCIP_ORIGIN: config.origin + '/path' }, { REQUIRE_ENTRA_LOGIN: 'true' }, { REQUIRE_SLACK_LOGIN: 'true' }, { FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099' }]) assert.throws(() => readIdentityPlatformConfig({ ...env, ...change }));
});
test('MFA session is an opaque secure cookie and optional provider/guest entry is denied', async t => {
  const f = await fixture(t); assert.equal((await f.request('/private')).status, 401);
  const status = await (await f.request('/api/auth/session')).json(); assert.equal(status.required, true); assert.equal(status.identityPlatform, true); assert.equal(status.loginUrl, null); assert.equal(status.microsoftLoginUrl, null);
  assert.equal((await f.request('/auth/slack')).status, 403); assert.equal((await f.request('/auth/microsoft')).status, 403);
  const r = await f.login(); assert.equal(r.status, 200); const cookie = f.session(r);
  assert.match(r.headers.getSetCookie().join(';'), /HttpOnly; Secure; SameSite=Strict/); assert.ok(!cookie.includes('test-id-token'));
  const user = await (await f.request('/private', { headers: { Cookie: cookie } })).json(); assert.equal(user.accountId, `gcip:${projectId}:${uid}`); assert.equal(user.provider, 'gcip'); assert.equal(user.emailVerified, true); assert.ok(persistentIdentity(user.accountId));
  const store = new PersonalStore(); store.save(user.accountId, PERSONAL_KEYS[1], { selected: 'robot', favorites: ['cat'] }, 0);
  assert.deepEqual(store.snapshot(user.accountId).records[PERSONAL_KEYS[1]]?.value, { selected: 'robot', favorites: ['cat'] });
  store.close();
});
test('Session exchange checks CSRF, exact host/origin, JSON, single-use flow before calling verifier', async t => {
  const f = await fixture(t);
  for (const headers of [{ Origin: 'https://evil.example' }, { Host: 'evil.example' }, { 'X-Waiwai-CSRF': 'wrong' }, { 'Content-Type': 'text/plain' }]) assert.ok((await f.login(headers)).status >= 400);
  assert.equal(f.verifications(), 0);
  const flow = await f.begin(); const options = { method: 'POST', headers: { Origin: config.origin, Cookie: flow.cookie, 'Content-Type': 'application/json', 'X-Waiwai-CSRF': flow.csrf }, body: '{"idToken":"test-id-token"}' };
  assert.equal((await f.request('/api/auth/identity/session', options)).status, 200);
  assert.equal((await f.request('/api/auth/identity/session', options)).status, 403);
});
for (const [name, patch] of Object.entries({ uninvited: { waiwaiInvited: false }, unverified: { email_verified: false }, wrongProject: { aud: 'other-project' }, wrongIssuer: { iss: 'https://evil.example' }, noMfa: { firebase: { sign_in_provider: 'password' } }, smsOnly: { firebase: { sign_in_provider: 'password', sign_in_second_factor: 'phone' } }, customProvider: { firebase: { sign_in_provider: 'custom', sign_in_second_factor: 'totp' } }, stale: { auth_time: 1 }, differentSubject: { sub: 'someone-else' } })) {
  test(`Identity Platform rejects ${name} tokens`, async t => { const f = await fixture(t); f.change(patch as Partial<DecodedIdToken>); assert.equal((await f.login()).status, 401); });
}
test('SDK verification failures and current account disabling/invitation removal are fail-closed', async t => {
  const f = await fixture(t); f.reject(); assert.equal((await f.login()).status, 401);
  const g = await fixture(t); g.user({ disabled: true }); assert.equal((await g.login()).status, 401);
  const h = await fixture(t); h.user({ customClaims: { waiwaiInvited: false } }); assert.equal((await h.login()).status, 401);
});
test('Periodic revocation invalidates existing sessions and notifies active connections', async t => {
  const f = await fixture(t); const cookie = f.session(await f.login()), revoked: string[] = []; f.auth.onRevoke(id => revoked.push(id));
  f.user({ disabled: true }); await f.identity.revalidate(); assert.equal((await f.request('/private', { headers: { Cookie: cookie } })).status, 401); assert.equal(revoked.length, 1);
});
test('An unregistered or removed TOTP factor cannot authenticate even if another factor remains', async t => {
  const f = await fixture(t); f.user({ multiFactor: { enrolledFactors: [{ factorId: 'totp', uid: 'replacement' }] } as unknown as UserRecord['multiFactor'] }); assert.equal((await f.login()).status, 401);
  const g = await fixture(t); const cookie = g.session(await g.login()); g.user({ multiFactor: { enrolledFactors: [] } as unknown as UserRecord['multiFactor'] }); await g.identity.revalidate(); assert.equal((await g.request('/private', { headers: { Cookie: cookie } })).status, 401);
});
test('Stale validation, logout and token revocation cannot leave an authenticated office connection', async t => {
  const f = await fixture(t); const cookie = f.session(await f.login()); f.advance(60_001); assert.equal((await f.request('/private', { headers: { Cookie: cookie } })).status, 401);
  const g = await fixture(t); const c = g.session(await g.login()); assert.equal((await g.request('/auth/logout', { method: 'POST', headers: { Origin: config.origin, Cookie: c } })).status, 200); assert.equal((await g.request('/private', { headers: { Cookie: c } })).status, 401);
  const h = await fixture(t); const token = h.session(await h.login()); h.user({ tokensValidAfterTime: new Date(Date.now() + 1000).toISOString() }); await h.identity.revalidate(); assert.equal((await h.request('/private', { headers: { Cookie: token } })).status, 401);
});
test('Legacy links preserve exact account IDs and administrator identity without auto-linking email', async t => {
  const old = 'slack:T012ABCDEF:U012ABCDEF', f = await fixture(t, { [uid]: old }); const cookie = f.session(await f.login()); const user = await (await f.request('/private', { headers: { Cookie: cookie } })).json();
  assert.equal(user.accountId, old); assert.equal(new WorldPolicyStore(undefined, old).isAdministrator(user), true); assert.equal(new WorldPolicyStore().isAdministrator(user), false);
  const store = new PersonalStore(); store.save(old, PERSONAL_KEYS[1], { selected: 'cat', favorites: ['robot'] }, 0);
  assert.deepEqual(store.snapshot(user.accountId).records[PERSONAL_KEYS[1]]?.value, { selected: 'cat', favorites: ['robot'] });
  assert.deepEqual(store.snapshot(`gcip:${projectId}:${uid}`).records, {}); store.close();
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-gcip-links-')); t.after(() => rm(dir, { recursive: true, force: true })); const path = join(dir, 'links.json');
  await writeFile(path, JSON.stringify({ a: old, b: old })); assert.throws(() => readIdentityPlatformConfig({ GCIP_PROJECT_ID: projectId, GCIP_API_KEY: config.apiKey, GCIP_ORIGIN: config.origin, REQUIRE_IDENTITY_PLATFORM_LOGIN: 'true', GCIP_ACCOUNT_LINKS_FILE: path }));
});
test('Administrative invitations create no shared password, generate same-origin action links and revoke without mail', async () => {
  const calls: string[] = []; let created: Record<string, unknown> = {};
  const record = { uid, email: 'member@example.test', disabled: false, customClaims: { unrelated: 1 } } as unknown as UserRecord;
  const admin = {
    async createUser(properties: Record<string, unknown>) { created = properties; calls.push('create'); return record; },
    async getUser(id: string) { assert.equal(id, uid); return record; },
    async setCustomUserClaims(_id: string, claims: Record<string, unknown>) { assert.equal(claims.unrelated, 1); calls.push(claims.waiwaiInvited ? 'invite' : 'revoke'); },
    async generatePasswordResetLink() { return 'https://example.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=private-reset'; },
    async generateEmailVerificationLink() { return 'https://example.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=private-verify'; },
    async revokeRefreshTokens() { calls.push('revokeTokens'); },
  };
  const result = await prepareIdentityInvitation(admin, { action: 'invite', email: record.email!, name: 'ソラ' }, config.origin);
  assert.equal(created.emailVerified, false); assert.ok(String(created.password).length >= 48); assert.ok(!('password' in result)); assert.ok(result.passwordSetupUrl?.startsWith(config.origin + '/?mode=resetPassword'));
  await prepareIdentityInvitation(admin, { action: 'revoke', uid, email: record.email! }, config.origin); assert.deepEqual(calls, ['create', 'invite', 'revoke', 'revokeTokens']);
  await assert.rejects(prepareIdentityInvitation(admin, { action: 'reissue', uid, email: 'other@example.test' }, config.origin));
});
