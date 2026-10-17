import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, ROWS, SPAWN, STEP_MS, Walker, areaAt, canWalk, furniture } from './world.ts';

test('the spawn and every room doorway are reachable on foot', () => {
  const visited = new Set<string>();
  const queue = [SPAWN];
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i];
    const key = `${point.x},${point.y}`;
    if (visited.has(key) || !canWalk(point.x, point.y)) continue;
    visited.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: point.x + dx, y: point.y + dy });
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (canWalk(x, y)) assert.ok(visited.has(`${x},${y}`), `unreachable walkable tile ${x},${y}`);
  }
});

test('map edges, walls, and every furniture footprint block movement', () => {
  for (const [x, y] of [[-1, 5], [COLS, 5], [4, -1], [4, ROWS], [0, 5], [29, 5], [10, 5], [20, 5], [4, 10], [2.5, 5]]) assert.equal(canWalk(x, y), false);
  for (const item of furniture.filter((f) => f.kind !== 'parking')) {
    for (let y = item.y; y < item.y + item.h; y++) for (let x = item.x; x < item.x + item.w; x++) assert.equal(canWalk(x, y), false);
  }
  for (const x of [5, 6, 14, 15, 24, 25]) assert.equal(canWalk(x, 10), true);
});

test('movement completes exactly one tile and cannot turn or step again mid-stride', () => {
  const walker = new Walker();
  const initial = walker.position();
  assert.equal(walker.step('right'), true);
  assert.equal(walker.step('up'), false);
  walker.update(STEP_MS / 2);
  assert.deepEqual(walker.position(), { x: initial.x + 8, y: initial.y });
  walker.update(10_000);
  assert.deepEqual(walker.tile, { x: SPAWN.x + 1, y: SPAWN.y });
  assert.deepEqual(walker.position(), { x: initial.x + 16, y: initial.y });
  assert.equal(walker.moving, false);
});

test('a held direction stops at an obstruction; reset cancels an unfinished stride', () => {
  const walker = new Walker();
  for (let i = 0; i < 50; i++) { walker.step('right'); walker.update(STEP_MS); }
  assert.deepEqual(walker.tile, { x: 26, y: 12 }); // plant at 27,12
  assert.equal(walker.step('right'), false);
  assert.equal(walker.facing, 'right');
  assert.equal(walker.step('down'), true);
  walker.update(50);
  walker.reset();
  assert.deepEqual(walker.tile, SPAWN);
  assert.equal(walker.moving, false);
  assert.equal(areaAt(walker.tile), 'エントランス');
  assert.equal(areaAt({ x: 5, y: 5 }), 'ワークエリア');
  assert.equal(areaAt({ x: 15, y: 5 }), 'ミーティングルーム');
  assert.equal(areaAt({ x: 25, y: 5 }), 'ラウンジ');
});

test('network updates interpolate one step without restarting on a profile update', () => {
  const walker = new Walker();
  const start = walker.position();
  walker.receive({ x: SPAWN.x + 1, y: SPAWN.y }, 'right');
  walker.update(STEP_MS / 2);
  assert.deepEqual(walker.position(), { x: start.x + 8, y: start.y });
  walker.receive({ x: SPAWN.x + 1, y: SPAWN.y }, 'right');
  walker.update(STEP_MS / 2);
  assert.deepEqual(walker.position(), { x: start.x + 16, y: start.y });
  assert.equal(walker.moving, false);
  walker.receive({ x: 5, y: 5 }, 'down', true);
  assert.deepEqual(walker.position(), { x: 88, y: 88 });
  assert.equal(walker.moving, false);
});
