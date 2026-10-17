import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDDY_KINDS, buddyPixels, BUDDY_WIDTH, BUDDY_HEIGHT, isBuddyKind } from './buddies.ts';
import { parseClientMessage, directions } from '../network/protocol.ts';
import { Walker } from './world.ts';
test('all eight companions have distinct bounded pixel art in every animation frame', () => {
  const distinct = new Set();
  for (const kind of BUDDY_KINDS) {
    distinct.add(JSON.stringify(buddyPixels(kind)));
    for (const direction of directions) for (let frame = 0; frame < 3; frame++) {
      for (const p of buddyPixels(kind, direction, frame)) {
        assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0);
        assert.ok(p.x + p.w <= BUDDY_WIDTH && p.y + p.h <= BUDDY_HEIGHT, `${kind}: ${JSON.stringify(p)}`);
      }
    }
  }
  assert.equal(distinct.size, 8);
  assert.equal(isBuddyKind('__proto__'), false);
});
test('buddy profile validates choices and ignores client supplied coordinates', () => {
  const base = { type: 'profile', name: 'test', outfit: 0 };
  for (const buddy of [...BUDDY_KINDS, null]) {
    const parsed = parseClientMessage(JSON.stringify({ ...base, buddy, buddyPosition: { x: 99, y: 99 } }));
    assert.ok(parsed?.type === 'profile'); assert.equal(parsed.buddy, buddy); assert.equal('buddyPosition' in parsed, false);
  }
  for (const buddy of ['__proto__', 'constructor', 'dragon', 1, {}, []]) assert.equal(parseClientMessage(JSON.stringify({ ...base, buddy })), undefined);
  assert.equal('buddy' in parseClientMessage(JSON.stringify(base))!, false);
});
test('pet interpolation can use a slower cadence without changing avatar movement', () => {
  const pet = new Walker(650); pet.receive({ x: 7, y: 15 }, 'right', true); pet.receive({ x: 8, y: 15 }, 'right');
  pet.update(325); assert.equal(pet.position().x, 8 * 16); assert.equal(pet.moving, true);
  pet.update(325); assert.equal(pet.moving, false);
});
