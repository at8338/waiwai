import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDDY_KINDS, buddyMapPixels, buddyMapSize } from './buddies.ts';
import { directions } from '../network/protocol.ts';
import { companionLayout } from './companion-layout.ts';
import { POKEMON } from './pokemon.ts';
test('all map sprites fit their variable-size textures in all directions and animation frames', () => {
  for (const kind of BUDDY_KINDS) {
    const { width, height } = buddyMapSize(kind);
    for (const direction of directions) for (let frame = 0; frame < 3; frame++) {
      const pixels = buddyMapPixels(kind, direction, frame); assert.ok(pixels.length > 0, kind);
      for (const p of pixels) assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= width && p.y + p.h <= height, `${kind} ${direction} ${frame}: ${JSON.stringify(p)}`);
    }
    for (const x of [24, 240, 456]) for (const y of [24, 160, 296]) for (const lift of [0, 4.5]) {
      const pos = companionLayout(kind, { x, y }, lift);
      assert.ok(pos.x - width / 2 >= 16 && pos.x + width / 2 <= 464, kind);
      assert.ok(pos.y - height >= 16 && pos.y <= 304, kind);
    }
  }
});
test('large species visibly occupy multiple tiles while ordinary pets and menu art stay compact', () => {
  assert.equal(POKEMON.wailord.heightDm, 145); assert.equal(buddyMapSize('wailord').width, 88);
  assert.equal(buddyMapSize('steelix').width, 72); assert.equal(buddyMapSize('pikachu').width, 20);
  assert.equal(buddyMapSize('cat').width, 20); assert.ok(buddyMapSize('snorlax').width > buddyMapSize('pikachu').width);
});
