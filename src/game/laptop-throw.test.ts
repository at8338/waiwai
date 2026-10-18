import { test } from 'node:test';
import assert from 'node:assert/strict';
import { laptopThrowMotion } from './laptop-throw.ts';
import { laptopPixels, LAPTOP_WIDTH, LAPTOP_HEIGHT } from './laptop-art.ts';
import { REACTIONS, REACTION_KINDS, reactionMotion } from './reactions.ts';

test('anger winds up, follows a spinning arc, lands and fully clears; reduced motion stays still', () => {
  const duration = REACTIONS.anger.duration;
  assert.equal(reactionMotion('anger', 800)!.pose, 'angry');
  assert.equal(laptopThrowMotion(100)!.phase, 'windup');
  const release = laptopThrowMotion(duration * .22)!, middle = laptopThrowMotion(duration * .46)!, landing = laptopThrowMotion(duration * .7)!;
  assert.equal(middle.phase, 'flight'); assert.ok(middle.x > release.x && landing.x > middle.x);
  assert.ok(middle.y < (release.y + landing.y) / 2, 'the laptop arcs above a straight line');
  assert.ok(middle.rotation > release.rotation); assert.equal(landing.phase, 'impact');
  assert.ok(laptopThrowMotion(duration - 1)!.alpha < .01);
  for (const elapsed of [-1, duration, duration + 1, Infinity, NaN]) assert.equal(laptopThrowMotion(elapsed), undefined);
  const reduced = laptopThrowMotion(100, true);
  for (const t of [.1, .3, .5, .9]) {
    const motion = laptopThrowMotion(t * duration)!;
    assert.ok([motion.x, motion.y, motion.rotation, motion.alpha, motion.impact].every(Number.isFinite));
    assert.ok(motion.alpha >= 0 && motion.alpha <= 1);
    assert.deepEqual(laptopThrowMotion(t * duration, true), reduced);
  }
});
test('laptop artwork fits its shared texture and reaction shortcuts do not consume rest key 5', () => {
  assert.ok(laptopPixels().every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= LAPTOP_WIDTH && p.y + p.h <= LAPTOP_HEIGHT));
  const keys = REACTION_KINDS.map(kind => REACTIONS[kind].key);
  assert.equal(new Set(keys).size, REACTION_KINDS.length);
  assert.ok(!keys.some(key => String(key) === '5')); assert.equal(REACTIONS.anger.key, '6');
});
