import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoomPets, resetBuddy, advanceBuddy } from './companions.ts';
import { ROOMS } from '../src/game/rooms.ts';
import { canWalk } from '../src/game/world.ts';
import type { Player } from '../src/network/protocol.ts';
import type { RoomObject } from '../src/game/objects.ts';
const player = (): Player => ({ id: 'test', slot: 1, name: 'test', outfit: 0, roomId: 'office', x: 15, y: 12, facing: 'down', buddy: 'robot' });
test('buddy follows actual previous tiles around corners; resets and unequips safely', () => {
  const p = player(); resetBuddy(p, []); assert.deepEqual(p.buddyPosition, { x: 15, y: 11, facing: 'down' });
  p.x = 16; p.facing = 'right'; advanceBuddy(p, { x: 15, y: 12 });
  assert.deepEqual(p.buddyPosition, { x: 15, y: 12, facing: 'down' });
  p.y = 13; p.facing = 'down'; advanceBuddy(p, { x: 16, y: 12 });
  assert.deepEqual(p.buddyPosition, { x: 16, y: 12, facing: 'right' });
  const object: RoomObject = { id: 'obstacle', owner: 'test', roomId: 'office', kind: 'plant', x: 16, y: 12, rotation: 0 };
  resetBuddy(p, [object]); assert.notDeepEqual([p.buddyPosition!.x, p.buddyPosition!.y], [16, 12]);
  p.roomId = 'garden'; p.x = 15; p.y = 16; resetBuddy(p, []); assert.ok(canWalk(p.buddyPosition!.x, p.buddyPosition!.y, 'garden'));
  p.buddy = null; resetBuddy(p, []); assert.equal(p.buddyPosition, undefined);
});
test('every room shares two wandering animals that avoid walls, furniture and people', () => {
  let seed = 15;
  const pets = new RoomPets(() => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; });
  let moved = false;
  const person = player();
  for (let step = 0; step < 100; step++) {
    const before = new Map(ROOMS.flatMap((room) => pets.list(room.id)).map((p) => [p.id, p]));
    pets.step([], [person]);
    for (const room of ROOMS) {
      const animals = pets.list(room.id); assert.equal(animals.length, 2); assert.deepEqual(animals.map((p) => p.kind), ['dog', 'cat']);
      for (const pet of animals) {
        assert.ok(canWalk(pet.x, pet.y, room.id));
        assert.ok(Math.abs(pet.x - room.door.x) + Math.abs(pet.y - room.door.y) > 1);
        const previous = before.get(pet.id)!;
        const distance = Math.abs(pet.x - previous.x) + Math.abs(pet.y - previous.y); assert.ok(distance <= 1); moved ||= distance === 1;
        if (room.id === person.roomId) assert.ok(pet.x !== person.x || pet.y !== person.y);
      }
      assert.notDeepEqual([animals[0].x, animals[0].y], [animals[1].x, animals[1].y]);
    }
  }
  assert.ok(moved);
  const animal = pets.list('office')[0];
  const obstacle: RoomObject = { id: 'obstacle', owner: 'test', roomId: 'office', kind: 'plant', x: animal.x, y: animal.y, rotation: 0 };
  pets.step([obstacle], []); assert.notDeepEqual([pets.list('office')[0].x, pets.list('office')[0].y], [animal.x, animal.y]);
  const copy = pets.list('office'); copy[0].x = 999; assert.notEqual(pets.list('office')[0].x, 999);
});
