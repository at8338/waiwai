import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { WorldPolicyStore } from './world-policy.ts';
import type { AuthUser } from '../src/slack/auth.ts';
import type { PolicyAction } from '../src/game/world-policy.ts';
import { allowedRooms, policyAllows } from '../src/game/world-policy.ts';
const admin: AuthUser = { name: 'tt-asahara', provider: 'slack', email: 'tt-asahara@kddi.com', emailVerified: true, slack: { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' } };
const action = (revision = 0, group: PolicyAction['group'] = 'rooms', id = 'cafe', allowed = false): PolicyAction => ({ type: 'policy-set', actionId: randomUUID(), revision, group, id, allowed });
test('only verified administrator identity can bootstrap, then immutable account ID is pinned across restarts', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-policy-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'policy.json'), store = new WorldPolicyStore(file);
  for (const user of [undefined, { name: 'tt-asahara' }, { ...admin, emailVerified: false }, { ...admin, provider: 'entra' as const }, { ...admin, email: 'other@example.com' }]) {
    assert.equal(store.isAdministrator(user), false);
    await assert.rejects(store.apply(action(), user, () => true), /管理者/);
  }
  assert.equal(store.isAdministrator(admin), true);
  await store.apply(action(), admin, () => true);
  const otherAccount = { ...admin, slack: { ...admin.slack!, userId: 'U999ABCDEF' } };
  assert.equal(store.isAdministrator(otherAccount), false);
  const reloaded = new WorldPolicyStore(file);
  assert.deepEqual(reloaded.snapshot(), store.snapshot()); assert.equal(reloaded.isAdministrator(otherAccount), false); assert.equal(reloaded.isAdministrator(admin), true);
  assert.match(await readFile(file, 'utf8'), /slack:T012ABCDEF:U012ABCDEF/);
});
test('generation switches persist atomically and enabling a generation leaves individual bans intact', async t => {
  const dir=await mkdtemp(join(tmpdir(),'waiwai-generation-policy-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,'policy.json'), store=new WorldPolicyStore(file);
  await assert.rejects(store.apply(action(0,'pokemon','generation:1'),undefined,()=>true),/管理者/);
  await store.apply(action(0,'pokemon','pikachu'),admin,()=>true);
  await store.apply(action(1,'pokemon','generation:1'),admin,()=>true);
  let reloaded=new WorldPolicyStore(file);
  assert.equal(policyAllows(reloaded.snapshot(),'pokemon','eevee'),false);
  assert.equal(policyAllows(reloaded.snapshot(),'pokemon','chikorita'),true);
  await reloaded.apply(action(2,'pokemon','generation:1',true),admin,()=>true);
  reloaded=new WorldPolicyStore(file);
  assert.equal(policyAllows(reloaded.snapshot(),'pokemon','eevee'),true);
  assert.equal(policyAllows(reloaded.snapshot(),'pokemon','pikachu'),false);
  await assert.rejects(reloaded.apply(action(2,'pokemon','generation:2'),admin,()=>true),/更新/);
});

test('Microsoft administrator requires an explicitly provisioned immutable account ID', () => {
  const user: AuthUser = { name: 'tt-asahara', email: 'tt-asahara@kddi.com', provider: 'entra', accountId: 'entra:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222' };
  assert.equal(new WorldPolicyStore().isAdministrator(user), false);
  assert.equal(new WorldPolicyStore(undefined, user.accountId).isAdministrator(user), true);
  assert.equal(new WorldPolicyStore(undefined, user.accountId).isAdministrator(admin), false);
  assert.throws(() => new WorldPolicyStore(undefined, 'tt-asahara'));
});
test('stale concurrent edits, revoked sessions, final-floor closure and disk failures never publish partial policy', async t => {
  const store = new WorldPolicyStore();
  const results = await Promise.allSettled([store.apply(action(), admin, () => true), store.apply(action(0, 'residents', 'dog'), admin, () => true)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const snapshot = store.snapshot();
  await assert.rejects(store.apply(action(1), admin, () => false)); assert.deepEqual(store.snapshot(), snapshot);
  for (const room of allowedRooms(store.snapshot()).slice(1)) await store.apply(action(store.snapshot().revision, 'rooms', room), admin, () => true);
  await assert.rejects(store.apply(action(store.snapshot().revision, 'rooms', allowedRooms(store.snapshot())[0]), admin, () => true), /少なくとも/);
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-policy-fail-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'parent', 'policy.json'), broken = new WorldPolicyStore(file); await writeFile(join(dir, 'parent'), 'blocked');
  await assert.rejects(broken.apply(action(), admin, () => true)); assert.equal(broken.snapshot().revision, 0);
  await assert.rejects(broken.apply(action(), { ...admin, name: 'forged', emailVerified: false }, () => true));
});
test('corrupt persisted policies fail closed instead of reverting bans to defaults', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-policy-corrupt-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'policy.json');
  await writeFile(file, JSON.stringify({ version: 1, policy: { revision: 0, blocked: { rooms: ['invalid'], residents: [], incidents: [], pokemon: [] } } }));
  assert.throws(() => new WorldPolicyStore(file), /Cannot load/);
});
