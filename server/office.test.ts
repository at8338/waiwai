import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { getRoom } from '../src/game/rooms.ts';
import { ObjectStore } from './objects.ts';
import { LinkStore } from './links.ts';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { attachOffice } from './office.ts';
import type { ServerMessage, Player } from '../src/network/protocol.ts';
import { MAX_PLAYERS, directions, parseClientMessage } from '../src/network/protocol.ts';
import { MAX_VOICE_MEMBERS, MAX_VOICE_PEERS } from '../src/audio/proximity.ts';
import { STEP_MS, canWalk } from '../src/game/world.ts';
import { REACTION_COOLDOWN_MS } from '../src/game/reactions.ts';

async function fixture(t: TestContext, objectsFile?: string, linksFile?: string) {
  const server = createServer((_request, response) => response.end('ok'));
  const dispose = attachOffice(server, undefined, { objectsFile, linksFile });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const clients: WebSocket[] = [];
  t.after(async () => {
    clients.forEach((client) => client.terminate());
    dispose();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  const connect = async () => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + '/office', { origin });
    clients.push(ws);
    const inbox: ServerMessage[] = [];
    const seen: ServerMessage[] = [];
    const waiters = new Set<() => void>();
    ws.on('error', () => {});
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString()) as ServerMessage;
      inbox.push(message);
      seen.push(message);
      for (const notify of [...waiters]) notify();
    });
    const next = <T extends ServerMessage['type']>(type: T, predicate: (message: Extract<ServerMessage, { type: T }>) => boolean = () => true) =>
      new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
        const timeout = setTimeout(() => { waiters.delete(check); reject(new Error(`Timed out waiting for ${type}`)); }, 2000);
        const check = () => {
          const index = inbox.findIndex((message) => message.type === type && predicate(message as Extract<ServerMessage, { type: T }>));
          if (index === -1) return;
          clearTimeout(timeout);
          waiters.delete(check);
          resolve(inbox.splice(index, 1)[0] as Extract<ServerMessage, { type: T }>);
        };
        waiters.add(check);
        check();
      });
    const welcome = await next('welcome');
    return { ws, next, welcome, seen, send: (message: unknown) => ws.send(JSON.stringify(message)) };
  };
  return { connect, origin };
}

test('two clients receive each other, profile changes, and the same authoritative movement', async (t) => {
  const { connect } = await fixture(t);
  const a = await connect();
  const b = await connect();
  assert.equal(b.welcome.players.length, 2);
  const joined = await a.next('player', (m) => m.reason === 'join');
  assert.equal(joined.player.id, b.welcome.id);
  assert.notDeepEqual(joined.player, b.welcome.players.find((p) => p.id === a.welcome.id));
  b.send({ type: 'profile', name: '<はな>', outfit: 2 });
  assert.equal((await a.next('player', (m) => m.reason === 'profile')).player.name, '<はな>');
  assert.equal((await b.next('player', (m) => m.reason === 'profile')).player.outfit, 2);
  const initial = a.welcome.players[0];
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  const movedA = await a.next('player', (m) => m.reason === 'move');
  const movedB = await b.next('positions', (m) => m.positions.some(([slot]) => slot === a.welcome.players[0].slot));
  assert.deepEqual(movedB.positions.find(([slot]) => slot === a.welcome.players[0].slot),
    [movedA.player.slot, movedA.player.x, movedA.player.y, directions.indexOf(movedA.player.facing)]);
  assert.deepEqual([movedA.player.x, movedA.player.y], [initial.x + 1, initial.y]);
  assert.equal(movedA.requestId, 1);
  // A client cannot teleport itself or impersonate another participant.
  a.send({ type: 'profile', name: '改名', outfit: 1, id: b.welcome.id, x: 100, y: 100 });
  const updated = (await a.next('player', (m) => m.reason === 'profile')).player;
  assert.equal(updated.id, a.welcome.id);
  assert.deepEqual([updated.x, updated.y], [movedA.player.x, movedA.player.y]);
});

