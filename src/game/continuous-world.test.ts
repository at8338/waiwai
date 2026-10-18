import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, ROOM_IDS } from './rooms.ts';
import { COLS, ROWS, canWalk, Walker, TILE } from './world.ts';
import { ClickTravel, clickPath } from './click-travel.ts';
import { continuousWalkable, neighbor, passage, roomOrigin, worldPoint, worldStep, worldTile, WORLD_COLUMNS, WORLD_ROWS } from './continuous-world.ts';

test('all sixteen area interiors share one connected world, without moving existing furniture', () => {
  const start = worldPoint({ ...ROOMS[0].spawn, roomId: ROOMS[0].id });
  const seen = new Set<string>(), queue = [start];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    const tile = worldTile(p.x, p.y); if (!tile || !continuousWalkable(tile)) continue;
    seen.add(key);
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) queue.push({ x: p.x + dx, y: p.y + dy });
  }
  for (const room of ROOMS) {
    const spawn = worldPoint({ ...room.spawn, roomId: room.id });
    assert.ok(seen.has(`${spawn.x},${spawn.y}`), room.name);
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) assert.equal(continuousWalkable({ roomId: room.id, x,y }), canWalk(x,y,room.id));
  }
});
test('four-way geography is reciprocal, has solid outer edges, and closing an area closes every shared passage', () => {
  const opposites = { left:'right', right:'left', up:'down', down:'up' } as const;
  for (const id of ROOM_IDS) for (const direction of ['left','right','up','down'] as const) {
    const other = neighbor(id, direction);
    if (other) assert.equal(neighbor(other, opposites[direction]), id);
    let openings = 0;
    for (let n = 1; n < (direction === 'left' || direction === 'right' ? ROWS : COLS) - 1; n++) {
      const p = direction === 'left' ? {x:0,y:n} : direction === 'right' ? {x:COLS-1,y:n} : direction === 'up' ? {x:n,y:0} : {x:n,y:ROWS-1};
      if (!passage(id,p.x,p.y)) continue;
      openings++;
      assert.equal(continuousWalkable({roomId:id,...p}, area => area !== other), false);
      const crossing = worldStep({roomId:id,...p},direction)!;
      assert.equal(crossing.roomId,other); assert.equal(continuousWalkable(crossing),true);
      assert.equal(Math.abs(worldPoint(crossing).x-worldPoint({roomId:id,...p}).x)+Math.abs(worldPoint(crossing).y-worldPoint({roomId:id,...p}).y),1);
    }
    assert.equal(openings > 0, !!other, `${id}:${direction}`);
  }
  assert.equal(worldTile(-1,1),undefined); assert.equal(worldTile(120,1),undefined); assert.equal(worldTile(1,80),undefined);
});
test('click paths and dash directions work across area boundaries and stop when a route is newly blocked', () => {
  const from={x:28,y:18},to={x:32,y:18}, bounds={width:WORLD_COLUMNS*COLS,height:WORLD_ROWS*ROWS};
  const walkable=(x:number,y:number)=>{const tile=worldTile(x,y);return !!tile&&continuousWalkable(tile);};
  const travel=new ClickTravel(bounds);
  assert.deepEqual(clickPath(from,to,walkable,bounds),['right','right','right','right']);
  assert.equal(travel.set(from,to,walkable),true);
  assert.deepEqual(travel.next(from,walkable),{direction:'right',dash:false});
  assert.equal(travel.next(from,walkable),undefined); assert.equal(travel.lastStop,'blocked');
  assert.equal(travel.set(from,to,walkable,true),true); assert.deepEqual(travel.next(from,walkable),{direction:'right',dash:true});
});
test('a boundary crossing interpolates a single world tile, without a camera jump', () => {
  const walker = new Walker(100); walker.receive({x:29,y:18},'right',true);
  const before = walker.position();
  walker.translate(-COLS,0); walker.receive({x:0,y:18},'right');
  walker.update(50);
  const after=walker.position(),origin=roomOrigin('focus');
  assert.equal(after.x + origin.x*TILE-before.x, TILE/2);
  assert.equal(after.y,before.y);
});
