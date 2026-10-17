import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOST_ITEM_CATALOG, LOST_ITEM_KINDS, LEGACY_LOST_ITEMS, LOST_ITEMS_EPOCH, LOST_ITEM_PERIOD_MS, MAX_LOST_ITEMS, lostItemsAt, lostItemsForOffice, lostItemsSnapshot, lostItemPixels } from './lost-items.ts';
import { drawLostKinds, lostItemWeight } from './lost-items.ts';
import { EXTRA_LOST_ITEMS } from './lost-items-catalog.ts';
import { LOST_ITEM_ARTS } from './lost-item-art.ts';
import { ROOMS } from './rooms.ts';
import { walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { seatSpots } from './seating.ts';
import { touchingVehicleDock } from './transport.ts';
const now = LOST_ITEMS_EPOCH + 7 * LOST_ITEM_PERIOD_MS + 10_000;
test('the entire building shares just three different kinds, one per kind and one per selected room', () => {
  const global = lostItemsForOffice(now);
  assert.equal(MAX_LOST_ITEMS, 3); assert.equal(global.length, 3);
  assert.equal(new Set(global.map((i) => i.kind)).size, 3); assert.equal(new Set(global.map((i) => i.roomId)).size, 3);
  assert.equal(new Set(global.map((i) => i.id)).size, 3);
  const rooms = ROOMS.flatMap((room) => lostItemsAt(room.id, now)); assert.deepEqual(rooms.sort((a, b) => a.id.localeCompare(b.id)), [...global].sort((a, b) => a.id.localeCompare(b.id)));
  assert.equal(ROOMS.filter((r) => !lostItemsAt(r.id, now).length).length, ROOMS.length - 3);
  assert.deepEqual(lostItemsForOffice(now + 1000), global);
  assert.notDeepEqual(lostItemsForOffice(now + LOST_ITEM_PERIOD_MS), global);
  assert.deepEqual(lostItemsForOffice(NaN), []);
});
test('weighted curiosities remain unique per period, cover every kind, and rare items appear less often', () => {
  const counts = new Map(LOST_ITEM_KINDS.map((kind) => [kind, 0]));
  for (let period = 0; period < 6000; period++) {
    const kinds = drawLostKinds(period); assert.equal(new Set(kinds).size, 3);
    for (const kind of kinds) counts.set(kind, counts.get(kind)! + 1);
  }
  assert.ok([...counts.values()].every((count) => count > 0));
  const average = (weight: number) => { const kinds = LOST_ITEM_KINDS.filter((kind) => lostItemWeight(kind) === weight); return kinds.reduce((sum, kind) => sum + counts.get(kind)!, 0) / kinds.length; };
  assert.ok(average(8) > average(1) * 4); assert.ok(average(8) > average(3));
  const before = lostItemsSnapshot(LOST_ITEMS_EPOCH - 1); assert.equal(before.items.length, 3); assert.equal(before.expiresAt, LOST_ITEMS_EPOCH);
  assert.deepEqual(lostItemsForOffice(now + 1), lostItemsForOffice(now));
  const forced = lostItemsForOffice(now, [], { salt: 3, kind: 'box', roomId: 'office' });
  assert.equal(forced.length, 3); assert.equal(forced.filter((item) => item.kind === 'box').length, 1); assert.equal(forced.find((item) => item.kind === 'box')!.roomId, 'office');
});
test('placements avoid fixed and movable furniture, seat approaches, parking and entrances without creating extra copies', () => {
  const items = lostItemsForOffice(now);
  for (const item of items) {
    const room = ROOMS.find((r) => r.id === item.roomId)!;
    assert.ok(walkableWithObjects(item.x, item.y, item.roomId, []));
    assert.ok(!seatSpots(item.roomId, []).has(`${item.x},${item.y}`)); assert.equal(touchingVehicleDock(item), undefined);
    assert.ok([room.spawn, room.door].every((p) => Math.abs(item.x - p.x) + Math.abs(item.y - p.y) > 2));
    const object: RoomObject = { id: 'test', owner: 'test', kind: 'mug', roomId: item.roomId, x: item.x, y: item.y, rotation: 0 };
    const relocated = lostItemsForOffice(now, [object]); assert.equal(relocated.length, 3);
    const same = relocated.find((i) => i.id === item.id)!; assert.equal(same.kind, item.kind); assert.equal(same.roomId, item.roomId); assert.ok(same.x !== item.x || same.y !== item.y);
    assert.equal(relocated.filter((i) => i.kind === item.kind).length, 1);
    for (const other of items.filter((i) => i.id !== item.id)) assert.deepEqual(relocated.find((i) => i.id === other.id), other);
    // Placing an unrelated small object must not reshuffle an existing object.
    const free = Array.from({ length: 300 }, (_, i) => ({ x: i % 25 + 2, y: Math.floor(i / 25) + 2 })).find((p) => walkableWithObjects(p.x, p.y, item.roomId, []) && (p.x !== item.x || p.y !== item.y))!;
    assert.deepEqual(lostItemsForOffice(now, [{ ...object, ...free }]), items);
  }
});
test('a completely occupied selected floor suppresses its item rather than cloning it in another room', () => {
  const [item] = lostItemsForOffice(now), objects: RoomObject[] = [];
  for (let y = 2; y < 18; y++) for (let x = 2; x < 28; x++) objects.push({ id: `${x},${y}`, roomId: item.roomId, owner: 'test', kind: 'mug', x, y, rotation: 0 });
  const result = lostItemsForOffice(now, objects); assert.equal(result.length, 2); assert.ok(!result.some((i) => i.kind === item.kind));
});
test('365 individually authored additions preserve the original ten and have unique titles, notes and bounded pixel variants', () => {
  assert.equal(EXTRA_LOST_ITEMS.length, 365); assert.equal(Object.keys(LEGACY_LOST_ITEMS).length, 10); assert.equal(LOST_ITEM_KINDS.length, 375);
  assert.equal(new Set(Object.values(LOST_ITEM_CATALOG).map((v) => v.name)).size, 375); assert.equal(new Set(Object.values(LOST_ITEM_CATALOG).map((v) => v.note)).size, 375);
  const drawings = new Set();
  for (const kind of LOST_ITEM_KINDS) {
    const entry = LOST_ITEM_CATALOG[kind], pixels = lostItemPixels(kind); drawings.add(JSON.stringify(pixels));
    assert.ok(entry.note.length > 10 && entry.note.length < 100); assert.ok(entry.name.length > 3 && entry.name.length < 50);
    assert.ok(LOST_ITEM_ARTS.includes(entry.art)); assert.ok(pixels.length > 0);
    for (const p of pixels) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 16 && p.y + p.h <= 16 && p.color >= 0 && p.color <= 0xffffff);
  }
  assert.equal(drawings.size, 375); assert.equal(LOST_ITEM_ARTS.length, 40);
  assert.equal(LOST_ITEM_CATALOG.box.name, '月曜日のやる気（未開封）'); assert.equal(LOST_ITEM_CATALOG.screw.note, '今日は、何にも締めつけられたくないそうです。');
  assert.equal(LOST_ITEM_CATALOG['curio-365'].name, '拾った人へのお礼の手紙');
});
