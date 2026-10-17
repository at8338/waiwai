import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ObjectStore } from './objects.ts';
import type { RoomObject } from '../src/game/objects.ts';

test('object edits serialize, persist across restarts and do not commit failed writes', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-objects-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'objects.json');
  const store = new ObjectStore(file);
  const object = (x: number): RoomObject => ({ id: randomUUID(), owner: 'guest:' + randomUUID(), roomId: 'cafe', kind: 'books', x, y: 16, rotation: 0 });
  await Promise.all([store.transact((items) => items.push(object(8))), store.transact((items) => items.push(object(9)))]);
  assert.equal(new ObjectStore(file).list().length, 2);
  assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 1);
  await assert.rejects(store.transact(() => { throw new Error('Rejected edit'); }));
  assert.equal(store.list().length, 2);
  const invalidPath = join(dir, 'directory'); await mkdir(invalidPath);
  const failing = new ObjectStore();
  // A path that turns into a directory after initial load models a storage failure.
  const target = join(dir, 'failure.json'); await writeFile(target, '{"version":1,"objects":[]}');
  const diskFailure = new ObjectStore(target); await rm(target); await mkdir(target);
  await assert.rejects(diskFailure.transact((items) => items.push(object(10))));
  assert.equal(diskFailure.list().length, 0);
  assert.equal(failing.list().length, 0);
});

test('invalid saved state is preserved and rejected instead of being overwritten', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-objects-invalid-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'objects.json');
  await writeFile(file, 'broken-state');
  assert.throws(() => new ObjectStore(file), /Cannot load/);
  assert.equal(await readFile(file, 'utf8'), 'broken-state');
});
