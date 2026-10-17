import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { objectContains, objectSize, objectTiles, placementProblem, validObject, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { parseClientMessage } from '../network/protocol.ts';

const desk: RoomObject = { id: randomUUID(), owner: 'test', kind: 'desk', roomId: 'cafe', x: 8, y: 15, rotation: 0 };

test('desks occupy six tiles in every orientation; all covered tiles are selectable and block walking', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const item = { ...desk, rotation };
    const size = objectSize(item.kind, rotation);
    assert.deepEqual(size, rotation % 2 ? { w: 2, h: 3 } : { w: 3, h: 2 });
    assert.equal(placementProblem(item, []), undefined);
    const tiles = objectTiles(item);
    assert.equal(tiles.length, 6);
    for (const p of tiles) {
      assert.ok(objectContains(item, p.x, p.y));
      assert.equal(walkableWithObjects(p.x, p.y, 'cafe', [item]), false);
    }
    assert.equal(objectContains(item, item.x - 1, item.y), false);
    assert.equal(objectContains(item, item.x + size.w, item.y), false);
    assert.equal(objectContains(item, item.x, item.y + size.h), false);
    assert.equal(walkableWithObjects(item.x + size.w, item.y, 'cafe', [item]), true);
    assert.equal(walkableWithObjects(item.x, item.y, 'office', [item]), true);
  }
  assert.deepEqual(objectSize('chair', 1), { w: 1, h: 1 });
});

test('the entire furniture footprint is checked against walls, furniture, avatars, doors and other decorations', () => {
  const chair = { ...desk, id: randomUUID(), kind: 'chair' as const, x: 10, y: 16 };
  assert.equal(placementProblem(chair, []), undefined);
  assert.match(placementProblem(desk, [chair])!, /家具・小物/);
  assert.match(placementProblem(chair, [desk])!, /家具・小物/);
  assert.match(placementProblem({ ...desk, x: 27 }, [])!, /壁や家具/);
  assert.match(placementProblem({ ...desk, x: 12, y: 7 }, [])!, /壁や家具/);
  assert.match(placementProblem(desk, [], [{ roomId: 'cafe', x: 10, y: 16 }])!, /アバター/);
  assert.match(placementProblem({ ...desk, x: 13, y: 15 }, [])!, /入口/);
  assert.match(placementProblem({ ...desk, x: 13, y: 17 }, [])!, /入口/);
  // Moving the same furniture may overlap its old footprint.
  assert.equal(placementProblem({ ...desk, x: 9 }, [desk]), undefined);
  assert.equal(placementProblem({ ...desk, rotation: 1 }, [desk]), undefined);
  // A 2-tile-wide desk must not close the work area's only doorway.
  assert.match(placementProblem({ ...desk, roomId: 'office', x: 5, y: 9, rotation: 1 }, [])!, /通り道/);
});

test('furniture messages and persisted bounds retain rotation and reject overflowing footprints', () => {
  for (const kind of ['desk', 'chair', 'monitor', 'rack'] as const) {
    const action = { type: 'object-place', kind, x: 8, y: 15, rotation: 3, editId: randomUUID() };
    assert.deepEqual(parseClientMessage(JSON.stringify(action)), action);
    assert.ok(validObject({ ...desk, kind, rotation: 3 }));
  }
  assert.equal(validObject({ ...desk, x: 27 }), false);
  assert.equal(validObject({ ...desk, y: 17, rotation: 1 }), false);
  assert.equal(validObject({ ...desk, x: 26, y: 17 }), true);
});

test('monitor and rack footprints rotate, block walking and protect the operations room entrance', () => {
  for (const kind of ['monitor', 'rack'] as const) for (let rotation = 0; rotation < 4; rotation++) {
    const item: RoomObject = { ...desk, kind, rotation, roomId: 'ops', x: 22, y: 16 };
    const { w, h } = objectSize(kind, rotation);
    assert.equal(placementProblem(item, []), undefined);
    assert.equal(objectTiles(item).length, kind === 'monitor' ? 6 : 4);
    for (const tile of objectTiles(item)) {
      assert.equal(objectContains(item, tile.x, tile.y), true);
      assert.equal(walkableWithObjects(tile.x, tile.y, 'ops', [item]), false);
    }
    assert.equal(validObject({ ...item, x: 29 - w + 1 }), false);
    assert.equal(validObject({ ...item, y: 19 - h + 1 }), false);
    assert.match(placementProblem({ ...item, x: 15, y: 16 }, [])!, /入口/);
    assert.match(placementProblem({ ...item, x: 22, y: 2 }, [])!, /壁や家具/);
  }
});