test('the server rejects rapid steps, blocked destinations, and invalid messages', async (t) => {
  const { connect } = await fixture(t);
  const a = await connect();
  const initial = a.welcome.players[0];
  a.send({ type: 'move', direction: 'left', requestId: 1 });
  const first = (await a.next('player', (m) => m.reason === 'move')).player;
  a.send({ type: 'move', direction: 'left', requestId: 2 });
  const rapid = (await a.next('player', (m) => m.requestId === 2)).player;
  assert.equal(rapid.x, first.x);
  assert.equal(first.x, initial.x - 1);
  let player: Player = rapid;
  for (let requestId = 3; requestId < 18; requestId++) {
    await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
    a.send({ type: 'move', direction: 'up', requestId });
    player = (await a.next('player', (m) => m.requestId === requestId)).player;
    assert.ok(canWalk(player.x, player.y));
  }
  assert.equal(player.y, 7); // Meeting table occupies y=4..6.
  a.ws.send('not json');
  a.send({ type: 'move', direction: 'teleport', requestId: 100 });
  a.send({ type: 'profile', name: '\u0000はな\u202e', outfit: 0 });
  const profile = await a.next('player', (m) => m.reason === 'profile');
  assert.equal(profile.player.name, 'はな');
  assert.equal(profile.player.y, 7);
});

test('reset is shared; leaving removes a player; joining again receives a clean snapshot', async (t) => {
  const { connect } = await fixture(t);
  const a = await connect();
  const b = await connect();
  await a.next('player', (m) => m.reason === 'join');
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  await b.next('positions');
  a.send({ type: 'reset', requestId: 2 });
  const reset = await b.next('positions', (m) => m.positions.some(([slot,,, flags]) => slot === a.welcome.players[0].slot && !!(flags & 4)));
  const position = reset.positions.find(([slot]) => slot === a.welcome.players[0].slot)!;
  assert.ok(canWalk(position[1], position[2]));
  assert.equal(position[3] & 3, directions.indexOf('down'));
  assert.ok(position[3] & 4);
  b.ws.close();
  assert.equal((await a.next('left')).id, b.welcome.id);
  const rejoined = await connect();
  assert.equal(rejoined.welcome.players.length, 2);
  assert.notEqual(rejoined.welcome.id, b.welcome.id);
  assert.ok(!rejoined.welcome.players.some((player) => player.id === b.welcome.id));
});

test('malformed actions and invalid outfits are not accepted', () => {
  for (const message of ['null', '[]', '{}', '{', '{"type":"reset"}', '{"type":"move","direction":"up","requestId":-1}', '{"type":"profile","name":"A","outfit":3}']) {
    assert.equal(parseClientMessage(message), undefined);
  }
});

test('cross-origin browser connections are refused', async (t) => {
  const { origin } = await fixture(t);
  const ws = new WebSocket(origin.replace('http:', 'ws:') + '/office', { origin: 'https://unrelated.example' });
  t.after(() => ws.terminate());
  let opened = false;
  ws.on('open', () => { opened = true; });
  ws.on('error', () => {});
  await new Promise((resolve) => ws.once('close', resolve));
  assert.equal(opened, false);
});

