import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { seatSpots, restingSeat } from './seating.ts';
import { DEFAULT_APPEARANCE, avatarPixels } from './avatar.ts';
import type { RoomObject } from './objects.ts';
import { ROOMS } from './rooms.ts';
import { walkableWithObjects } from './objects.ts';
test('fixed desks and table chairs have reachable seating positions and moving, reactions or riding stand up', () => {
  const seats = seatSpots('office', []), desk = seats.get('3,5')!;
  assert.equal(desk.id, 'fixed:office:desk:2:3'); assert.equal(desk.facing, 'up');
  assert.equal(restingSeat(seats, { x: 3, y: 5 }, false, false, false), desk);
  assert.equal(restingSeat(seats, { x: 3, y: 5 }, true, false, false), undefined);
  assert.equal(restingSeat(seats, { x: 3, y: 5 }, false, true, false), undefined);
  assert.equal(restingSeat(seats, { x: 3, y: 5 }, false, false, true), undefined);
  assert.equal(restingSeat(seats, { x: 2, y: 5 }, false, false, false), undefined);
  assert.ok([...seatSpots('meeting', []).values()].some((s) => s.name === 'テーブル'));
  for (const room of ROOMS) for (const seat of seatSpots(room.id, []).values()) {
    assert.ok(walkableWithObjects(seat.approach.x, seat.approach.y, room.id, []));
  }
});
test('placed chairs and desks rotate their approach and direction and disappear when removed or blocked', () => {
  const chair: RoomObject = { id: randomUUID(), kind: 'chair', owner: 'test', roomId: 'library', x: 16, y: 12, rotation: 0 };
  for (const [rotation, point, facing] of [[0, '16,13', 'down'], [1, '15,12', 'left'], [2, '16,11', 'up'], [3, '17,12', 'right']] as const) {
    const object = { ...chair, rotation }, seat = seatSpots('library', [object]).get(point)!;
    assert.equal(seat.id, `placed:${chair.id}`); assert.equal(seat.facing, facing);
  }
  const desk = { ...chair, kind: 'desk' as const, x: 11, y: 12 };
  assert.equal(seatSpots('library', [desk]).get('12,14')?.facing, 'up');
  assert.equal(seatSpots('library', [{ ...desk, rotation: 1 }]).get('10,13')?.facing, 'right');
  assert.equal(seatSpots('library', [chair, { ...chair, id: randomUUID(), kind: 'plant', y: 13 }]).has('16,13'), false);
  assert.ok(![...seatSpots('library', []).values()].some((s) => s.id === `placed:${chair.id}`));
  assert.ok(![...seatSpots('cafe', [chair]).values()].some((s) => s.id === `placed:${chair.id}`));
});
test('sitting has bent legs and a distinct silhouette while retaining appearance', () => {
  for (const direction of ['up', 'down', 'left', 'right']) {
    assert.notDeepEqual(avatarPixels(DEFAULT_APPEARANCE, direction, 0, 'sit'), avatarPixels(DEFAULT_APPEARANCE, direction));
    assert.notDeepEqual(avatarPixels({ ...DEFAULT_APPEARANCE, heldItem: 2 }, direction, 0, 'sit'), avatarPixels(DEFAULT_APPEARANCE, direction, 0, 'sit'));
  }
});

test('long sofas support neighboring seated avatars and remain room scoped', () => {
  const seats = seatSpots('office', []);
  const left = seats.get('20,17')!, right = seats.get('21,17')!;
  assert.equal(left.name, 'ソファ'); assert.equal(right.name, 'ソファ');
  assert.notEqual(left.id, right.id); assert.equal(left.facing, 'down');
  assert.equal(left.anchor.y, right.anchor.y); assert.equal(right.anchor.x - left.anchor.x, 16);
  assert.equal(seats.has('20,18'), false);
  assert.equal(seatSpots('library', []).get('20,17'), undefined);
});
