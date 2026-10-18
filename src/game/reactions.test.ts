import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REACTIONS, REACTION_KINDS, isReactionKind, reactionMotion } from './reactions.ts';
import type { AvatarPose } from './reactions.ts';
import { AVATAR_OPTIONS, avatarPixels, DEFAULT_APPEARANCE } from './avatar.ts';
import { parseClientMessage } from '../network/protocol.ts';

test('only built-in reactions are accepted and clients cannot choose another actor, room or position', () => {
  for (const kind of REACTION_KINDS) assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'reaction', kind, playerId: 'other', roomId: 'cafe', x: 999, duration: 999999 })), { type: 'reaction', kind });
  for (const kind of ['__proto__', 'constructor', 'unknown', '', null, 0, {}]) {
    assert.equal(isReactionKind(kind), false);
    assert.equal(parseClientMessage(JSON.stringify({ type: 'reaction', kind })), undefined);
  }
});

test('rest is an explicit boolean state, independent of timed reactions and controlled only by its owner', () => {
  for (const resting of [true, false]) assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'rest', resting, playerId: 'someone-else', duration: 1, x: 999 })), { type: 'rest', resting });
  for (const resting of [undefined, null, 1, 0, 'true', [], {}]) assert.equal(parseClientMessage(JSON.stringify({ type: 'rest', resting })), undefined);
  assert.equal(isReactionKind('lie'), false);
});

test('lying down is a still horizontal pose that preserves appearance and fits its wider texture', () => {
  for (let body = 0; body < 3; body++) for (let height = 0; height < 3; height++) for (let hair = 0; hair < 5; hair++) for (let accessory = 0; accessory < 4; accessory++) for (let heldItem = 0; heldItem < AVATAR_OPTIONS.heldItem.choices.length; heldItem++) {
    const appearance = { ...DEFAULT_APPEARANCE, body, height, hair, accessory, heldItem };
    const pixels = avatarPixels(appearance, 'down', 0, 'lie');
    for (const direction of ['up', 'down', 'left', 'right']) for (let frame = 0; frame < 3; frame++) assert.deepEqual(avatarPixels(appearance, direction, frame, 'lie'), pixels);
    assert.ok(pixels.every(p => p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 32 && p.y + p.h <= 28));
    const width = Math.max(...pixels.map(p => p.x + p.w)) - Math.min(...pixels.map(p => p.x));
    const heightPixels = Math.max(...pixels.map(p => p.y + p.h)) - Math.min(...pixels.map(p => p.y));
    assert.ok(width > heightPixels);
    assert.notDeepEqual(pixels, avatarPixels(appearance));
  }
});

test('motions finish without lingering transforms; jumping raises the sprite and keeps a smaller shadow on the floor', () => {
  for (const kind of REACTION_KINDS) {
    const { duration } = REACTIONS[kind];
    for (const t of [0, 0.1, 0.3, 0.5, 0.8, 0.99]) {
      const motion = reactionMotion(kind, duration * t)!;
      assert.ok(motion.lift >= -1e-6 && motion.lift <= 12);
      assert.ok(motion.shadow >= 0.7 && motion.shadow <= 1);
      assert.ok(motion.scaleY >= 0.92 && motion.scaleY <= 1);
    }
    for (const elapsed of [-1, duration, duration + 10000, NaN, Infinity]) assert.equal(reactionMotion(kind, elapsed), undefined);
  }
  const jump = reactionMotion('jump', REACTIONS.jump.duration * 0.4)!;
  assert.equal(jump.lift, 12); assert.equal(jump.shadow, 0.7);
  assert.equal(reactionMotion('bow', 750)!.pose, 'bow');
  assert.equal(reactionMotion('cheer', 900)!.pose, 'raise');
  assert.equal(reactionMotion('joy', 950)!.pose, 'happy');
});

test('reduced motion preserves the gesture without bouncing, swaying or scaling', () => {
  for (const kind of REACTION_KINDS) {
    const normal = reactionMotion(kind, REACTIONS[kind].duration * 0.4)!;
    const reduced = reactionMotion(kind, REACTIONS[kind].duration * 0.4, true)!;
    assert.equal(reduced.pose, normal.pose);
    assert.deepEqual([reduced.lift, reduced.tilt, reduced.scaleY, reduced.shadow], [0, 0, 1, 1]);
  }
});

test('gestures draw actual bowed heads and raised hands while every appearance stays inside its sprite', () => {
  const normal = avatarPixels(DEFAULT_APPEARANCE);
  const bow = avatarPixels(DEFAULT_APPEARANCE, 'down', 0, 'bow');
  const head = (pixels: typeof normal) => pixels.find((p) => p.x === 6 && p.w === 8 && p.h === 8)!;
  assert.equal(head(bow).y - head(normal).y, 5);
  const raised = avatarPixels(DEFAULT_APPEARANCE, 'down', 0, 'raise');
  assert.ok(raised.some((p) => p.color === 0xf2cba2 && p.x < 4 && p.y < 5));
  assert.ok(raised.some((p) => p.color === 0xf2cba2 && p.x > 15 && p.y < 5));
  for (let body = 0; body < 3; body++) for (let height = 0; height < 3; height++) for (let hair = 0; hair < 5; hair++) for (let accessory = 0; accessory < 4; accessory++) {
    for (const pose of ['stand', 'bow', 'raise', 'happy', 'angry'] as AvatarPose[]) for (const direction of ['up', 'down', 'left', 'right']) for (let frame = 0; frame < 3; frame++) {
      for (const p of avatarPixels({ ...DEFAULT_APPEARANCE, body, height, hair, accessory }, direction, frame, pose)) {
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 20 && p.y + p.h <= 28, JSON.stringify({ body, height, hair, accessory, direction, frame, pose, p }));
      }
    }
  }
});