test('voice signaling requires both participants to join and a current proximity grant', async (t) => {
  const { connect } = await fixture(t);
  const a = await connect();
  const b = await connect();
  const payload = { kind: 'description', type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
  const signalsReceived = () => b.seen.filter((message) => message.type === 'voice-signal').length;
  a.send({ type: 'voice-signal', to: b.welcome.id, session: 'ungranted', payload });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(signalsReceived(), 0);
  a.send({ type: 'voice-state', listening: true, microphone: false });
  assert.equal((await a.next('voice')).peers.length, 0);
  b.send({ type: 'voice-state', listening: true, microphone: false });
  const grantA = await a.next('voice', (message) => message.peers.length === 1);
  const grantB = await b.next('voice', (message) => message.peers.length === 1);
  assert.equal(grantA.peers[0].session, grantB.peers[0].session);
  a.send({ type: 'voice-signal', to: b.welcome.id, session: grantA.peers[0].session, from: 'forged', payload });
  const relayed = await b.next('voice-signal');
  assert.equal(relayed.from, a.welcome.id);
  assert.deepEqual(relayed.payload, payload);
  a.send({ type: 'voice-state', listening: true, microphone: true });
  assert.equal((await b.next('voice', (message) => message.peers[0]?.microphone === true)).peers[0].microphone, true);
  for (let i = 0; i < 5; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
    a.send({ type: 'move', direction: 'right', requestId: i + 1 });
    await a.next('player', (message) => message.requestId === i + 1);
  }
  assert.equal((await a.next('voice', (message) => message.peers.length === 0)).peers.length, 0);
  await b.next('voice', (message) => message.peers.length === 0);
  a.send({ type: 'voice-signal', to: b.welcome.id, session: grantA.peers[0].session, payload });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(signalsReceived(), 1);
  a.send({ type: 'reset', requestId: 10 });
  const newGrant = await a.next('voice', (message) => message.peers.length === 1 && message.peers[0].session !== grantA.peers[0].session);
  await b.next('voice', (message) => message.peers.length === 1);
  assert.notEqual(newGrant.peers[0].session, grantA.peers[0].session);
  a.send({ type: 'voice-signal', to: b.welcome.id, session: grantA.peers[0].session, payload });
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(signalsReceived(), 1);
  a.send({ type: 'voice-state', listening: false, microphone: true });
  const ended = await a.next('voice', (message) => !message.self.listening);
  assert.equal(ended.self.microphone, false);
  assert.equal((await b.next('voice', (message) => message.peers.length === 0)).peers.length, 0);
});

test('voice limits simultaneous participation and frees capacity on exit', async (t) => {
  const { connect } = await fixture(t);
  const clients = [];
  for (let i = 0; i < MAX_VOICE_MEMBERS + 1; i++) clients.push(await connect());
  for (const client of clients.slice(0, MAX_VOICE_MEMBERS)) {
    client.send({ type: 'voice-state', listening: true, microphone: false });
    const snapshot = await client.next('voice', (message) => message.self.listening);
    assert.ok(snapshot.peers.length <= MAX_VOICE_PEERS);
  }
  const last = clients[MAX_VOICE_MEMBERS];
  last.send({ type: 'voice-state', listening: true, microphone: false });
  assert.equal((await last.next('voice')).error, 'capacity');
  clients[0].send({ type: 'voice-state', listening: false, microphone: false });
  await clients[0].next('voice', (message) => !message.self.listening);
  last.send({ type: 'voice-state', listening: true, microphone: false });
  assert.equal((await last.next('voice', (message) => message.self.listening)).self.listening, true);
});

test('Slack IDs synchronize in profiles and join snapshots, reject invalid edits, and can be cleared', async (t) => {
  const { connect } = await fixture(t);
  const a = await connect();
  const b = await connect();
  const slack = { teamId: 'T012ABCDEF', userId: 'U012ABCDEF' };
  a.send({ type: 'profile', name: 'あさ', outfit: 1, slack });
  const shared = await b.next('player', (message) => message.reason === 'profile');
  assert.deepEqual(shared.player.slack, slack);
  assert.equal(shared.player.id, a.welcome.id);
  const c = await connect();
  assert.deepEqual(c.welcome.players.find((player) => player.id === a.welcome.id)?.slack, slack);
  a.send({ type: 'profile', name: '改名', outfit: 2, slack });
  const renamed = await b.next('player', (message) => message.reason === 'profile');
  assert.equal(renamed.player.name, '改名');
  assert.equal(renamed.player.outfit, 2);
  assert.deepEqual(renamed.player.slack, slack);
  a.send({ type: 'profile', name: '不正', outfit: 0, slack: { ...slack, userId: 'U012ABCDEF&team=TOTHER' } });
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  const afterInvalid = await a.next('player', (message) => message.requestId === 1);
  assert.equal(afterInvalid.player.name, '改名');
  assert.deepEqual(afterInvalid.player.slack, slack);
  a.send({ type: 'profile', name: '改名', outfit: 2, slack: null });
  assert.equal((await b.next('player', (message) => message.reason === 'profile')).player.slack, null);
});

// Exercise real upgrades at the production limit, including capacity recovery.
test('150 clients join, compact frames coalesce moves and the 151st is refused', async (t) => {
  const { connect, origin } = await fixture(t);
  const clients: Awaited<ReturnType<typeof connect>>[] = [];
  for (let i = 0; i < MAX_PLAYERS; i++) clients.push(await connect());
  assert.equal(clients.at(-1)!.welcome.players.length, MAX_PLAYERS);
  const extra = new WebSocket(origin.replace('http:', 'ws:') + '/office', { origin });
  extra.on('error', () => {});
  let opened = false; extra.on('open', () => { opened = true; });
  await new Promise((resolve) => extra.once('close', resolve));
  assert.equal(opened, false);
  const [a, b] = clients;
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  const ack = await a.next('player', (m) => m.requestId === 1);
  const frame = await b.next('positions', (m) => m.positions.some(([slot]) => slot === a.welcome.players[0].slot));
  assert.deepEqual(frame.positions.find(([slot]) => slot === a.welcome.players[0].slot),
    [ack.player.slot, ack.player.x, ack.player.y, directions.indexOf(ack.player.facing)]);
  assert.ok(!JSON.stringify(frame).includes('slack'));
  for (const client of clients) client.send({ type: 'reaction', kind: 'cheer' });
  for (const client of clients) await client.next('reaction', (m) => m.playerId === client.welcome.id);
  await a.next('reaction', (m) => m.playerId === clients.at(-1)!.welcome.id);
  assert.equal(new Set(a.seen.filter((m) => m.type === 'reaction').map((m) => m.playerId)).size, MAX_PLAYERS);
  assert.ok(clients.every((client) => client.ws.readyState === WebSocket.OPEN));
  clients.at(-1)!.ws.close();
  await a.next('left');
  assert.equal((await connect()).welcome.players.length, MAX_PLAYERS);
});


test('appearance synchronizes and invalid edits cannot alter profile or room', async (t) => {
  const { connect } = await fixture(t); const a = await connect(); const b = await connect();
  const appearance = { ...DEFAULT_APPEARANCE, gender: 2, body: 2, height: 2, skin: 5, hair: 2, hairColor: 4, clothing: 1, color: 5, accessory: 1 };
  a.send({ type: 'profile', name: '着替え', outfit: 2, appearance, roomId: 'sky' });
  const changed = await b.next('player', (m) => m.reason === 'profile');
  assert.deepEqual(changed.player.appearance, appearance); assert.equal(changed.player.roomId, 'office');
  const c = await connect(); assert.deepEqual(c.welcome.players.find((p) => p.id === a.welcome.id)?.appearance, appearance);
  a.send({ type: 'profile', name: '不正', outfit: 0, appearance: { ...appearance, body: 99 } });
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  assert.equal((await a.next('player', (m) => m.requestId === 1)).player.name, '着替え');
});

test('room transitions are authoritative, stop old voice grants and reconnect only inside the same room', async (t) => {
  const { connect } = await fixture(t); const a = await connect(); const b = await connect();
  a.send({ type: 'voice-state', listening: true, microphone: false });
  b.send({ type: 'voice-state', listening: true, microphone: false });
  const oldGrant = await a.next('voice', (m) => m.peers.length === 1);
  await b.next('voice', (m) => m.peers.length === 1);
  a.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  const moved = await a.next('player', (m) => m.reason === 'room');
  assert.equal(moved.player.roomId, 'cafe'); assert.deepEqual({ x: moved.player.x, y: moved.player.y }, getRoom('cafe').spawn);
  assert.equal((await b.next('player', (m) => m.reason === 'room')).player.roomId, 'cafe');
  await a.next('objects', (m) => m.roomId === 'cafe');
  await a.next('voice', (m) => m.peers.length === 0); await b.next('voice', (m) => m.peers.length === 0);
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 2 });
  const newGrant = await a.next('voice', (m) => m.peers.length === 1);
  assert.notEqual(newGrant.peers[0].session, oldGrant.peers[0].session);
  a.send({ type: 'reset', requestId: 3 });
  assert.equal((await a.next('player', (m) => m.requestId === 3)).player.roomId, 'cafe');
});

