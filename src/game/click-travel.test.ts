import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clickPath, clickDashDirection, ClickTravel } from './click-travel.ts';
import { walkableWithObjects } from './objects.ts';
test('click routes reach the destination through real office doors and avoid furniture', () => {
  const path = clickPath({ x: 15, y: 12 }, { x: 3, y: 6 }, (x,y) => walkableWithObjects(x,y,'office',[]));
  assert.ok(path?.length);
  const tile = { x: 15, y: 12 }, vectors = { up: [0,-1], right: [1,0], down: [0,1], left: [-1,0] };
  for (const dir of path) { const [dx,dy] = vectors[dir]; tile.x += dx; tile.y += dy; assert.ok(walkableWithObjects(tile.x,tile.y,'office',[])); }
  assert.deepEqual(tile, { x: 3, y: 6 });
  assert.equal(clickPath(tile, { x: 3, y: 3 }, (x,y) => walkableWithObjects(x,y,'office',[])), undefined);
});
test('route replans for new obstacles, stops on rejected movement and clears on cancellation', () => {
  const travel = new ClickTravel(), open = (x: number,y: number) => x > 0 && x < 29 && y > 0 && y < 19;
  assert.equal(travel.set({x:2,y:2},{x:5,y:2},open),true);
  assert.deepEqual(travel.next({x:2,y:2},open),{direction:'right',dash:false});
  assert.equal(travel.next({x:2,y:2},open),undefined); assert.equal(travel.goal,undefined);
  travel.set({x:2,y:2},{x:5,y:2},open); travel.next({x:2,y:2},open);
  const detour = travel.next({x:3,y:2},(x,y) => open(x,y) && !(x===4 && y===2)); assert.ok(detour && detour.direction !== 'right');
  travel.clear(); assert.equal(travel.next({x:3,y:2},open),undefined);
  assert.equal(travel.set({x:2,y:2},{x:5,y:2},() => false),false);
});
test('double click sends exactly one existing dash in the dominant axis', () => {
  assert.equal(clickDashDirection({x:5,y:5},{x:10,y:6}),'right');
  assert.equal(clickDashDirection({x:5,y:5},{x:4,y:1}),'up');
  const travel = new ClickTravel(); travel.set({x:5,y:5},{x:1,y:6},()=>true,true);
  assert.deepEqual(travel.next({x:5,y:5},()=>true),{direction:'left',dash:true}); assert.equal(travel.next({x:5,y:5},()=>true),undefined);
});
