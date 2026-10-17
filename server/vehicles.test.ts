import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VehicleFleet } from './vehicles.ts';
import { VEHICLE_KINDS, VEHICLE_DOCKS, VEHICLES } from '../src/game/transport.ts';
import type { Player } from '../src/network/protocol.ts';
const person = (id: string, x = 5, y = 12): Player => ({ id, slot: 1, name: id, outfit: 0, roomId: 'office', x, y, facing: 'down' });
test('finite fleet cannot be oversubscribed and returns exactly one lease per rider', () => {
  for (const kind of VEHICLE_KINDS) {
    const fleet = new VehicleFleet(), dock = VEHICLE_DOCKS.find((d) => d.kind === kind)!;
    const people = Array.from({ length: 4 }, (_, i) => person(String(i), dock.x, dock.y - 1));
    for (const p of people.slice(0, 3)) assert.equal(fleet.take(p, kind), undefined);
    assert.equal(new Set(people.slice(0, 3).map((p) => p.riding!.id)).size, VEHICLES[kind].count);
    assert.ok(fleet.take(people[3], kind)); assert.equal(people[3].riding, undefined);
    assert.ok(fleet.take(people[0], kind));
    const id = people[0].riding!.id;
    assert.equal(fleet.return(people[0]), undefined); assert.equal(people[0].riding, undefined);
    assert.equal(fleet.take(people[3], kind), undefined); assert.equal(people[3].riding!.id, id);
    fleet.release(people[3]); fleet.release(people[3]);
    assert.equal(fleet.list().filter((u) => u.kind === kind && !u.riderId).length, 1);
  }
});
test('pickup and return require the proper nearby dock; disconnect release works from any room', () => {
  const fleet = new VehicleFleet(), p = person('p', 15, 12);
  assert.ok(fleet.take(p, 'bike')); assert.equal(p.riding, undefined);
  p.x = 5; assert.equal(fleet.take(p, 'bike'), undefined);
  p.roomId = 'garden'; assert.ok(fleet.return(p)); assert.ok(p.riding);
  assert.equal(fleet.list().filter((u) => u.riderId === p.id).length, 1);
  const copy = fleet.list(); copy[0].riderId = 'spoof'; assert.notEqual(fleet.list()[0].riderId, 'spoof');
  fleet.release(p); assert.equal(p.riding, undefined); assert.equal(fleet.list().filter((u) => !u.riderId).length, 9);
});

test('pad entry automatically borrows or returns once, rearms only after leaving, and preserves finite stock', () => {
  const fleet = new VehicleFleet(), p = person('p', 3, 14);
  assert.equal(fleet.touch(p), true); assert.equal(p.riding?.kind, 'bike');
  p.x = 4; assert.equal(fleet.touch(p), false); assert.equal(p.riding?.kind, 'bike');
  p.y = 13; assert.equal(fleet.touch(p), false);
  p.y = 14; assert.equal(fleet.touch(p), true); assert.equal(p.riding, undefined);
  p.x = 5; assert.equal(fleet.touch(p), false); assert.equal(p.riding, undefined);
  p.x = 6; fleet.touch(p); p.x = 7; assert.equal(fleet.touch(p), true); assert.equal((p as Player).riding?.kind, 'skateboard');
  p.x = 6; fleet.touch(p); p.x = 5; assert.equal(fleet.touch(p), true); assert.equal(p.riding, undefined);
  fleet.forget(p); assert.equal(fleet.list().filter((u) => !u.riderId).length, 9);
  const riders = Array.from({ length: 4 }, (_, i) => person(`r${i}`, 3, 14));
  assert.deepEqual(riders.map((r) => fleet.touch(r)), [true, true, true, false]);
  assert.equal(fleet.touch(riders[3]), false); assert.equal(riders[3].riding, undefined);
});