test('shared objects are room scoped, owner editable, solid and persistent', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-room-edit-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'objects.json');
  const { connect } = await fixture(t, file); const a = await connect(); const b = await connect();
  a.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  await a.next('objects', (m) => m.roomId === 'cafe');
  const editId = randomUUID();
  a.send({ type: 'object-place', kind: 'plant', x: 16, y: 16, rotation: 0, editId });
  assert.equal((await a.next('object-result')).error, undefined);
  const saved = (await a.next('objects', (m) => m.objects.length === 1)).objects[0];
  assert.equal(new ObjectStore(file).list()[0].id, saved.id);
  assert.ok(!b.seen.some((m) => m.type === 'objects' && m.roomId === 'cafe'));
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 2 });
  assert.equal((await b.next('objects', (m) => m.roomId === 'cafe')).objects[0].id, saved.id);
  b.send({ type: 'object-remove', id: saved.id, editId: randomUUID() });
  assert.match((await b.next('object-result')).error!, /自分が置いた/);
  await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
  a.send({ type: 'move', direction: 'right', requestId: 2 }); await a.next('player', (m) => m.requestId === 2);
  await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
  a.send({ type: 'move', direction: 'up', requestId: 3 });
  const blocked = await a.next('player', (m) => m.requestId === 3);
  assert.deepEqual([blocked.player.x, blocked.player.y], [16, 17]);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-move', id: saved.id, x: 17, y: 16, rotation: 1, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  assert.equal((await b.next('objects', (m) => m.objects[0]?.x === 17)).objects[0].rotation, 1);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-remove', id: saved.id, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  assert.equal((await b.next('objects', (m) => m.roomId === 'cafe' && m.objects.length === 0)).objects.length, 0);
  assert.equal(new ObjectStore(file).list().length, 0);
});

