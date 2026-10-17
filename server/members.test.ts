import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemberStore } from './members.ts';

const hana = { name: 'はな', slack: { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' } };

test('verified members persist, rename without duplicates, and survive concurrent registrations', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-members-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'members.json'), store = new MemberStore(file);
  await Promise.all([store.remember(hana), store.remember({ ...hana, name: 'はな 新しい名前' }), store.remember({ ...hana, slack: { ...hana.slack, userId: 'U999ABCDEF' } })]);
  const restored = new MemberStore(file).list();
  assert.equal(restored.length, 2);
  assert.equal(restored.find((m) => m.slack.userId === hana.slack.userId)!.name, 'はな 新しい名前');
  const saved = await readFile(file, 'utf8');
  assert.equal(JSON.parse(saved).version, 1);
  assert.ok(!/cookie|session|token|expires|roomId/.test(saved));
});

test('failed saves do not commit members and corrupted directories are preserved', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-members-failure-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'members.json'); await writeFile(file, '{"version":1,"members":[]}');
  const store = new MemberStore(file); await rm(file); await mkdir(file);
  await assert.rejects(store.remember(hana)); assert.equal(store.list().length, 0);
  await rm(file, { recursive: true }); await store.remember(hana);
  assert.equal(new MemberStore(file).list().length, 1);
  await writeFile(file, '{"version":1,"members":[{"id":"forged","name":"はな","slack":{"teamId":"T012ABCDEF","userId":"U012ABCDEF"}}]}');
  assert.throws(() => new MemberStore(file), /Cannot load/);
  assert.match(await readFile(file, 'utf8'), /forged/);
});
