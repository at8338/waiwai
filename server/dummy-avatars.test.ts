import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DummyAvatars, DUMMY_IDS } from './dummy-avatars.ts';
import { ROOMS } from '../src/game/rooms.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import { playerIdentity } from '../src/game/identity.ts';

test('test avatars use distinct walkable tiles in every floor, stable identities and no verified identity', () => {
  const bots = new DummyAvatars(); let slot = 0;
  for (const room of ROOMS) {
    bots.set(true, room.id, () => ++slot, [], []);
    assert.equal(bots.list().length, 3);
    assert.equal(new Set(bots.list().map(p => `${p.x},${p.y}`)).size, 3);
    for (const person of bots.list()) {
      assert.ok(walkableWithObjects(person.x, person.y, room.id, []));
      assert.ok(person.dummy && person.name.includes('テスト')); assert.equal(person.slack, null);
      assert.equal(person.accountId, undefined); assert.equal(playerIdentity(person), `guest:${person.id}`);
    }
    const occupied = { ...bots.list()[0], id: 'human' };
    bots.set(true, room.id, () => ++slot, [occupied], []);
    assert.ok(bots.list().every(p => p.x !== occupied.x || p.y !== occupied.y));
    for (let i = 0; i < 30; i++) {
      bots.tick([occupied], []);
      assert.equal(new Set(bots.list().map(p => `${p.x},${p.y}`)).size, 3);
      assert.ok(bots.list().every(p => walkableWithObjects(p.x, p.y, room.id, []) && (p.x !== occupied.x || p.y !== occupied.y)));
    }
  }
  bots.set(false, 'office', () => ++slot, [], []); assert.equal(bots.list().length, 0);
});

test('dummy commands keep lying avatars still until wake and pause movement during reactions', () => {
  const bots = new DummyAvatars(); let slot = 0; bots.set(true, 'office', () => ++slot, [], []);
  const id = DUMMY_IDS[0];
  assert.match(bots.respond(id, 'こんにちは')!.text, /自動返信/);
  assert.equal(bots.respond(id, '寝て')!.player.resting, true);
  assert.equal(bots.tick([], [], 1000).some(p => p.id === id), false);
  assert.equal(bots.respond(id, '起きて')!.player.resting, false);
  assert.equal(bots.respond(id, 'ジャンプ', 1000)!.reaction, 'jump');
  assert.equal(bots.tick([], [], 1001).some(p => p.id === id), false);
  assert.equal(bots.respond(id, 'お辞儀')!.reaction, 'bow');
  bots.set(false, 'office', () => ++slot, [], []); assert.equal(bots.respond(id, 'hello'), undefined);
});

test('dummy control rejects malformed actions and browser profile flags cannot create test identities', () => {
  const actionId = '00000000-0000-4000-a000-000000000010';
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'dummy-control', enabled: true, roomId: 'cafe', actionId })), { type: 'dummy-control', enabled: true, roomId: 'cafe', actionId });
  for (const bad of [{ enabled: 'true' }, { actionId: 'bad' }, { roomId: 'secret' }]) assert.equal(parseClientMessage(JSON.stringify({ type: 'dummy-control', enabled: true, actionId, ...bad })), undefined);
  const profile = parseClientMessage(JSON.stringify({ type: 'profile', name: 'spoof', outfit: 0, dummy: true }));
  assert.ok(profile && !('dummy' in profile));
});

test('summoned dummies pause, then roam around their arrival instead of the old room spawn', () => {
  const bots = new DummyAvatars(); let slot = 0; bots.set(true, 'office', () => ++slot, [], []);
  const person = bots.list()[0], id = person.id;
  Object.assign(person, { roomId: 'cafe', x: 2, y: 16 }); bots.summoned(id, 1000);
  for (const now of [1000, 5000, 10999]) {
    assert.equal(bots.tick([], [], now).some(p => p.id === id), false);
    assert.deepEqual([person.x, person.y], [2, 16]);
  }
  let moved = false;
  for (let i = 0; i < 30; i++) {
    if (bots.tick([], [], 11000 + i * 1100).some(p => p.id === id)) moved = true;
    assert.equal(person.roomId, 'cafe'); assert.equal(person.id, id);
    assert.ok(walkableWithObjects(person.x, person.y, person.roomId, []));
    assert.ok(Math.abs(person.x - 2) <= 7 && Math.abs(person.y - 16) <= 6);
  }
  assert.ok(moved, 'the arrival is outside the original spawn radius but must not freeze the dummy');
});