test('desks and chairs share, persist, move, rotate and remove with full-footprint collision', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-furniture-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'objects.json');
  const { connect } = await fixture(t, file); const a = await connect(); const b = await connect();
  a.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  await a.next('objects', (m) => m.roomId === 'cafe'); await b.next('objects', (m) => m.roomId === 'cafe');
  a.send({ type: 'object-place', kind: 'desk', x: 18, y: 15, rotation: 0, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const desk = (await b.next('objects', (m) => m.objects.some((o) => o.kind === 'desk'))).objects[0];
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, STEP_MS + 10));
    a.send({ type: 'move', direction: 'right', requestId: i + 2 }); await a.next('player', (m) => m.requestId === i + 2);
  }
  await new Promise((resolve) => setTimeout(resolve, STEP_MS + 10));
  a.send({ type: 'move', direction: 'up', requestId: 7 });
  const blocked = await a.next('player', (m) => m.requestId === 7);
  assert.deepEqual([blocked.player.x, blocked.player.y], [20, 17]);
  a.send({ type: 'object-place', kind: 'chair', x: 22, y: 17, rotation: 2, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const chair = (await b.next('objects', (m) => m.objects.length === 2)).objects.find((o) => o.kind === 'chair')!;
  assert.equal(chair.rotation, 2);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-move', id: desk.id, x: 18, y: 12, rotation: 1, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const moved = (await b.next('objects', (m) => m.objects.some((o) => o.id === desk.id && o.rotation === 1))).objects;
  assert.deepEqual(new ObjectStore(file).list(), moved);
  b.send({ type: 'object-move', id: chair.id, x: 23, y: 17, rotation: 3, editId: randomUUID() });
  assert.match((await b.next('object-result')).error!, /自分が置いた/);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-remove', id: desk.id, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  assert.equal((await b.next('objects', (m) => m.objects.length === 1)).objects[0].id, chair.id);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-remove', id: chair.id, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  await b.next('objects', (m) => m.objects.length === 0);
  assert.equal(new ObjectStore(file).list().length, 0);
});

