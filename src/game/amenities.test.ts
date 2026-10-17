import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vendingInReach } from './amenities.ts';
import { getRoom } from './rooms.ts';
import { placementProblem } from './objects.ts';
import { VEHICLE_DOCKS } from './transport.ts';
import { randomUUID } from 'node:crypto';
test('vending machines are in cafe and wellness and require immediate contact in that room', () => {
  for (const roomId of ['cafe', 'wellness'] as const) {
    const f = getRoom(roomId).furniture.find((f) => f.kind === 'vending')!;
    assert.ok(f.x + f.w === 29);
    assert.ok(vendingInReach({ roomId, x: f.x - 1, y: f.y }));
    assert.equal(vendingInReach({ roomId, x: f.x - 2, y: f.y }), undefined);
    assert.equal(vendingInReach({ roomId: 'library', x: f.x - 1, y: f.y }), undefined);
  }
});
test('walkable vehicle pads stay reserved against furniture placement', () => {
  for (const dock of VEHICLE_DOCKS) assert.match(placementProblem({ id: randomUUID(), owner: 't', kind: 'mug', roomId: 'office', x: dock.x, y: dock.y, rotation: 0 }, [])!, /置き場/);
});
