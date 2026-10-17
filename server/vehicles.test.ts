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

test('dropped vehicles remain after the former rider leaves and can be claimed once by anyone nearby', () => {
  for (const kind of VEHICLE_KINDS) {
    const fleet = new VehicleFleet(), dock = VEHICLE_DOCKS.find((d) => d.kind === kind)!;
    const owner = person('owner', dock.x, dock.y - 1);
    assert.equal(fleet.take(owner, kind), undefined);
    const id = owner.riding!.id;
    Object.assign(owner, { roomId: 'canteen', x: 15, y: 17 });
    assert.equal(fleet.drop(owner), undefined); assert.equal(owner.riding, undefined);
    assert.deepEqual(fleet.list().find((u) => u.id === id)?.ground, { roomId: 'canteen', x: 15, y: 17 });
    assert.equal(fleet.list().filter((u) => u.kind === kind && !u.riderId && !u.ground).length, 2);
    fleet.forget(owner);
    assert.ok(fleet.list().find((u) => u.id === id)?.ground);
    const snapshot = fleet.list(); snapshot.find((u) => u.id === id)!.ground!.x = 1;
    assert.equal(fleet.list().find((u) => u.id === id)!.ground!.x, 15);
    const a = { ...person('a', 14, 17), roomId: 'canteen' as const }, b = { ...person('b', 16, 17), roomId: 'canteen' as const };
    assert.equal(fleet.pickup(a, id), undefined); assert.ok(fleet.pickup(b, id));
    assert.equal(a.riding?.id, id); assert.equal(fleet.list().find((u) => u.id === id)?.ground, undefined);
    assert.equal(fleet.list().length, 9);
  }
});

test('dropping latches contact until leaving, then touching the same floor vehicle mounts again', () => {
  const fleet = new VehicleFleet(), p = person('p'); fleet.take(p, 'bike');
  Object.assign(p, { roomId: 'library', x: 15, y: 17 });
  const id = p.riding!.id; assert.equal(fleet.drop(p), undefined);
  for (let i = 0; i < 5; i++) { assert.equal(fleet.touch(p), false); assert.equal(p.riding, undefined); }
  p.x--; assert.equal(fleet.touch(p), false);
  p.x++; assert.equal(fleet.touch(p), true); assert.equal(p.riding?.id, id);
  assert.equal(fleet.list().find((u) => u.id === id)?.ground, undefined);
});

test('floor pickup rejects remote locations and occupied floor drops preserve both leases', () => {
  const fleet = new VehicleFleet(), a = person('a'), b = person('b');
  fleet.take(a, 'bike'); fleet.take(b, 'bike'); const bId = b.riding!.id;
  Object.assign(a, { roomId: 'garden', x: 15, y: 17 });
  const id = a.riding!.id; fleet.drop(a);
  const remote = person('remote', 15, 17);
  assert.ok(fleet.pickup(remote, id)); remote.roomId = 'garden'; remote.x = 12; assert.ok(fleet.pickup(remote, id));
  Object.assign(b, { roomId: 'garden', x: 15, y: 17 });
  assert.ok(fleet.drop(b)); assert.equal(b.riding?.id, bId);
  assert.ok(fleet.list().find((u) => u.id === id)?.ground);
  b.x--; assert.equal(fleet.drop(b), undefined);
  assert.equal(fleet.list().filter((u) => u.ground).length, 2);
});

test('dropping on a dock returns the unit and cannot create a floor copy or immediate remount', () => {
  const fleet = new VehicleFleet(), p = person('p', 3, 13); fleet.take(p, 'bike');
  p.y = 14; assert.equal(fleet.drop(p), undefined); assert.equal(p.riding, undefined);
  assert.equal(fleet.touch(p), false);
  assert.ok(fleet.list().every((u) => !u.ground && !u.riderId));
});
