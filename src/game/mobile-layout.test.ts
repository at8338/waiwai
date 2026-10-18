import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapScrollTarget, mobileMapWidth, setupMobileViewport } from './mobile-layout.ts';

test('whole-room view fits both portrait and landscape; zoom still permits larger tap targets', () => {
  assert.equal(mobileMapWidth({ width: 349, height: 515 }, 1), 349);
  const landscape = mobileMapWidth({ width: 818, height: 249 }, 1);
  assert.ok(landscape < 818 && landscape / 1.25 + 20 <= 250);
  assert.ok(mobileMapWidth({ width: 818, height: 249 }, 2) > landscape);
});

test('phone map follows the same tile after zooming without scrolling beyond room edges', () => {
  const room = { cols: 30, rows: 20 }, view = { width: 320, height: 300 };
  assert.deepEqual(mapScrollTarget(view, { left: 8, top: 50, width: 640, height: 400 }, { x: 15, y: 12 }, room, { width: 656, height: 458 }), { left: 178.66666666666669, top: 150 });
  assert.deepEqual(mapScrollTarget(view, { left: 8, top: 50, width: 640, height: 400 }, { x: 0, y: 0 }, room, { width: 656, height: 458 }), { left: 0, top: 0 });
  assert.deepEqual(mapScrollTarget(view, { left: 8, top: 50, width: 640, height: 400 }, { x: 29, y: 19 }, room, { width: 656, height: 458 }), { left: 336, top: 158 });
});
test('fitting the room to a phone with a taller viewport never requests negative scrolling', () => {
  assert.deepEqual(mapScrollTarget({ width: 360, height: 500 }, { left: 0, top: 30, width: 360, height: 240 }, { x: 15, y: 10 }, { cols: 30, rows: 20 }, { width: 360, height: 270 }), { left: 0, top: 0 });
});
test('software keyboard follows the visible viewport, pinch zoom stays native, and teardown removes listeners', () => {
  const viewport = Object.assign(new EventTarget(), { scale: 1, height: 812, offsetTop: 0 });
  const win = Object.assign(new EventTarget(), { visualViewport: viewport, innerHeight: 812 });
  const values = new Map<string, string>(), classes = new Set<string>();
  const doc = Object.assign(new EventTarget(), { activeElement: { matches: () => true }, documentElement: {
    style: { setProperty: (key: string, value: string) => values.set(key, value) },
    classList: { toggle: (key: string, on: boolean) => on ? classes.add(key) : classes.delete(key) },
  } });
  const globals = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  const controller = new AbortController();
  try {
    setupMobileViewport(controller.signal);
    viewport.height = 350; viewport.offsetTop = 30; viewport.dispatchEvent(new Event('resize'));
    assert.equal(values.get('--app-height'), '350px'); assert.equal(values.get('--app-top'), '30px'); assert.ok(classes.has('keyboard-open'));
    viewport.scale = 2; viewport.height = 200; viewport.dispatchEvent(new Event('resize'));
    assert.equal(values.get('--app-height'), '350px');
    viewport.scale = 1; viewport.height = 812; viewport.offsetTop = 0; viewport.dispatchEvent(new Event('resize'));
    assert.equal(classes.has('keyboard-open'), false);
    controller.abort(); viewport.height = 300; viewport.dispatchEvent(new Event('resize'));
    assert.equal(values.get('--app-height'), '812px');
  } finally {
    controller.abort();
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