test('person warps synchronize across rooms, revoke old voice pairs, reject stale targets and retain movement limits', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect(), c = await connect();
  b.send({ type: 'profile', name: 'はな', outfit: 0 });
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  const target = (await b.next('player', (m) => m.reason === 'room' && m.player.id === b.welcome.id)).player;
  const directory = await a.next('directory', (m) => m.people.some((p) => p.name === 'はな' && p.roomId === 'cafe'));
  assert.equal(directory.people.find((p) => p.name === 'はな')!.online, true);
  for (const client of [a, b, c]) client.send({ type: 'voice-state', listening: true, microphone: false });
  await a.next('voice', (m) => m.peers.some((p) => p.id === c.welcome.id));
  a.send({ type: 'warp-to', targetId: target.id, requestId: 2, x: 999, y: 999 });
  const warped = (await a.next('player', (m) => m.reason === 'warp' && m.player.id === a.welcome.id)).player;
  assert.equal(warped.roomId, 'cafe'); assert.equal(Math.abs(warped.x - target.x) + Math.abs(warped.y - target.y), 1);
  assert.ok(canWalk(warped.x, warped.y, warped.roomId));
  assert.equal((await c.next('player', (m) => m.reason === 'warp')).player.id, a.welcome.id);
  await a.next('objects', (m) => m.roomId === 'cafe');
  await a.next('voice', (m) => m.peers.some((p) => p.id === target.id));
  await c.next('voice', (m) => m.peers.length === 0);
  a.send({ type: 'move', direction: 'left', requestId: 3 });
  const blocked = (await a.next('player', (m) => m.requestId === 3)).player;
  assert.deepEqual([blocked.x, blocked.y], [warped.x, warped.y]);
  a.send({ type: 'warp-to', targetId: c.welcome.id, requestId: 4 });
  assert.match((await a.next('travel-error', (m) => m.requestId === 4)).error, /少し待って/);
  b.ws.close(); await a.next('left', (m) => m.id === target.id);
  await new Promise((resolve) => setTimeout(resolve, 1010));
  a.send({ type: 'warp-to', targetId: target.id, requestId: 5 });
  assert.match((await a.next('travel-error', (m) => m.requestId === 5)).error, /オフライン/);
  a.send({ type: 'reset', requestId: 6 });
  assert.equal((await a.next('player', (m) => m.requestId === 6)).player.roomId, 'cafe');
  assert.ok(!a.seen.some((m) => m.type === 'player' && m.reason === 'warp' && m.requestId === 5));
});

