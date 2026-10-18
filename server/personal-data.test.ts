import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { PersonalStore, PersonalConflict, PersonalService } from './personal-data.ts';
import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { PERSONAL_KEYS } from '../src/game/personal-data.ts';
import { POKEMON_KINDS } from '../src/game/pokemon.ts';
import type { OfficeAuthService } from './auth.ts';
const a = 'slack:T12345678:U12345678', b = 'entra:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222';
const [appearance, buddy, pokemon, incidents] = PERSONAL_KEYS;
const discovery = (foundAt: number) => ({ kind: POKEMON_KINDS[0], roomId: 'office', foundAt });
test('personal settings and collections survive restart and stay isolated by stable account ID', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-personal-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'personal.sqlite'), store = new PersonalStore(file);
  store.save(a, appearance, DEFAULT_APPEARANCE, 0); store.save(a, buddy, { selected: 'robot', favorites: ['cat'] }, 0);
  store.save(a, pokemon, [discovery(1000)], 0); store.save(a, incidents, ['2026-10-18'], 0); store.close();
  const restored = new PersonalStore(file); t.after(() => restored.close());
  assert.equal(Object.keys(restored.snapshot(a).records).length, 4); assert.deepEqual(restored.snapshot(b).records, {});
  restored.save(b, appearance, { ...DEFAULT_APPEARANCE, color: 2 }, 0);
  assert.equal((restored.snapshot(a).records[appearance]!.value as typeof DEFAULT_APPEARANCE).color, 0);
  assert.throws(() => restored.snapshot('guest:any'));
});
test('stale tabs cannot overwrite settings; discoveries merge with earliest encounter and no 400-day truncation', t => {
  const store = new PersonalStore(); t.after(() => store.close());
  store.save(a, appearance, DEFAULT_APPEARANCE, 0);
  assert.throws(() => store.save(a, appearance, { ...DEFAULT_APPEARANCE, color: 1 }, 0), PersonalConflict);
  store.save(a, pokemon, [discovery(2000)], 0); store.save(a, pokemon, [discovery(1000)], 0);
  assert.deepEqual(store.snapshot(a).records[pokemon]!.value, [discovery(1000)]);
  const days = Array.from({ length: 500 }, (_, i) => new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10));
  store.save(a, incidents, days, 0); store.save(a, incidents, ['2026-10-18'], 0);
  assert.equal((store.snapshot(a).records[incidents]!.value as string[]).length, 501);
});
test('import is atomic, repeatable, keeps server settings, and merges records without accepting account IDs', t => {
  const store = new PersonalStore(); t.after(() => store.close());
  store.save(a, appearance, { ...DEFAULT_APPEARANCE, color: 2 }, 0);
  const bundle = { [appearance]: DEFAULT_APPEARANCE, [buddy]: { selected: null, favorites: ['robot'] }, [pokemon]: [discovery(500)], [incidents]: ['2026-10-18'] };
  const first = store.import(a, bundle); assert.deepEqual(store.import(a, bundle), first);
  assert.equal((first.records[appearance]!.value as typeof DEFAULT_APPEARANCE).color, 2);
  assert.deepEqual(store.snapshot(b).records, {});
  const before = store.snapshot(a);
  assert.throws(() => store.import(a, { ...bundle, [incidents]: ['2026-02-30'] })); assert.deepEqual(store.snapshot(a), before);
  assert.throws(() => store.import(a, { ...bundle, accountId: b }));
});
test('API uses verified session only; rejects guests, cross-origin writes, expired uploads and invalid bodies', async t => {
  let authenticated = true;
  const auth: OfficeAuthService = { identify: () => authenticated ? { id: 'session', user: { name: 'Alice', accountId: b } } : undefined, canJoin: () => authenticated, onRevoke: () => () => {} };
  const service = new PersonalService(auth); t.after(() => service.store.close());
  const call = async (method: string, data?: unknown, origin = 'https://office.example', chunks?: AsyncIterable<string>) => {
    const request = (chunks ? Readable.from(chunks) : Readable.from(data === undefined ? [] : [JSON.stringify(data)])) as IncomingMessage;
    request.url = '/api/personal'; request.method = method; request.headers = { host: 'office.example', origin, 'content-type': 'application/json' };
    let status = 0, body = '', cache = '';
    const response = { setHeader: (key: string, value: string) => { if (key === 'Cache-Control') cache = value; }, writeHead: (code: number) => { status = code; return response; }, end: (text: string) => { body = text; } } as unknown as ServerResponse;
    await service.handle(request, response); assert.equal(cache, 'no-store'); return { status, body: JSON.parse(body) };
  };
  authenticated = false; assert.equal((await call('GET')).status, 401);
  authenticated = true;
  assert.equal((await call('POST', { action: 'import', records: {} }, 'https://evil.example')).status, 403);
  assert.equal((await call('POST', { action: 'save', accountId: a, key: appearance, value: DEFAULT_APPEARANCE, revision: 0 })).status, 409);
  assert.equal((await call('POST', { action: 'import', accountId: a, records: { [appearance]: DEFAULT_APPEARANCE } })).status, 409);
  const saved = await call('POST', { action: 'save', accountId: b, key: appearance, value: DEFAULT_APPEARANCE, revision: 0 });
  assert.equal(saved.status, 200); assert.equal(saved.body.accountId, b); assert.deepEqual(service.store.snapshot(a).records, {});
  assert.equal((await call('POST', { action: 'save', accountId: b, key: appearance, value: DEFAULT_APPEARANCE, revision: 0 })).status, 409);
  assert.equal((await call('POST', { action: 'import', accountId: b, records: { [buddy]: { selected: 'made-up', favorites: [] } } })).status, 400);
  assert.equal((await call('POST', undefined, undefined, (async function* () { yield '{'; authenticated = false; yield '}'; })())).status, 401);
});

test('an online SQLite snapshot includes committed WAL records and can restore personal data', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-personal-backup-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'live.sqlite'), copy = join(dir, 'backup.sqlite');
  const store = new PersonalStore(file); t.after(() => store.close());
  store.save(a, pokemon, [discovery(1000)], 0); store.save(a, appearance, DEFAULT_APPEARANCE, 0);
  const reader = new DatabaseSync(file, { readOnly: true });
  try { await backup(reader, copy); } finally { reader.close(); }
  const restored = new PersonalStore(copy); t.after(() => restored.close());
  assert.deepEqual(restored.snapshot(a), store.snapshot(a));
});
