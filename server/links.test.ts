import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { LinkStore } from './links.ts';

test('shared favorites and multi-link assignments serialize and survive restart; failed edits leave committed state intact', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-links-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'links.json'); const store = new LinkStore(file);
  const favorites = [0, 1].map((i) => ({ id: randomUUID(), title: `Tool ${i}`, url: `https://example.com/${i}` }));
  await Promise.all(favorites.map((f) => store.transact((s) => s.favorites.push(f))));
  await store.transact((s) => s.bindings.push({ roomId: 'office', objectId: 'fixed:office:desk:2:3', linkIds: favorites.map((f) => f.id) }));
  assert.deepEqual(new LinkStore(file).list(), store.list());
  const before = await readFile(file, 'utf8');
  await assert.rejects(store.transact((s) => s.favorites.push(favorites[0])));
  assert.equal(await readFile(file, 'utf8'), before);
  await rm(file); await mkdir(file);
  await assert.rejects(store.transact((s) => { s.bindings = []; }));
  assert.equal(store.list().bindings.length, 1);
  await rm(file, { recursive: true });
  await store.transact((s) => { s.bindings = []; });
  assert.equal(new LinkStore(file).list().bindings.length, 0);
});

test('corrupt link data is rejected without overwriting the file', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-links-invalid-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'links.json'); await writeFile(file, 'broken');
  assert.throws(() => new LinkStore(file), /Cannot load object links/);
  assert.equal(await readFile(file, 'utf8'), 'broken');
});
