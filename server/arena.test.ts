import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MagicArena, IceShields } from './arena.ts';
import type { Player } from '../src/network/protocol.ts';
const a: Player = { id: 'a', slot: 1, name: 'アリス', outfit: 0, roomId: 'arena', x: 12, y: 10, facing: 'right' };
const b: Player = { ...a, id: 'b', name: 'ボブ', slot: 2, x: 17, facing: 'left' };
test('four authoritative fire hits exhaust HP and end the duel; spectators cannot damage fighters', () => {
  const arena = new MagicArena(); arena.join(a, 0); arena.join(b, 0);
  arena.fire({ ...a, id: 'spectator' }, 0); assert.equal(arena.snapshot().projectiles.length, 0);
  for (let i = 0; i < 4; i++) { arena.fire(a, i * 1300); arena.tick(i * 1300 + 500, [a, b], []); assert.equal(arena.snapshot().fighters[1].hp, 100 - (i + 1) * 25); }
  assert.equal(arena.snapshot().phase, 'finished'); assert.equal(arena.snapshot().winnerId, a.id);
  arena.fire(b, 6000); assert.equal(arena.snapshot().projectiles.length, 0);
});
test('ice blocks fire and movement for exactly three seconds and cannot be recast while active, even after changing rooms', () => {
  const ice = new IceShields(), arena = new MagicArena(); arena.join(a, 0); arena.join(b, 0);
  assert.equal(ice.place(b, [a, b], [], 0), undefined); assert.equal(ice.objects(2999).length, 1);
  assert.match(ice.place({ ...b, roomId: 'office' }, [], [], 2999)!, /消えるまで/);
  assert.equal(ice.snapshot(b.id, 'office', 2999).activeUntil, 3000); assert.equal(ice.snapshot(b.id, 'office', 2999).shields.length, 0);
  arena.fire(a, 0); arena.tick(500, [a, b], ice.objects(500)); assert.equal(arena.snapshot().fighters[1].hp, 100);
  assert.equal(ice.tick(3000), true); assert.equal(ice.objects(3000).length, 0); assert.equal(ice.place(b, [a, b], [], 3000), undefined);
  assert.match(new IceShields().place({ ...a, x: 16 }, [a, b], [], 0)!, /空いて/);
});
test('timeout resolves by remaining HP or draw; leaving awards the other fighter and the next match resets HP', () => {
  const arena = new MagicArena(); arena.join(a, 0); arena.join(b, 0); arena.tick(90000, [a, b], []);
  assert.equal(arena.snapshot().winnerId, undefined); assert.match(arena.snapshot().result, /引き分け/);
  arena.join(a, 100000); arena.join(b, 100000); arena.fire(a, 100000); arena.tick(100500, [a, b], []); arena.tick(190000, [a, b], []);
  assert.equal(arena.snapshot().winnerId, a.id);
  arena.join(a, 200000); arena.join(b, 200000); assert.deepEqual(arena.snapshot().fighters.map(f => f.hp), [100, 100]);
  arena.leave(a.id); assert.equal(arena.snapshot().winnerId, b.id); assert.match(arena.snapshot().result, /途中退出/);
});