test('shared favorites support multiple links on fixed furniture, persist, deduplicate and remain room scoped', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-link-share-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'links.json');
  const { connect } = await fixture(t, undefined, file); const a = await connect(), b = await connect();
  const add = async (url: string) => {
    const editId = randomUUID(); a.send({ type: 'favorite-add', title: 'ボード', url, editId });
    const result = await a.next('link-result', (m) => m.editId === editId);
    assert.equal(result.error, undefined); return result.favoriteId!;
  };
  const first = await add('https://example.com/first');
  await new Promise((r) => setTimeout(r, 360));
  const second = await add('https://example.com/second');
  await new Promise((r) => setTimeout(r, 360));
  assert.equal(await add('https://example.com/first'), first);
  const bind = async (objectId: string, linkIds: string[]) => {
    await new Promise((r) => setTimeout(r, 360));
    const editId = randomUUID(); a.send({ type: 'object-links-set', objectId, linkIds, editId });
    return a.next('link-result', (m) => m.editId === editId);
  };
  assert.equal((await bind('fixed:office:desk:2:3', [first, second])).error, undefined);
  const shared = await b.next('object-links', (m) => m.bindings.some((b) => b.linkIds.length === 2));
  assert.deepEqual(shared.bindings[0].linkIds, [first, second]); assert.equal(shared.favorites.length, 2);
  assert.deepEqual(new LinkStore(file).list().bindings, shared.bindings);
  const c = await connect(); assert.deepEqual((await c.next('object-links')).bindings, shared.bindings);
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  const cafe = await b.next('object-links', (m) => m.roomId === 'cafe');
  assert.equal(cafe.bindings.length, 0); assert.equal(cafe.favorites.length, 2);
  assert.match((await bind('fixed:cafe:counter:4:3', [first])).error!, /見つかりません/);
  assert.match((await bind('fixed:office:desk:2:3', [randomUUID()])).error!, /お気に入り/);
  assert.equal((await bind('fixed:office:desk:2:3', [])).error, undefined);
  assert.equal((await c.next('object-links', (m) => !m.bindings.length)).bindings.length, 0);
  assert.equal(new LinkStore(file).list().bindings.length, 0);
});

