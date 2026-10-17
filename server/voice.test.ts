import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import type WebSocket from 'ws';
import { VoiceRoom, readIceProvider } from './voice.ts';
import type { Player, ServerMessage } from '../src/network/protocol.ts';
import type { VoiceSnapshot } from '../src/audio/protocol.ts';

function roomAt(points: Array<{ x: number; y: number }>) {
  const players = new Map<WebSocket, Player>();
  const snapshots = new Map<WebSocket, VoiceSnapshot>();
  const sockets = points.map((point, i) => {
    const ws = {} as WebSocket;
    players.set(ws, { id: `member-${String(i).padStart(2, '0')}`, slot: i + 1, name: '声', outfit: 0, facing: 'down', ...point });
    return ws;
  });
  const room = new VoiceRoom(players, (ws, message: ServerMessage) => {
    if (message.type === 'voice') snapshots.set(ws, message);
  }, []);
  sockets.forEach((ws) => room.state(ws, { listening: true, microphone: true }));
  return { room, players, snapshots, sockets };
}

test('30 voice members form six separate complete groups of five', () => {
  // Proximity groups are separated by distance or room boundaries.
  const centers = [{ x: 3, y: 2 }, { x: 14, y: 2 }, { x: 24, y: 2 }, { x: 3, y: 12 }, { x: 13, y: 12 }, { x: 24, y: 12 }];
  const { snapshots, sockets } = roomAt(centers.flatMap((point) => Array.from({ length: 5 }, () => point)));
  assert.equal(snapshots.size, 30);
  sockets.forEach((ws, i) => {
    const snapshot = snapshots.get(ws)!;
    assert.equal(snapshot.peers.length, 4);
    assert.equal(snapshot.limited, false);
    assert.ok(snapshot.peers.every(({ id }) => Math.floor(Number(id.slice(-2)) / 5) === Math.floor(i / 5)));
    for (const peer of snapshot.peers) {
      const other = sockets[Number(peer.id.slice(-2))];
      assert.equal(snapshots.get(other)!.peers.find(({ id }) => id === `member-${String(i).padStart(2, '0')}`)?.session, peer.session);
    }
  });
});

test('crowding never exceeds four reciprocal peers; existing grants stay stable and revoked grants disappear', () => {
  const { room, snapshots, sockets, players } = roomAt(Array.from({ length: 30 }, () => ({ x: 15, y: 12 })));
  for (const snapshot of snapshots.values()) { assert.ok(snapshot.peers.length <= 4); assert.equal(snapshot.limited, true); }
  const first = snapshots.get(sockets[0])!;
  room.refresh();
  assert.deepEqual(snapshots.get(sockets[0])!.peers, first.peers);
  players.get(sockets[0])!.x = 27;
  room.markDirty(); room.refreshIfDirty();
  assert.equal(snapshots.get(sockets[0])!.peers.length, 0);
  for (const snapshot of snapshots.values()) assert.ok(!snapshot.peers.some(({ id }) => id === 'member-00'));
});

test('TURN credentials are time limited, identity scoped, rotate, and never disclose the shared secret', () => {
  const secret = 'a'.repeat(64);
  let now = 1_800_000;
  const provider = readIceProvider({ TURN_URLS: 'turn:relay.example:3478?transport=udp,turns:relay.example:5349?transport=tcp', TURN_SHARED_SECRET: secret }, () => now);
  const [ice] = provider('member');
  assert.equal(ice.username, '5400:member');
  assert.equal(ice.credential, createHmac('sha1', secret).update(ice.username!).digest('base64'));
  assert.ok(!JSON.stringify(ice).includes(secret));
  assert.deepEqual(provider('member'), [ice]);
  assert.notEqual(provider('other')[0].credential, ice.credential);
  now += 1_800_000;
  assert.notEqual(provider('member')[0].credential, ice.credential);
  assert.throws(() => readIceProvider({ TURN_SHARED_SECRET: 'short', TURN_URLS: 'turn:x' }));
  assert.throws(() => readIceProvider({ TURN_SHARED_SECRET: secret, TURN_URLS: 'https://evil.example' }));
});
