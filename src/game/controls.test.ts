import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Controls } from './controls.ts';

test('touch arrows support a short tap, held movement and double tap; cancellation never leaves movement running', () => {
  class Surface extends EventTarget {
    dataset = { direction: 'right' };
    classes = new Set<string>();
    classList = { add: (name: string) => this.classes.add(name), remove: (name: string) => this.classes.delete(name) };
    setAttribute() {}
    setPointerCapture() {}
  }
  const button = new Surface(), canvas = new Surface(), doc = new Surface(), win = new Surface();
  const globals = ['document', 'window'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.assign(doc, { querySelectorAll: (selector: string) => selector === '[data-direction]' || button.classes.has('pressed') ? [button] : [] });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  const controls = new Controls();
  const pointer = (type: string) => button.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { pointerId: 1 }));
  try {
    controls.attach(canvas as unknown as HTMLCanvasElement);
    pointer('pointerdown'); pointer('pointerup'); pointer('lostpointercapture');
    assert.equal(controls.direction(), 'right'); assert.equal(controls.direction(), undefined);
    pointer('pointerdown'); assert.equal(controls.takeDash(), 'right'); pointer('pointerup');
    controls.clear(); pointer('pointerdown');
    assert.equal(controls.direction(), 'right'); assert.equal(controls.direction(), 'right');
    pointer('pointerup'); assert.equal(controls.direction(), undefined);
    controls.clear(); pointer('pointerdown'); pointer('pointercancel');
    assert.equal(controls.direction(), undefined); assert.equal(controls.takeDash(), undefined);
    pointer('pointerdown'); pointer('lostpointercapture');
    assert.equal(controls.direction(), undefined); assert.equal(button.classes.size, 0);
    pointer('pointerdown'); win.dispatchEvent(new Event('blur')); assert.equal(controls.direction(), undefined);
  } finally {
    controls.destroy();
    for (const [key, descriptor] of globals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
