import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DoubleTap } from './dash.ts';
test('double tap requires two distinct arrow presses in the same direction within 280ms', () => {
  const tap = new DoubleTap(); assert.equal(tap.press('right', 0), false); assert.equal(tap.press('right', 100, true), false); assert.equal(tap.press('right', 200), true);
  assert.equal(tap.press('right', 210), false); assert.equal(tap.press('left', 220), false); assert.equal(tap.press('left', 501), false); assert.equal(tap.press('left', 600), true);
  tap.press('up', 700); tap.clear(); assert.equal(tap.press('up', 710), false);
});
