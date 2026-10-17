import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RobotSimulation } from './robot.ts';
import { ROBOT_ACTIONS } from '../src/game/robot.ts';
import type { RobotAction } from '../src/game/robot.ts';
test('one shared performance plays at a time and returns to standby at its exact deadline', () => {
  const robot = new RobotSimulation(); let now = 100_000;
  for (const action of Object.keys(ROBOT_ACTIONS) as RobotAction[]) {
    assert.equal(robot.start(action, 'はな', now), true);
    const playing = robot.snapshot(now); assert.equal(playing.state.operator, 'はな'); assert.equal(playing.state.action, action);
    playing.state.operator = 'fake'; assert.equal(robot.snapshot(now).state.operator, 'はな');
    assert.equal(robot.start('pose', '別の人', now + 1), false);
    const end = now + ROBOT_ACTIONS[action].duration;
    assert.equal(robot.tick(end - 1), false); assert.equal(robot.snapshot(end - 1).state.action, action);
    assert.equal(robot.snapshot(end).state.action, null);
    assert.equal(robot.tick(end), true); assert.equal(robot.tick(end), false); assert.equal(robot.snapshot(end).state.action, null);
    now = end;
  }
  assert.equal(robot.snapshot(now).state.version, 6);
});
test('late joins cannot consume the end broadcast; a new action at expiry is not cleared by the timer', () => {
  const robot = new RobotSimulation(); robot.start('wave', 'あお', 10_000);
  const end = 10_000 + ROBOT_ACTIONS.wave.duration;
  assert.equal(robot.snapshot(end).state.action, null); assert.equal(robot.tick(end), true);
  robot.start('walk', 'あお', end);
  assert.equal(robot.start('punch', 'みどり', end + ROBOT_ACTIONS.walk.duration), true);
  assert.equal(robot.tick(end + ROBOT_ACTIONS.walk.duration), false); assert.equal(robot.snapshot(end + ROBOT_ACTIONS.walk.duration).state.action, 'punch');
});
