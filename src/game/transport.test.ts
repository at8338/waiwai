import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { VEHICLE_KINDS, VEHICLES, VEHICLE_DOCKS, movementStep, nearVehicleDock } from './transport.ts';
import { vehiclePixels } from './vehicle-art.ts';
import { Walker, STEP_MS, canWalk } from './world.ts';
import { parseClientMessage, directions } from '../network/protocol.ts';

test('docks require approaching the correct parking place and keep paths open', () => {
  for (const dock of VEHICLE_DOCKS) {
    assert.equal(canWalk(dock.x, dock.y), false);
    assert.equal(canWalk(dock.x, dock.y - 1), true);
    assert.equal(nearVehicleDock({ roomId: 'office', x: dock.x, y: dock.y - 1 }, dock.kind), true);
    assert.equal(nearVehicleDock({ roomId: 'garden', x: dock.x, y: dock.y - 1 }, dock.kind), false);
    assert.equal(nearVehicleDock({ roomId: 'office', x: dock.x, y: dock.y - 3 }, dock.kind), false);
    assert.ok(movementStep(dock.kind) < STEP_MS);
  }
  assert.equal(movementStep(), STEP_MS);
});
test('vehicle input is validated and profiles cannot assign their own vehicle', () => {
  const actionId = randomUUID();
  for (const kind of VEHICLE_KINDS) assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'vehicle-take', kind, actionId })), { type: 'vehicle-take', kind, actionId });
  for (const kind of ['car', '__proto__', 'constructor', 1, null]) assert.equal(parseClientMessage(JSON.stringify({ type: 'vehicle-take', kind, actionId })), undefined);
  assert.equal(parseClientMessage(JSON.stringify({ type: 'vehicle-return', actionId: 'bad' })), undefined);
  const profile = parseClientMessage(JSON.stringify({ type: 'profile', name: 'a', outfit: 0, riding: { id: 'bike-1', kind: 'bike' } }));
  assert.ok(profile && !('riding' in profile));
});
test('vehicle artwork fits its canvas in all directions and movement frames', () => {
  const distinct = new Set();
  for (const kind of VEHICLE_KINDS) {
    distinct.add(JSON.stringify(vehiclePixels(kind)));
    for (const direction of directions) for (let frame = 0; frame < 3; frame++) for (const p of vehiclePixels(kind, direction, frame)) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 32 && p.y + p.h <= 20 && p.w > 0 && p.h > 0, `${kind}: ${JSON.stringify(p)}`);
    }
  }
  assert.equal(distinct.size, 3);
});
test('changing ride speed preserves interpolation progress', () => {
  const walker = new Walker(); walker.receive({ x: 5, y: 12 }, 'left', true); walker.receive({ x: 4, y: 12 }, 'left');
  walker.update(STEP_MS / 2); const before = walker.position(); walker.setStepMs(VEHICLES.bike.stepMs);
  assert.deepEqual(walker.position(), before); walker.update(VEHICLES.bike.stepMs / 2); assert.equal(walker.moving, false);
});
