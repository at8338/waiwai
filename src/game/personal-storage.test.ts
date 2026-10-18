import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountStorage } from './personal-storage.ts';
import { DEFAULT_APPEARANCE } from './avatar.ts';
import { PERSONAL_KEYS } from './personal-data.ts';
import type { PersonalSnapshot } from './personal-data.ts';
const id = 'slack:T12345678:U12345678', [appearance, buddy] = PERSONAL_KEYS;
const snapshot = (): PersonalSnapshot => ({ accountId: id, records: {} });
test('authenticated cache loads only its account and never touches localStorage', async () => {
  const result = snapshot(); result.records[appearance] = { value: DEFAULT_APPEARANCE, revision: 2 };
  const store = new AccountStorage(id, async () => Response.json(result)); await store.load();
  assert.equal(JSON.parse(store.getItem(appearance)!).color, 0); assert.equal(store.getItem(buddy), null);
  const wrong = new AccountStorage(id, async () => Response.json({ ...result, accountId: 'someone-else' }));
  await assert.rejects(wrong.load(), /アカウント/);
});
test('network failure retains pending writes for retry; conflict requires reload and cannot overwrite', async () => {
  let fail = true, conflict = false, posts = 0;
  const result = snapshot();
  const store = new AccountStorage(id, async (_url, options) => {
    if (!options?.body) return Response.json(result);
    posts++; if (fail) throw new Error('offline'); if (conflict) return Response.json({ error: '別の画面' }, { status: 409 });
    const data = JSON.parse(String(options.body)); result.records[data.key as typeof appearance] = { value: data.value, revision: 1 }; return Response.json(result);
  });
  await store.load(); store.setItem(appearance, JSON.stringify(DEFAULT_APPEARANCE)); await store.flush();
  assert.equal(store.dirty, true); assert.match(store.error, /offline/);
  fail = false; await store.flush(); assert.equal(store.dirty, false); assert.equal(store.error, '');
  conflict = true; store.setItem(appearance, JSON.stringify({ ...DEFAULT_APPEARANCE, color: 1 })); await store.flush();
  const previous = posts; await store.flush(); assert.equal(posts, previous); assert.equal(store.needsReload, true);
});
test('unrelated save does not advance a stale setting revision behind the editor', async () => {
  const result = snapshot(); result.records[appearance] = { value: DEFAULT_APPEARANCE, revision: 1 };
  const revisions: number[] = [];
  const store = new AccountStorage(id, async (_url, options) => {
    if (!options?.body) return Response.json(result);
    const data = JSON.parse(String(options.body)); revisions.push(data.revision);
    if (data.key === buddy) return Response.json({ accountId: id, records: { [buddy]: { value: data.value, revision: 1 }, [appearance]: { value: { ...DEFAULT_APPEARANCE, color: 2 }, revision: 2 } } });
    return Response.json({ error: 'conflict' }, { status: 409 });
  });
  await store.load(); store.setItem(buddy, JSON.stringify({ selected: 'robot', favorites: [] })); await store.flush();
  store.setItem(appearance, JSON.stringify({ ...DEFAULT_APPEARANCE, color: 1 })); await store.flush();
  assert.deepEqual(revisions, [0, 1]); assert.equal(store.needsReload, true);
});
