import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTap } from './map-tap.ts';
test('scrolling, cancelled touches and pinch cancellation never open an object or DM', () => {
  let opened = 0; const activate = mapTap(() => opened++);
  for (const type of ['touchcancel', 'pointercancel']) activate({ event: { type }, getDistance: () => 0 });
  activate({ event: { type: 'touchend' }, getDistance: () => 40 });
  assert.equal(opened, 0);
  activate({ event: { type: 'touchend' }, getDistance: () => 3 });
  activate({ event: { type: 'mouseup' }, getDistance: () => 0 });
  assert.equal(opened, 2);
  const manager = { scaleManager: { displayScale: { x: 3, y: 3 } } };
  activate({ manager, event: { type: 'touchend' }, getDistance: () => 20 });
  activate({ manager, event: { type: 'touchend' }, getDistance: () => 40 });
  assert.equal(opened, 3, 'normal finger jitter works even when the map is fitted to a small screen');
  activate({ event: { type: 'mouseup', target: Object.assign(new EventTarget(), { tagName: 'BUTTON' }) }, getDistance: () => 0 });
  activate({ event: { type: 'touchend', target: Object.assign(new EventTarget(), { tagName: 'TEXTAREA' }) }, getDistance: () => 0 });
  assert.equal(opened, 3, 'dialog and direction-button releases never activate an underlying avatar');
});