test('placed furniture links follow movement, allow only owner edits, and disappear when removed', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  for (const client of [a, b]) { client.send({ type: 'change-room', roomId: 'cafe', requestId: 1 }); await client.next('objects', (m) => m.roomId === 'cafe'); }
  a.send({ type: 'object-place', kind: 'desk', x: 18, y: 12, rotation: 0, editId: randomUUID() });
  await a.next('object-result');
  const desk = (await b.next('objects', (m) => m.objects.length === 1)).objects[0];
  a.send({ type: 'favorite-add', title: '資料', url: 'https://example.com/docs', editId: randomUUID() });
  const id = (await a.next('link-result')).favoriteId!;
  await new Promise((r) => setTimeout(r, 360));
  a.send({ type: 'object-links-set', objectId: `placed:${desk.id}`, linkIds: [id], editId: randomUUID() });
  assert.equal((await a.next('link-result')).error, undefined);
  await b.next('object-links', (m) => m.bindings.some((binding) => binding.objectId === `placed:${desk.id}`));
  b.send({ type: 'object-links-set', objectId: `placed:${desk.id}`, linkIds: [], editId: randomUUID() });
  assert.match((await b.next('link-result')).error!, /配置した本人/);
  a.send({ type: 'object-move', id: desk.id, x: 20, y: 12, rotation: 1, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const c = await connect(); c.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  assert.equal((await c.next('object-links', (m) => m.roomId === 'cafe')).bindings[0].objectId, `placed:${desk.id}`);
  await new Promise((r) => setTimeout(r, 360));
  a.send({ type: 'object-remove', id: desk.id, editId: randomUUID() }); await a.next('object-result');
  const d = await connect(); d.send({ type: 'change-room', roomId: 'cafe', requestId: 1 });
  assert.equal((await d.next('object-links', (m) => m.roomId === 'cafe')).bindings.length, 0);
  a.send({ type: 'object-links-set', objectId: `placed:${desk.id}`, linkIds: [id], editId: randomUUID() });
  assert.match((await a.next('link-result')).error!, /見つかりません/);
});

test('the operations room shares named monitor links and supports placing and rotating monitoring furniture', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  for (const client of [a, b]) {
    client.send({ type: 'change-room', roomId: 'ops', requestId: 1 });
    const moved = await client.next('player', (m) => m.reason === 'room' && m.player.id === client.welcome.id);
    assert.equal(moved.player.roomId, 'ops');
    await client.next('object-links', (m) => m.roomId === 'ops');
  }
  a.send({ type: 'favorite-add', title: 'Monitoring dashboard', url: 'https://example.com/dashboard', editId: randomUUID() });
  const linkId = (await a.next('link-result')).favoriteId!;
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-links-set', objectId: 'fixed:ops:monitor:22:2', linkIds: [linkId], editId: randomUUID() });
  assert.equal((await a.next('link-result')).error, undefined);
  assert.equal((await b.next('object-links', (m) => m.bindings.length === 1)).bindings[0].objectId, 'fixed:ops:monitor:22:2');
  a.send({ type: 'object-place', kind: 'monitor', x: 22, y: 16, rotation: 0, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const monitor = (await b.next('objects', (m) => m.roomId === 'ops' && m.objects.length === 1)).objects[0];
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-move', id: monitor.id, x: 25, y: 16, rotation: 1, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  assert.equal((await b.next('objects', (m) => m.objects[0]?.rotation === 1)).objects[0].x, 25);
  await new Promise((resolve) => setTimeout(resolve, 360));
  a.send({ type: 'object-place', kind: 'rack', x: 21, y: 16, rotation: 2, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  assert.ok((await b.next('objects', (m) => m.objects.length === 2)).objects.some((o) => o.kind === 'rack'));
});

test('reactions share only with the current room, use the authenticated connection actor, throttle repeats and do not alter position', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect(), c = await connect();
  c.send({ type: 'change-room', roomId: 'cafe', requestId: 1 }); await c.next('objects', (m) => m.roomId === 'cafe');
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  a.send({ type: 'reaction', kind: 'bow', playerId: b.welcome.id, roomId: 'cafe', x: 999, y: 999 });
  const baseline = (await a.next('player', (m) => m.reason === 'move' && m.player.id === a.welcome.id && m.requestId === 1)).player;
  const self = await a.next('reaction'), shared = await b.next('reaction');
  assert.deepEqual(shared, { type: 'reaction', kind: 'bow', playerId: a.welcome.id, roomId: 'office' });
  assert.deepEqual(shared, self);
  const stepIndex = b.seen.findIndex((m) => m.type === 'positions' && m.positions.some(([slot]) => slot === baseline.slot));
  assert.ok(stepIndex >= 0 && stepIndex < b.seen.findIndex((m) => m.type === 'reaction'));
  a.send({ type: 'reaction', kind: 'joy' }); a.send({ type: 'reaction', kind: 'cheer' });
  a.send({ type: 'profile', name: 'リアクション', outfit: 0 });
  const unchanged = (await a.next('player', (m) => m.reason === 'profile')).player;
  assert.deepEqual([unchanged.x, unchanged.y, unchanged.roomId], [baseline.x, baseline.y, baseline.roomId]);
  assert.equal(a.seen.filter((m) => m.type === 'reaction').length, 1);
  assert.equal(c.seen.filter((m) => m.type === 'reaction').length, 0);
  const newcomer = await connect(); assert.equal(newcomer.seen.filter((m) => m.type === 'reaction').length, 0);
  await new Promise((resolve) => setTimeout(resolve, REACTION_COOLDOWN_MS + 10));
  a.send({ type: 'change-room', roomId: 'cafe', requestId: 2 }); await a.next('objects', (m) => m.roomId === 'cafe');
  a.send({ type: 'reaction', kind: 'jump' });
  assert.equal((await c.next('reaction')).playerId, a.welcome.id);
  await a.next('reaction', (m) => m.kind === 'jump');
  assert.equal(b.seen.filter((m) => m.type === 'reaction').length, 1);
});
