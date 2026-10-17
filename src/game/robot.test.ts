import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ROBOT_ACTIONS, ROBOT_PARTS, isRobotAction, robotLocation } from './robot.ts';
import type { RobotAction } from './robot.ts';
import { robotPixels, cockpitFurniturePixels, cockpitHorizonPixels } from './robot-art.ts';
import { getRoom, ROOM_IDS } from './rooms.ts';
import { parseClientMessage } from '../network/protocol.ts';
import { seatSpots, restingSeat } from './seating.ts';
import { canWalk } from './world.ts';

test('all fifteen rooms have one robot location and the pilot seat uses a reachable approach', () => {
  const assigned = ROBOT_PARTS.flatMap((p) => [...p.rooms]);
  assert.deepEqual([...assigned].sort(), [...ROOM_IDS].sort()); assert.equal(new Set(assigned).size, ROOM_IDS.length);
  assert.equal(robotLocation('office'), '胴体'); assert.equal(robotLocation('cockpit'), '頭部');
  const room = getRoom('cockpit'); assert.equal(room.outlook, 'none'); assert.equal(room.style, 'mech');
  const seat = [...seatSpots('cockpit', []).values()].find((seat) => seat.name === 'パイロット席')!;
  assert.ok(seat); assert.ok(canWalk(seat.approach.x, seat.approach.y, 'cockpit')); assert.equal(seat.facing, 'up');
  assert.equal(restingSeat(new Map([[`${seat.approach.x},${seat.approach.y}`, seat]]), seat.approach, false, false, false), seat);
});
test('cockpit actions validate strict commands and ids; clients cannot inject animation clocks or operators', () => {
  for (const action of Object.keys(ROBOT_ACTIONS)) {
    const actionId = randomUUID();
    assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'robot-action', action, actionId, startedAt: 1, operator: 'spoof' })), { type: 'robot-action', action, actionId });
  }
  for (const action of ['__proto__', 'constructor', 'delete', '', 4, null, {}]) {
    assert.equal(isRobotAction(action), false);
    assert.equal(parseClientMessage(JSON.stringify({ type: 'robot-action', action, actionId: randomUUID() })), undefined);
  }
  assert.equal(parseClientMessage(JSON.stringify({ type: 'robot-action', action: 'punch', actionId: 'bad' })), undefined);
});
test('robot poses and cockpit camera effects stay in pixel bounds and become still with reduced motion', () => {
  const actions = [null, ...Object.keys(ROBOT_ACTIONS)] as (RobotAction | null)[], poses = new Set<string>();
  for (const action of actions) {
    poses.add(JSON.stringify(robotPixels(action, 2150)));
    for (let elapsed = 0; elapsed < 8000; elapsed += 137) {
      for (const p of robotPixels(action, elapsed)) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 128 && p.y + p.h <= 144, `${action}: ${JSON.stringify(p)}`);
      for (const p of cockpitHorizonPixels(action, elapsed)) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 182 && p.y + p.h <= 70, `${action} camera: ${JSON.stringify(p)}`);
    }
    assert.deepEqual(robotPixels(action, 0, true), robotPixels(action, 3000, true));
    assert.deepEqual(cockpitHorizonPixels(action, 0, 182, 70, true), cockpitHorizonPixels(action, 3000, 182, 70, true));
  }
  assert.equal(poses.size, actions.length);
  for (const item of getRoom('cockpit').furniture) for (const p of cockpitFurniturePixels(item.kind, item.w * 16, item.h * 16)) {
    assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= item.w * 16 && p.y + p.h <= item.h * 16);
  }
});
