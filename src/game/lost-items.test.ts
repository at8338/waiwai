import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOST_ITEM_CATALOG, LOST_ITEM_PERIOD_MS, lostItemsAt, lostItemPixels } from './lost-items.ts';
import type { LostItemKind } from './lost-items.ts';
import { ROOMS } from './rooms.ts';
import { walkableWithObjects } from './objects.ts';
import { randomUUID } from 'node:crypto';
test('lost items are shared, vary by time and room, never block entrances or overlap furniture', () => {
  const now = Date.UTC(2026, 9, 17, 5);
  const states = new Set();
  for (const room of ROOMS) {
    const items = lostItemsAt(room.id, now);
    assert.deepEqual(lostItemsAt(room.id, now + 1_000), items);
    assert.equal(items.length, 3); assert.equal(new Set(items.map((i) => `${i.x},${i.y}`)).size, 3);
    assert.equal(new Set(items.map((i) => i.kind)).size, 3);
    for (const item of items) {
      assert.ok(walkableWithObjects(item.x, item.y, room.id, []));
      assert.ok(Math.abs(item.x - room.spawn.x) + Math.abs(item.y - room.spawn.y) > 2);
    }
    states.add(JSON.stringify(items));
    assert.notDeepEqual(lostItemsAt(room.id, now + LOST_ITEM_PERIOD_MS), items);
    const blocked = items[0];
    assert.ok(!lostItemsAt(room.id, now, [{ id: randomUUID(), kind: 'mug', owner: 't', roomId: room.id, x: blocked.x, y: blocked.y, rotation: 0 }]).some((i) => i.x === blocked.x && i.y === blocked.y));
  }
  assert.equal(states.size, ROOMS.length);
});
test('all curious lost items have distinct bounded pixel art and readable descriptions', () => {
  const drawings = new Set();
  for (const kind of Object.keys(LOST_ITEM_CATALOG) as LostItemKind[]) {
    const pixels = lostItemPixels(kind); drawings.add(JSON.stringify(pixels));
    assert.ok(LOST_ITEM_CATALOG[kind].note.length > 10);
    for (const p of pixels) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 16 && p.y + p.h <= 16);
  }
  assert.equal(drawings.size, Object.keys(LOST_ITEM_CATALOG).length);
});
