import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, PROJECT_SECTIONS, isRoomId } from './rooms.ts';
import { COLS, ROWS, areaAt, canWalk, isWall } from './world.ts';
import { DEFAULT_APPEARANCE, AVATAR_OPTIONS, parseAppearance, avatarPixels } from './avatar.ts';
import { placementProblem } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { proximityGain } from '../audio/proximity.ts';
import { parseClientMessage } from '../network/protocol.ts';

test('sixteen rooms remain reachable with twenty work desks and no lobby desks', () => {
  assert.equal(ROOMS.length, 16);
  assert.equal(ROOMS.flatMap((room) => room.furniture).filter((o) => o.kind === 'desk').length, 20);
  assert.ok(ROOMS[0].furniture.every((o) => o.kind !== 'desk' || o.y < 10));
  assert.equal(new Set(ROOMS.map((r) => r.name)).size, 16);
  for (const room of ROOMS) {
    assert.ok(canWalk(room.spawn.x, room.spawn.y, room.id));
    assert.ok(canWalk(room.door.x, room.door.y, room.id));
    const occupied = new Set<string>();
    for (const f of room.furniture) for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) {
      if (f.kind !== 'calendar') assert.equal(isWall(x, y, room.id), false, `${room.id}: furniture on wall ${x},${y}`);
      assert.ok(!occupied.has(`${x},${y}`), `${room.id} overlapping furniture`); occupied.add(`${x},${y}`);
      assert.ok(x > 0 && x < COLS - 1 && (f.kind === 'calendar' ? y === 0 : y > 0) && y < ROWS - 1);
    }
    const seen = new Set<string>(), queue = [room.spawn];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], key = `${p.x},${p.y}`;
      if (seen.has(key) || !canWalk(p.x, p.y, room.id)) continue;
      seen.add(key); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: p.x + dx, y: p.y + dy });
    }
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) if (canWalk(x, y, room.id)) assert.ok(seen.has(`${x},${y}`), `${room.id}: unreachable ${x},${y}`);
  }
});

test('appearance options validate independently and cannot exceed sprite bounds', () => {
  for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof typeof AVATAR_OPTIONS>) {
    assert.equal(parseAppearance({ ...DEFAULT_APPEARANCE, [key]: -1 }), undefined);
    assert.equal(parseAppearance({ ...DEFAULT_APPEARANCE, [key]: AVATAR_OPTIONS[key].choices.length }), undefined);
    for (let n = 0; n < AVATAR_OPTIONS[key].choices.length; n++) {
      const appearance = { ...DEFAULT_APPEARANCE, [key]: n };
      assert.deepEqual(parseAppearance(appearance), appearance);
    }
  }
  for (let height = 0; height < 3; height++) for (let hair = 0; hair < 5; hair++) for (let frame = 0; frame < 3; frame++) {
    for (const p of avatarPixels({ ...DEFAULT_APPEARANCE, height, hair }, 'down', frame)) {
      assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 20 && p.y + p.h <= 28, JSON.stringify(p));
    }
  }
  assert.equal(parseClientMessage(JSON.stringify({ type: 'change-room', roomId: 'outside', requestId: 1 })), undefined);
  assert.equal(isRoomId('__proto__'), false);
});

test('props cannot cover spawns, doors, furniture, participants or the final route into a room', () => {
  const item: RoomObject = { id: 'test', owner: 'test', roomId: 'office', kind: 'plant', x: 5, y: 10, rotation: 0 };
  assert.equal(placementProblem(item, []), undefined);
  assert.match(placementProblem({ ...item, id: 'next', x: 6 }, [item])!, /通り道/);
  assert.match(placementProblem({ ...item, x: 15, y: 12 }, [])!, /入口/);
  assert.match(placementProblem({ ...item, x: 28, y: 18 }, [])!, /入口/);
  assert.match(placementProblem({ ...item, x: 2, y: 3 }, [])!, /壁や家具/);
  assert.match(placementProblem(item, [], [{ roomId: 'office', x: 5, y: 10 }])!, /アバター/);
  assert.equal(placementProblem(item, [], [{ roomId: 'cafe', x: 5, y: 10 }]), undefined);
});

test('identical coordinates in different rooms never share audio', () => {
  assert.equal(proximityGain({ x: 15, y: 12, roomId: 'cafe' }, { x: 15, y: 12, roomId: 'library' }), 0);
  assert.equal(proximityGain({ x: 9, y: 9, roomId: 'cafe' }, { x: 11, y: 9, roomId: 'cafe' }), 3 / 3.5);
});


test('four project sections retain their named areas with open boundaries', () => {
  assert.deepEqual(PROJECT_SECTIONS.map((section) => section.name), ['アプリ', 'バックエンド', 'CMS', 'インフラ']);
  for (const section of PROJECT_SECTIONS) {
    assert.equal(areaAt({ roomId: 'project', x: section.x + 6, y: section.y + 4 }), section.name);
    for (let x = section.entrance.x; x < section.entrance.x + section.entrance.w; x++) assert.ok(canWalk(x, section.entrance.y, 'project'));
    assert.equal(isWall(section.entrance.x - 1, section.entrance.y, 'project'), false);
  }
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) assert.equal(isWall(x, y, 'project'), false);
  for (const [x,y] of [[13,5], [16,5], [8,8], [10,11]]) assert.ok(canWalk(x,y,'project'));
  assert.equal(areaAt({ roomId: 'project', x: 15, y: 10 }), '共用通路');
  const plant: RoomObject = { id: 'route', owner: 'qa', roomId: 'project', kind: 'plant', x: 6, y: 8, rotation: 0 };
  assert.equal(placementProblem(plant, []), undefined);
  assert.equal(placementProblem({ ...plant, id: 'second', x: 7 }, [plant]), undefined);
  for (const roomId of ['project', 'canteen']) assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'change-room', roomId, requestId: 1 })), { type: 'change-room', roomId, requestId: 1 });
});
