import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WALK_STYLES, walkingMotion } from './walking.ts';
import { DEFAULT_APPEARANCE, parseAppearance, appearanceKey } from './avatar.ts';
import { parseClientMessage, directions } from '../network/protocol.ts';

test('six distinct walking styles remain bounded and all return to the idle pose when stopped or reduced', () => {
  assert.equal(WALK_STYLES.length, 6);
  const signatures = new Set<string>();
  for (let style = 0; style < WALK_STYLES.length; style++) {
    const samples = [];
    for (const direction of directions) for (let time = 0; time < 1400; time += 13) {
      const motion = walkingMotion(style, time, direction, true); samples.push(motion);
      assert.ok([0, 1, 2].includes(motion.frame));
      assert.ok(motion.lift >= 0 && motion.lift <= 7);
      assert.ok(Math.abs(motion.offsetX) <= 1 && Math.abs(motion.tilt) <= 0.13);
      assert.ok(motion.scaleX >= 0.9 && motion.scaleX <= 1.1 && motion.scaleY >= 0.9 && motion.scaleY <= 1.1);
      assert.ok(motion.shadow >= 0.68 && motion.shadow <= 1);
      const idle = walkingMotion(0, 0, direction, false);
      assert.deepEqual(walkingMotion(style, time, direction, false), idle);
      assert.deepEqual(walkingMotion(style, time, direction, true, true), idle);
    }
    signatures.add(JSON.stringify(samples));
  }
  assert.equal(signatures.size, 6);
  assert.equal(walkingMotion(3, 215, 'down', true).lift, 7);
  assert.equal(walkingMotion(3, 430, 'down', true).lift, 0);
  assert.equal(walkingMotion(5, 200, 'right', true).frame, 0);
});
test('legacy profiles and saved appearances gain normal walking without losing clothes, props or body settings', () => {
  const { walkStyle: _walkStyle, heldItem: _heldItem, ...old } = { ...DEFAULT_APPEARANCE, clothing: 3, color: 4, body: 2 };
  assert.deepEqual(parseAppearance(old), { ...old, heldItem: 0, walkStyle: 0 });
  assert.deepEqual(parseAppearance({ ...old, heldItem: 2 }), { ...old, heldItem: 2, walkStyle: 0 });
  for (let walkStyle = 0; walkStyle < WALK_STYLES.length; walkStyle++) {
    const appearance = { ...DEFAULT_APPEARANCE, heldItem: 3, walkStyle };
    assert.deepEqual(parseAppearance(appearance), appearance);
    assert.equal(appearanceKey(appearance), appearanceKey({ ...appearance, walkStyle: 0 })); // Sprite pixels are reusable across gait transforms.
    const profile = parseClientMessage(JSON.stringify({ type: 'profile', name: '歩く人', outfit: 0, appearance }));
    assert.ok(profile?.type === 'profile'); assert.equal(profile.appearance?.walkStyle, walkStyle);
  }
  for (const walkStyle of [-1, 6, 1.5, '3', null, {}, true]) {
    assert.equal(parseAppearance({ ...DEFAULT_APPEARANCE, walkStyle }), undefined);
    assert.equal(parseClientMessage(JSON.stringify({ type: 'profile', name: '無効', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, walkStyle } })), undefined);
  }
});
