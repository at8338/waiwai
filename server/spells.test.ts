import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { callDestinations, fireDestination } from './spells.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import type { Player } from '../src/network/protocol.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { voiceZone } from '../src/audio/proximity.ts';
const person = (id = randomUUID()): Player => ({ id, slot: 1, name: 'test', outfit: 0, roomId: 'office', x: 15, y: 12, facing: 'left' });
test('spell messages validate targets, bounded batches and ids while discarding forged effects and coordinates', () => {
  const actionId = randomUUID(), targetId = randomUUID();
  const fire = { type: 'spell-cast', spell: 'fire', actionId };
  assert.deepEqual(parseClientMessage(JSON.stringify({ ...fire, x: 999, roomId: 'cafe', damage: 999 })), fire);
  assert.ok(parseClientMessage(JSON.stringify({ type: 'spell-cast', spell: 'call', actionId, targetIds: Array.from({ length: 20 }, () => randomUUID()) })));
  for (const action of [{ spell: 'unknown' }, { spell: 'rura', targetId: 'other' }, { spell: 'call', targetIds: [] }, { spell: 'call', targetIds: [targetId, targetId] }, { spell: 'call', targetIds: Array.from({ length: 21 }, () => randomUUID()) }])
    assert.equal(parseClientMessage(JSON.stringify({ ...fire, ...action })), undefined);
});
test('travel prefers free neighbors, shares occupied neighbors when necessary, and falls back to the anchor on solid sides', () => {
  const caster = person(), targets = Array.from({ length: 20 }, () => ({ ...person(), roomId: 'cafe' as const }));
  const bystander = { ...person(), x: 14, y: 12 };
  const plan = callDestinations(caster, targets, [caster, bystander, ...targets], [])!;
  assert.equal(plan.length, 20); assert.equal(new Set(plan.slice(0, 3).map((point) => `${point.x},${point.y}`)).size, 3);
  assert.ok(plan.slice(0, 3).every((point) => point.x !== 14 || point.y !== 12));
  for (const point of plan) { assert.ok(walkableWithObjects(point.x, point.y, caster.roomId, [])); assert.equal(voiceZone({ ...point, roomId: caster.roomId }), voiceZone(caster)); }
  const packed = Array.from({ length: 30 * 20 }, (_, i) => ({ ...person(), x: i % 30, y: Math.floor(i / 30) }));
  assert.equal(callDestinations(caster, targets, [caster, ...targets, ...packed], [])!.length, 20);
  const objects: RoomObject[] = [[-1, 0], [1, 0], [0, 1], [0, -1]].map(([dx, dy], i) => ({ id: String(i), owner: 'test', kind: 'plant', roomId: 'office', rotation: 0, x: caster.x + dx, y: caster.y + dy }));
  assert.deepEqual(callDestinations(caster, [targets[0]], [caster, ...targets], objects), [{ x: caster.x, y: caster.y }]);
});
test('fire follows the authoritative facing direction and stops at solid furniture', () => {
  const caster = person();
  const destination = fireDestination(caster, []); assert.ok(destination.x < caster.x); assert.equal(destination.y, caster.y);
  const blocked: RoomObject = { id: 'wall', owner: 'test', roomId: 'office', kind: 'plant', x: 14, y: 12, rotation: 0 };
  assert.deepEqual(fireDestination(caster, [blocked]), { x: caster.x, y: caster.y });
});
