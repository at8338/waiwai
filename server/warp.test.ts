import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adjacentTile } from './warp.ts';
import type { Player } from '../src/network/protocol.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import type { RoomObject } from '../src/game/objects.ts';

const target: Player = { id: 'target', slot: 1, name: 'はな', outfit: 0, roomId: 'cafe', x: 15, y: 17, facing: 'down' };
const prop = (x: number, y: number, roomId = target.roomId): RoomObject => ({ id: `${x},${y}`, owner: 'test', kind: 'chair', roomId, x, y, rotation: 0 });

test('warps choose an adjacent free tile, avoid people, furniture and portals, and fail when full', () => {
  assert.deepEqual(adjacentTile(target, 'traveler', [target], []), { x: 14, y: 17 });
  const occupied = { ...target, id: 'other', x: 14 };
  assert.deepEqual(adjacentTile(target, 'traveler', [target, occupied], []), { x: 16, y: 17 });
  assert.deepEqual(adjacentTile(target, 'other', [target, occupied], []), { x: 14, y: 17 });
  const objects = [prop(14, 17), prop(16, 17)];
  assert.deepEqual(adjacentTile(target, 'traveler', [target], objects), { x: 15, y: 16 });
  assert.equal(adjacentTile(target, 'traveler', [target], [...objects, prop(15, 16)]), undefined);
  const desk = { ...prop(12, 17), kind: 'desk' as const };
  assert.deepEqual(adjacentTile(target, 'traveler', [target], [desk]), { x: 16, y: 17 });
});

test('warps never cross office audio zones or accept arbitrary client coordinates', () => {
  const workTarget = { ...target, roomId: 'office' as const, x: 5, y: 9 };
  assert.equal(adjacentTile(workTarget, 'traveler', [workTarget], [prop(4, 9, 'office'), prop(6, 9, 'office'), prop(5, 8, 'office')]), undefined);
  assert.equal(parseClientMessage('{"type":"warp-to","targetId":"outside","x":1,"y":1,"requestId":1}'), undefined);
  const action = { type: 'warp-to', targetId: '00000000-0000-4000-8000-000000000000', requestId: 1 };
  assert.deepEqual(parseClientMessage(JSON.stringify({ ...action, x: 999, y: 999 })), action);
  assert.equal(parseClientMessage(JSON.stringify({ ...action, requestId: 0 })), undefined);
});
