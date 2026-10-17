import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AnnouncementStore } from './announcements.ts';
import { DAY, MINUTE, parseJstInput } from '../src/game/announcements.ts';
import type { ScheduleDraft } from '../src/game/announcements.ts';
const start = parseJstInput('2026-10-19T10:00')!;
const schedule: ScheduleDraft = { title: '全体会議', message: '作戦室へどうぞ。', startsAt: start, repeat: 'weekly', leadMinutes: 5, displayMinutes: 3, enabled: true };
test('scheduled delivery and its occurrence marker persist atomically and do not duplicate after restart or dismissal', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-announcements-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'state.json'); let now = start - 6 * MINUTE;
  let store = new AnnouncementStore(file, () => now); const id = randomUUID();
  await store.apply({ type: 'schedule-save', id, expectedVersion: 0, schedule, actionId: randomUUID() }, 'はな');
  assert.equal(store.snapshot().announcements.length, 0);
  now += MINUTE; assert.equal(await store.tick(), true); assert.equal(store.snapshot().announcements.length, 1);
  assert.equal(store.snapshot().announcements[0].author, 'はな');
  store = new AnnouncementStore(file, () => now); assert.equal(await store.tick(), false); assert.equal(store.snapshot().announcements.length, 1);
  await store.apply({ type: 'announcement-dismiss', id: store.snapshot().announcements[0].id, actionId: randomUUID() }, '別の人');
  assert.equal(await store.tick(), false); assert.equal(store.snapshot().announcements.length, 0);
  now += 7 * DAY; await store.tick(); assert.equal(store.snapshot().announcements.length, 1);
  assert.equal(store.snapshot().announcements[0].occurrence, start + 7 * DAY);
  now = start + 7 * DAY + 3 * MINUTE; await store.tick(); assert.equal(store.snapshot().announcements.length, 0);
});
test('any participant can edit, pause and delete; stale concurrent edits cannot overwrite a newer schedule', async () => {
  let now = start - MINUTE; const store = new AnnouncementStore(undefined, () => now), id = randomUUID();
  const action = { type: 'schedule-save' as const, id, expectedVersion: 0, schedule, actionId: randomUUID() };
  await store.apply(action, 'はな');
  await assert.rejects(store.apply(action, '重複'), /更新/);
  await store.apply({ ...action, expectedVersion: 1, schedule: { ...schedule, title: '新しい会議名' } }, 'たろう');
  assert.equal(store.snapshot().announcements[0].title, '新しい会議名');
  assert.equal(store.snapshot().schedules[0].updatedBy, 'たろう');
  await store.apply({ ...action, expectedVersion: 2, schedule: { ...schedule, enabled: false } }, '別の人');
  assert.equal(store.snapshot().announcements.length, 0);
  await store.apply({ ...action, expectedVersion: 3 }, 'はな');
  assert.equal(store.snapshot().announcements.length, 0); // Same occurrence was already delivered.
  await store.apply({ type: 'schedule-delete', id, expectedVersion: 4, actionId: randomUUID() }, '別の人');
  assert.equal(store.snapshot().schedules.length, 0);
  now = start + 10 * MINUTE;
  await assert.rejects(store.apply({ ...action, schedule: { ...schedule, repeat: 'once' } }, 'はな'), /開始日時/);
  const copy = store.snapshot(); copy.schedules.push({ ...schedule, id, version: 1, updatedBy: 'fake' }); assert.equal(store.snapshot().schedules.length, 0);
});
test('failed persistence leaves previous state intact and a due meeting can retry; corrupt files are preserved', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-announcements-fail-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'state.json'); let now = start - 6 * MINUTE;
  const store = new AnnouncementStore(file, () => now);
  await store.apply({ type: 'schedule-save', id: randomUUID(), expectedVersion: 0, schedule, actionId: randomUUID() }, 'はな');
  const before = await readFile(file, 'utf8'); await rm(file); await mkdir(file); now += MINUTE;
  await assert.rejects(store.tick()); assert.equal(store.snapshot().announcements.length, 0); assert.equal(store.snapshot().schedules[0].lastOccurrence, undefined);
  await rm(file, { recursive: true }); await store.tick(); assert.equal(store.snapshot().announcements.length, 1);
  await writeFile(file, 'broken'); assert.throws(() => new AnnouncementStore(file), /Cannot load/); assert.equal(await readFile(file, 'utf8'), 'broken'); assert.ok(before.includes('全体会議'));
});
test('manual broadcasts expire, have a bounded active count, and rejected connections cannot publish', async () => {
  let now = start; const store = new AnnouncementStore(undefined, () => now);
  const action = { type: 'announcement-publish' as const, title: '放送', message: '会議です', durationMinutes: 1, actionId: randomUUID() };
  await assert.rejects(store.apply(action, 'expired', () => false), /接続/);
  await Promise.all(Array.from({ length: 5 }, () => store.apply({ ...action, actionId: randomUUID() }, 'はな')));
  await assert.rejects(store.apply(action, 'はな'), /5件/); assert.equal(store.snapshot().announcements.length, 5);
  now += MINUTE; await store.tick(); assert.equal(store.snapshot().announcements.length, 0);
  await store.apply(action, 'はな'); assert.equal(store.snapshot().announcements.length, 1);
});

test('arena results are deduplicated, expire after three minutes and retain the manual announcement quota', async () => {
  let now = start; const store = new AnnouncementStore(undefined, () => now), id = randomUUID();
  await store.publishArena(id, 'アリスさんの勝ち'); await store.publishArena(id, '重複'); assert.equal(store.snapshot().announcements.length, 1);
  for (let i = 0; i < 5; i++) await store.apply({ type: 'announcement-publish', title: '会議', message: '集合', durationMinutes: 5, actionId: randomUUID() }, 'はな');
  for (let i = 0; i < 6; i++) await store.publishArena(randomUUID(), '次の対戦結果');
  assert.equal(store.snapshot().announcements.filter(a => a.category === 'arena').length, 5); assert.equal(store.snapshot().announcements.length, 10);
  now += 3 * MINUTE; await store.tick(); assert.equal(store.snapshot().announcements.length, 5);
});
