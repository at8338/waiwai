import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATAR_OPTIONS, DEFAULT_APPEARANCE, parseAppearance, appearanceKey, avatarPixels } from './avatar.ts';
import { directions } from '../network/protocol.ts';

test('old appearances keep their customization when held items are introduced', () => {
  const { heldItem: _heldItem, ...legacy } = { ...DEFAULT_APPEARANCE, hair: 2, color: 4, accessory: 1 };
  assert.deepEqual(parseAppearance(legacy), { ...legacy, heldItem: 0 });
  assert.deepEqual(parseAppearance(undefined, 2), { ...DEFAULT_APPEARANCE, color: 2 });
  for (const heldItem of [-1, 5, 1.5, '1', null, {}, true]) assert.equal(parseAppearance({ ...legacy, heldItem }), undefined);
  assert.equal(parseAppearance({ ...legacy, body: undefined }), undefined);
});

test('held items have distinct texture keys and remain in bounds in all directions and reactions', () => {
  const keys = new Set(), drawings = new Set();
  for (let heldItem = 0; heldItem < AVATAR_OPTIONS.heldItem.choices.length; heldItem++) {
    const appearance = { ...DEFAULT_APPEARANCE, heldItem };
    assert.deepEqual(parseAppearance(appearance), appearance);
    keys.add(appearanceKey(appearance)); drawings.add(JSON.stringify(avatarPixels(appearance)));
    for (let body = 0; body < 3; body++) for (let height = 0; height < 3; height++) {
      for (const direction of directions) for (const pose of ['stand', 'sit', 'bow', 'raise', 'happy', 'angry'] as const) for (let frame = 0; frame < 3; frame++) {
        for (const p of avatarPixels({ ...appearance, body, height }, direction, frame, pose)) {
          assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0);
          assert.ok(p.x + p.w <= 20 && p.y + p.h <= 28, `${heldItem}/${body}/${height}/${direction}/${pose}/${frame}: ${JSON.stringify(p)}`);
        }
      }
    }
  }
  assert.equal(keys.size, 5); assert.equal(drawings.size, 5);
});
