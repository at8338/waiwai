import { LOST_ITEMS_EPOCH, LOST_ITEM_PERIOD_MS } from '../src/game/lost-items.ts';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { defaultWorldPolicy } from '../src/game/world-policy.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { getRoom, ROOMS } from '../src/game/rooms.ts';
import { ObjectStore } from './objects.ts';
import { LinkStore } from './links.ts';
import { AnnouncementStore } from './announcements.ts';
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

async function fixture(t: TestContext, objectsFile?: string, linksFile?: string, announcementsFile?: string, eventClock?: () => number, lostClock?: () => number, birthdayClock?: () => number, devControls = false, policyFile?: string) {
  const server = createServer((_request, response) => response.end('ok'));
  const dispose = attachOffice(server, undefined, { objectsFile, linksFile, announcementsFile, eventClock, lostClock, birthdayClock, devControls, policyFile });
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

test('persisted administrator bans survive developer resets and cannot be bypassed by forced spawns', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-dev-policy-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const policyFile = join(dir, 'policy.json'), policy = defaultWorldPolicy();
  policy.blocked.pokemon = ['mew']; policy.blocked.incidents = ['meteor-01']; policy.blocked.rooms = ['cafe']; policy.blocked.residents = ['dog'];
  await writeFile(policyFile, JSON.stringify({ version: 1, policy }));
  const { connect } = await fixture(t, undefined, undefined, undefined, undefined, undefined, undefined, true, policyFile);
  const a = await connect();
  assert.deepEqual((await a.next('world-policy')).policy.blocked, policy.blocked);
  const initialPets = await a.next('pets'); assert.ok(initialPets.pets.every(p => p.kind !== 'dog' && p.kind !== 'mew'));
  for (const command of [{ command: 'pokemon', kinds: ['mew'] }, { command: 'event', episodeId: 'meteor-01' }, { command: 'pokemon', kinds: ['pikachu'], roomId: 'cafe' }]) {
    const actionId = randomUUID(); a.send({ type: 'dev-world', actionId, ...command });
    assert.match((await a.next('dev-world-result', m => m.actionId === actionId)).error!, /禁止/);
  }
  const reset = randomUUID(); a.send({ type: 'dev-world', command: 'reset', actionId: reset });
  assert.equal((await a.next('dev-world-result', m => m.actionId === reset)).error, undefined);
  const afterReset = await a.next('pets'); assert.ok(afterReset.pets.every(p => p.kind !== 'dog' && p.kind !== 'mew'));
  const late = await connect(); assert.deepEqual((await late.next('world-policy')).policy.blocked, policy.blocked);
});

test('developer world controls synchronize previews and spawns while ordinary servers reject mutations', async (t) => {
  const { connect } = await fixture(t, undefined, undefined, undefined, undefined, undefined, undefined, true);
  const a = await connect(), b = await connect();
  assert.equal((await a.next('dev-world-state')).pokemon.length, 7);
  await b.next('dev-world-state');
  const incidentId = randomUUID(); a.send({ type: 'dev-world', command: 'event', episodeId: 'meteor-01', roomId: 'office', actionId: incidentId });
  assert.equal((await a.next('dev-world-result', (m) => m.actionId === incidentId)).error, undefined);
  assert.equal((await b.next('daily-event', (m) => !!m.preview)).event.episodeId, 'meteor-01');
  await new Promise((resolve) => setTimeout(resolve, 260));
  const pokemonId = randomUUID(); a.send({ type: 'dev-world', command: 'pokemon', kinds: ['mew', 'gengar'], roomId: 'office', actionId: pokemonId });
  assert.equal((await a.next('dev-world-result', (m) => m.actionId === pokemonId)).error, undefined);
  const pets = await b.next('pets', (m) => m.pets.some((pet) => pet.kind === 'mew'));
  assert.deepEqual(pets.pets.filter((pet) => !['dog', 'cat', 'vacuum'].includes(pet.kind)).map((pet) => pet.kind), ['mew', 'gengar']);
  await new Promise((resolve) => setTimeout(resolve, 260));
  const lostId = randomUUID(); a.send({ type: 'dev-world', command: 'lost', kind: 'box', roomId: 'office', actionId: lostId });
  assert.equal((await a.next('dev-world-result', (m) => m.actionId === lostId)).error, undefined);
  assert.ok((await b.next('lost-items', (m) => m.items.some((item) => item.kind === 'box'))).items.some((item) => item.kind === 'box' && item.roomId === 'office'));
  const late = await connect(); assert.equal((await late.next('dev-world-state')).pokemon.length, 2);
  assert.equal((await late.next('daily-event')).event.episodeId, 'meteor-01');
  await new Promise((resolve) => setTimeout(resolve, 260));
  a.send({ type: 'dev-world', command: 'reset', actionId: randomUUID() });
  const restored = await b.next('dev-world-state', (m) => !m.preview); assert.equal(restored.pokemon.length, 7);
  const ordinary = await fixture(t), c = await ordinary.connect();
  c.send({ type: 'dev-world', command: 'pokemon', kinds: [], actionId: randomUUID() });
  assert.match((await c.next('dev-world-result')).error!, /専用/);
  assert.equal(c.seen.some((m) => m.type === 'dev-world-state'), false);
});

test('birthday registration and one cheer are shared across rooms; guests can only edit themselves and leave no registration after exit', async (t) => {
  let now = Date.parse('2026-10-17T12:00:00+09:00');
  const { connect } = await fixture(t, undefined, undefined, undefined, undefined, undefined, () => now);
  const a = await connect(), b = await connect();
  const self = (await a.next('birthdays')).selfId;
  b.send({ type: 'change-room', roomId: 'library', requestId: 1 }); await b.next('player', (m) => m.reason === 'room');
  const actionId = randomUUID(); a.send({ type: 'birthday-save', month: 10, day: 17, expectedVersion: 0, actionId, id: 'slack:T1:U2', name: 'forged' });
  assert.equal((await a.next('birthday-result', (m) => m.actionId === actionId)).error, undefined);
  const state = await b.next('birthdays', (m) => m.entries.length === 1);
  assert.equal(state.entries[0].id, self); assert.equal(state.entries[0].name, 'ゲスト'); assert.equal(state.persistent, false);
  const cheerId = randomUUID(); b.send({ type: 'birthday-cheer', id: self, actionId: cheerId });
  assert.equal((await b.next('birthday-result', (m) => m.actionId === cheerId)).error, undefined);
  assert.equal((await a.next('birthdays', (m) => m.entries[0]?.cheers === 1)).entries[0].cheered, false);
  assert.equal((await b.next('birthdays', (m) => m.entries[0]?.cheers === 1)).entries[0].cheered, true);
  now = Date.parse('2026-10-18T00:00:00+09:00');
  assert.equal((await b.next('birthdays', (m) => m.serverNow === now)).entries[0].cheers, 0);
  a.ws.close(); await b.next('birthdays', (m) => !m.entries.length);
});

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

test('call summons several people across rooms atomically, synchronizes voice and buddies, and cannot replay or target departed people', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect(), c = await connect();
  const caster = a.welcome.players.find((person) => person.id === a.welcome.id)!;
  b.send({ type: 'profile', name: '呼ばれる人', outfit: 0, buddy: 'cat' }); await b.next('player', (m) => m.reason === 'profile');
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 1 }); await b.next('player', (m) => m.reason === 'room');
  c.send({ type: 'change-room', roomId: 'library', requestId: 1 }); await c.next('player', (m) => m.reason === 'room');
  for (const client of [a, b, c]) client.send({ type: 'voice-state', listening: true, microphone: false });
  const action = { type: 'spell-cast', spell: 'call', targetIds: [b.welcome.id, c.welcome.id], actionId: randomUUID(), x: 999, roomId: 'garden' };
  a.send(action); assert.equal((await a.next('spell-result')).error, undefined);
  const summoned = (await b.next('player', (m) => m.reason === 'spell' && m.player.id === b.welcome.id)).player;
  const also = (await c.next('player', (m) => m.reason === 'spell' && m.player.id === c.welcome.id)).player;
  assert.equal(summoned.roomId, caster.roomId); assert.equal(also.roomId, caster.roomId); assert.ok(summoned.buddyPosition);
  assert.notDeepEqual([summoned.x, summoned.y], [also.x, also.y]);
  assert.ok(Math.abs(summoned.x - caster.x) + Math.abs(summoned.y - caster.y) <= 6);
  await b.next('objects', (m) => m.roomId === caster.roomId); await b.next('voice', (m) => m.peers.some((person) => person.id === a.welcome.id));
  const effect = await b.next('spell-effect', (m) => m.spell === 'call'); assert.equal(effect.casterId, a.welcome.id); assert.equal(effect.targetIds.length, 2);
  b.send({ type: 'move', direction: 'left', requestId: 2 }); const blocked = (await b.next('player', (m) => m.requestId === 2)).player; assert.deepEqual([blocked.x, blocked.y], [summoned.x, summoned.y]);
  a.send(action); assert.equal((await a.next('spell-result')).error, undefined);
  a.send({ ...action, actionId: randomUUID() }); assert.match((await a.next('spell-result')).error!, /秒/);
  const replayCount = b.seen.filter((m) => m.type === 'spell-effect' && m.spell === 'call').length; assert.equal(replayCount, 1);
  b.ws.close(); await c.next('left', (m) => m.id === b.welcome.id);
  c.send({ type: 'spell-cast', spell: 'call', targetIds: [a.welcome.id, b.welcome.id], actionId: randomUUID() }); assert.match((await c.next('spell-result')).error!, /退出/);
  assert.equal(a.seen.some((m) => m.type === 'player' && m.reason === 'spell' && m.player.id === a.welcome.id), false);
});

test('rura moves only the caster next to the target, and fire is a shared room-local visual with no player movement', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect(), c = await connect();
  b.send({ type: 'change-room', roomId: 'cafe', requestId: 1 }); const target = (await b.next('player', (m) => m.reason === 'room')).player;
  a.send({ type: 'spell-cast', spell: 'rura', targetId: b.welcome.id, actionId: randomUUID() }); assert.equal((await a.next('spell-result')).error, undefined);
  const moved = (await a.next('player', (m) => m.reason === 'spell' && m.player.id === a.welcome.id)).player;
  assert.equal(moved.roomId, target.roomId); assert.equal(Math.abs(moved.x - target.x) + Math.abs(moved.y - target.y), 1);
  const action = { type: 'spell-cast', spell: 'fire', actionId: randomUUID(), x: 999, direction: 'up', damage: 999 };
  a.send(action); assert.equal((await a.next('spell-result')).error, undefined);
  const fire = await b.next('spell-effect', (m) => m.spell === 'fire'), own = await a.next('spell-effect', (m) => m.spell === 'fire');
  assert.equal(fire.id, own.id); assert.deepEqual(fire.origin, { x: moved.x, y: moved.y }); assert.equal(fire.roomId, 'cafe');
  a.send(action); assert.equal((await a.next('spell-result')).error, undefined);
  a.send({ ...action, actionId: randomUUID() }); assert.match((await a.next('spell-result')).error!, /秒/);
  assert.equal(b.seen.filter((m) => m.type === 'spell-effect' && m.spell === 'fire').length, 1);
  assert.equal(c.seen.some((m) => m.type === 'spell-effect'), false);
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
  a.send({ type: 'reaction', kind: 'anger', playerId: b.welcome.id, roomId: 'cafe', x: 999, y: 999 });
  const baseline = (await a.next('player', (m) => m.reason === 'move' && m.player.id === a.welcome.id && m.requestId === 1)).player;
  const self = await a.next('reaction'), shared = await b.next('reaction');
  assert.deepEqual(shared, { type: 'reaction', kind: 'anger', playerId: a.welcome.id, roomId: 'office' });
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

test('laptops synchronize as held items and anger never consumes the selected item or creates floor objects', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  const appearance = { ...DEFAULT_APPEARANCE, heldItem: 4 };
  a.send({ type: 'profile', name: 'Laptop', outfit: 0, appearance });
  assert.deepEqual((await b.next('player', m => m.player.id === a.welcome.id && m.reason === 'profile')).player.appearance, appearance);
  const objectsBefore = b.seen.filter(m => m.type === 'objects').length;
  a.send({ type: 'reaction', kind: 'anger' });
  assert.equal((await b.next('reaction')).kind, 'anger');
  const late = await connect();
  assert.equal(late.welcome.players.find(p => p.id === a.welcome.id)!.appearance!.heldItem, 4);
  assert.equal(b.seen.filter(m => m.type === 'objects').length, objectsBefore);
});

test('lying persists until an explicit stand request, survives profile and room changes, and reaches peers and late arrivals', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  a.send({ type: 'rest', resting: true, playerId: b.welcome.id });
  const lie = await a.next('player', m => m.reason === 'rest'); await a.next('rest-result');
  assert.equal(lie.player.id, a.welcome.id); assert.equal(lie.player.resting, true);
  assert.deepEqual((await b.next('player', m => m.reason === 'rest')).player, lie.player);
  const newcomer = await connect();
  assert.equal(newcomer.welcome.players.find(p => p.id === a.welcome.id)!.resting, true);
  assert.equal(newcomer.welcome.players.find(p => p.id === b.welcome.id)!.resting, undefined);
  await new Promise(resolve => setTimeout(resolve, REACTION_COOLDOWN_MS + 30));
  for (const [index, type] of ['move', 'dash'].entries()) {
    a.send({ type, direction: 'right', requestId: index + 1 });
    const still = (await a.next('player', m => m.requestId === index + 1 && m.reason === type)).player;
    assert.deepEqual([still.x, still.y, still.facing, still.resting], [lie.player.x, lie.player.y, lie.player.facing, true]);
  }
  a.send({ type: 'reaction', kind: 'jump' });
  a.send({ type: 'profile', name: 'ごろん', outfit: 0, resting: false });
  assert.equal((await a.next('player', m => m.reason === 'profile')).player.resting, true);
  assert.equal(b.seen.filter(m => m.type === 'reaction' && m.playerId === a.welcome.id).length, 0);
  a.send({ type: 'change-room', roomId: 'cafe', requestId: 3 });
  assert.equal((await a.next('player', m => m.reason === 'room' && m.player.id === a.welcome.id)).player.resting, true);
  a.send({ type: 'rest', resting: true }); await a.next('rest-result'); // Idempotent, not a toggle on the server.
  assert.equal((await a.next('player', m => m.reason === 'rest')).player.resting, true);
  a.send({ type: 'rest', resting: false }); await a.next('rest-result');
  const stand = (await a.next('player', m => m.reason === 'rest')).player;
  assert.equal(stand.resting, false);
  const direction = directions.find(direction => {
    const delta = { up: [0,-1], down:[0,1], left:[-1,0], right:[1,0] }[direction];
    return canWalk(stand.x + delta[0], stand.y + delta[1], stand.roomId);
  })!;
  await new Promise(resolve => setTimeout(resolve, STEP_MS + 10));
  a.send({ type: 'move', direction, requestId: 4 });
  const moved = (await a.next('player', m => m.requestId === 4 && m.reason === 'move')).player;
  assert.notDeepEqual([moved.x, moved.y], [stand.x, stand.y]); assert.equal(moved.resting, false);
});

test('buddies share authoritative trail positions and pets stay scoped to the current room', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  const initial = a.welcome.players[0];
  const petsA = await a.next('pets'), petsB = await b.next('pets');
  assert.deepEqual(petsA.pets, petsB.pets); assert.ok(petsA.pets.length >= 1 && petsA.pets.length <= 2); assert.equal(petsA.pets[0].kind, 'dog');
  a.send({ type: 'profile', name: 'buddy-owner', outfit: 0, buddy: 'robot', buddyPosition: { x: 99, y: 99 } });
  const shared = await b.next('player', (m) => m.player.id === initial.id && m.reason === 'profile');
  assert.equal(shared.player.buddy, 'robot'); assert.ok(canWalk(shared.player.buddyPosition!.x, shared.player.buddyPosition!.y));
  const c = await connect(); assert.equal(c.welcome.players.find((p) => p.id === initial.id)!.buddy, 'robot');
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  const moved = await a.next('player', (m) => m.player.id === initial.id && m.requestId === 1);
  assert.deepEqual(moved.player.buddyPosition, { x: initial.x, y: initial.y, facing: 'down' });
  const frame = await b.next('positions', (m) => m.positions.some((p) => p[0] === initial.slot));
  assert.deepEqual(frame.positions.find((p) => p[0] === initial.slot)!.slice(4), [initial.x, initial.y, directions.indexOf('down')]);
  await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
  a.send({ type: 'move', direction: 'down', requestId: 2 });
  const corner = await a.next('player', (m) => m.player.id === initial.id && m.requestId === 2);
  assert.deepEqual(corner.player.buddyPosition, { x: moved.player.x, y: moved.player.y, facing: 'right' });
  a.send({ type: 'change-room', roomId: 'garden', requestId: 3 });
  const room = await a.next('player', (m) => m.player.id === initial.id && m.requestId === 3);
  assert.ok(canWalk(room.player.buddyPosition!.x, room.player.buddyPosition!.y, 'garden'));
  assert.equal((await a.next('pets', (m) => m.roomId === 'garden')).pets.every((p) => p.roomId === 'garden'), true);
  const after = a.seen.length; await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(a.seen.slice(after).some((m) => m.type === 'pets' && m.roomId === 'office'), false);
  a.send({ type: 'profile', name: 'buddy-owner', outfit: 0, buddy: null });
  const none = await b.next('player', (m) => m.player.id === initial.id && m.reason === 'profile' && m.player.buddy === null);
  assert.equal(none.player.buddyPosition, undefined);
});

test('handheld items synchronize, survive movement and reject invalid choices', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect();
  for (const heldItem of [1, 2, 3, 0]) {
    a.send({ type: 'profile', name: '持ちもの', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, heldItem } });
    const received = await b.next('player', (m) => m.player.id === a.welcome.id && m.reason === 'profile');
    assert.equal(received.player.appearance?.heldItem, heldItem);
  }
  a.send({ type: 'profile', name: 'サンドイッチ', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, heldItem: 3 } });
  await b.next('player', (m) => m.player.id === a.welcome.id && m.player.appearance?.heldItem === 3);
  const c = await connect(); assert.equal(c.welcome.players.find((p) => p.id === a.welcome.id)?.appearance?.heldItem, 3);
  a.send({ type: 'profile', name: '不正', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, heldItem: 99 } });
  a.send({ type: 'move', direction: 'right', requestId: 1 });
  const moved = await a.next('player', (m) => m.player.id === a.welcome.id && m.requestId === 1);
  assert.equal(moved.player.name, 'サンドイッチ'); assert.equal(moved.player.appearance?.heldItem, 3);
});

test('shared vehicle stock handles competing borrowers, server speed limits and disconnect returns', async (t) => {
  const { connect } = await fixture(t);
  const clients = await Promise.all(Array.from({ length: 4 }, () => connect()));
  const walkTo = async (client: typeof clients[number], target: { x: number; y: number }) => {
    const start = client.welcome.players.find((p) => p.id === client.welcome.id)!;
    const queue = [{ x: start.x, y: start.y, path: [] as Array<typeof directions[number]> }], seen = new Set<string>();
    for (let index = 0; index < queue.length; index++) {
      const p = queue[index], key = `${p.x},${p.y}`;
      if (seen.has(key)) continue; seen.add(key);
      if (p.x === target.x && p.y === target.y) {
        for (const [i, direction] of p.path.entries()) {
          if (i) await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
          client.send({ type: 'move', direction, requestId: i + 1 });
          const ack = await client.next('player', (m) => m.player.id === client.welcome.id && m.requestId === i + 1);
          if (i === p.path.length - 1) assert.deepEqual([ack.player.x, ack.player.y], [target.x, target.y]);
        }
        return;
      }
      for (const [direction, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const) {
        if (canWalk(p.x + dx, p.y + dy)) queue.push({ x: p.x + dx, y: p.y + dy, path: [...p.path, direction] });
      }
    }
    throw new Error('No route to vehicle dock');
  };
  await Promise.all(clients.map((c) => walkTo(c, { x: 5, y: 12 })));
  const requests = clients.map(() => randomUUID());
  clients.forEach((c, i) => c.send({ type: 'vehicle-take', kind: 'bike', actionId: requests[i] }));
  const results = await Promise.all(clients.map((c, i) => c.next('vehicle-result', (m) => m.actionId === requests[i])));
  assert.equal(results.filter((r) => !r.error).length, 3); assert.equal(results.filter((r) => r.error).length, 1);
  const snapshot = await clients[0].next('vehicles', (m) => m.units.filter((u) => u.kind === 'bike' && u.riderId).length === 3);
  const occupied = snapshot.units.filter((u) => u.kind === 'bike'); assert.equal(new Set(occupied.map((u) => u.riderId)).size, 3);
  const owner = clients[results.findIndex((r) => !r.error)];
  const borrowed = await owner.next('player', (m) => m.reason === 'vehicle' && m.player.id === owner.welcome.id);
  assert.ok(borrowed.player.riding);
  await new Promise((resolve) => setTimeout(resolve, 90));
  owner.send({ type: 'move', direction: 'left', requestId: 100 });
  const first = await owner.next('player', (m) => m.player.id === owner.welcome.id && m.requestId === 100);
  assert.equal(first.player.x, 4);
  owner.send({ type: 'move', direction: 'left', requestId: 101 });
  assert.equal((await owner.next('player', (m) => m.player.id === owner.welcome.id && m.requestId === 101)).player.x, 4);
  await new Promise((resolve) => setTimeout(resolve, 90));
  owner.send({ type: 'move', direction: 'left', requestId: 102 });
  assert.equal((await owner.next('player', (m) => m.player.id === owner.welcome.id && m.requestId === 102)).player.x, 3);
  owner.send({ type: 'profile', name: 'rider', outfit: 0, riding: { id: 'fake', kind: 'skates' } });
  assert.equal((await owner.next('player', (m) => m.player.id === owner.welcome.id && m.reason === 'profile')).player.riding?.id, borrowed.player.riding.id);
  const newcomer = await connect(); assert.equal(newcomer.welcome.players.find((p) => p.id === owner.welcome.id)?.riding?.kind, 'bike');
  owner.send({ type: 'change-room', roomId: 'garden', requestId: 103 });
  const traveled = await owner.next('player', (m) => m.player.id === owner.welcome.id && m.requestId === 103);
  assert.equal(traveled.player.riding?.id, borrowed.player.riding.id);
  owner.ws.terminate();
  const freed = await newcomer.next('vehicles', (m) => m.units.some((u) => u.id === borrowed.player.riding!.id && u.riderId === null));
  assert.equal(freed.units.filter((u) => u.kind === 'bike' && u.riderId).length, 2);
});

test('library document collections sync on fixed and placed shelves, persist and survive moving the shelf', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-library-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const objectsFile = join(dir, 'objects.json'), linksFile = join(dir, 'links.json');
  const { connect } = await fixture(t, objectsFile, linksFile); const a = await connect(), b = await connect();
  for (const client of [a, b]) {
    client.send({ type: 'change-room', roomId: 'library', requestId: 1 });
    await client.next('objects', (m) => m.roomId === 'library');
  }
  const ids: string[] = [];
  for (const [i, title] of ['リリース手順書', '操作マニュアル'].entries()) {
    if (i) await new Promise((r) => setTimeout(r, 360));
    const editId = randomUUID();
    a.send({ type: 'favorite-add', title, url: `https://example.atlassian.net/wiki/spaces/TEAM/pages/${i + 1}`, editId });
    const result = await a.next('link-result', (m) => m.editId === editId);
    assert.equal(result.error, undefined); ids.push(result.favoriteId!);
  }
  await new Promise((r) => setTimeout(r, 360));
  a.send({ type: 'object-links-set', objectId: 'fixed:library:shelf:3:3', linkIds: ids, editId: randomUUID() });
  assert.equal((await a.next('link-result')).error, undefined);
  await b.next('object-links', (m) => m.bindings.some((s) => s.objectId === 'fixed:library:shelf:3:3' && s.linkIds.length === 2));
  a.send({ type: 'object-place', kind: 'bookshelf', x: 11, y: 13, rotation: 0, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const shelf = (await b.next('objects', (m) => m.objects.some((o) => o.kind === 'bookshelf'))).objects[0];
  await new Promise((r) => setTimeout(r, 360));
  a.send({ type: 'object-links-set', objectId: `placed:${shelf.id}`, linkIds: ids, editId: randomUUID() });
  assert.equal((await a.next('link-result')).error, undefined);
  await b.next('object-links', (m) => m.bindings.some((s) => s.objectId === `placed:${shelf.id}`));
  b.send({ type: 'object-links-set', objectId: `placed:${shelf.id}`, linkIds: [], editId: randomUUID() });
  assert.match((await b.next('link-result')).error!, /配置した本人/);
  a.send({ type: 'object-move', id: shelf.id, x: 17, y: 12, rotation: 1, editId: randomUUID() });
  assert.equal((await a.next('object-result')).error, undefined);
  const moved = (await b.next('objects', (m) => m.objects[0]?.x === 17)).objects[0];
  assert.equal(moved.rotation, 1); assert.equal(moved.id, shelf.id);
  assert.deepEqual(new ObjectStore(objectsFile).list(), [moved]);
  const stored = new LinkStore(linksFile).list();
  assert.deepEqual(stored.bindings.find((s) => s.objectId === `placed:${shelf.id}`)?.linkIds, ids);
  const c = await connect(); c.send({ type: 'change-room', roomId: 'library', requestId: 1 });
  assert.equal((await c.next('object-links', (m) => m.roomId === 'library')).bindings.length, 2);
});

test('walking onto pads auto-borrows and returns once; vending gives a synchronized bottle without changing clothes', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect();
  let current = a.welcome.players.find((p) => p.id === a.welcome.id)!, sequence = 0;
  const step = async (direction: typeof directions[number]) => {
    await new Promise((r) => setTimeout(r, STEP_MS + 6));
    const requestId = ++sequence; a.send({ type: 'move', direction, requestId });
    current = (await a.next('player', (m) => m.requestId === requestId)).player;
  };
  const walk = async (x: number, y: number) => {
    const queue = [{ x: current.x, y: current.y, path: [] as typeof directions[number][] }], seen = new Set<string>();
    let route: typeof directions[number][] | undefined;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i], key = `${p.x},${p.y}`; if (seen.has(key)) continue; seen.add(key);
      if (p.x === x && p.y === y) { route = p.path; break; }
      for (const [direction, dx, dy] of [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]] as const) {
        if (canWalk(p.x + dx, p.y + dy, current.roomId)) queue.push({ x: p.x + dx, y: p.y + dy, path: [...p.path, direction] });
      }
    }
    assert.ok(route); for (const direction of route) await step(direction);
  };
  await walk(3, 13); await step('down'); assert.equal(current.riding?.kind, 'bike');
  assert.equal((await b.next('player', (m) => m.reason === 'vehicle' && m.player.id === a.welcome.id)).player.riding?.kind, 'bike');
  await step('right'); assert.equal(current.riding?.kind, 'bike');
  await step('up'); await step('down'); assert.equal(current.riding, undefined);
  await step('left'); assert.equal(current.riding, undefined);
  assert.equal((await b.next('player', (m) => m.reason === 'vehicle' && m.player.id === a.welcome.id && !m.player.riding)).player.riding, undefined);
  a.send({ type: 'change-room', roomId: 'cafe', requestId: ++sequence });
  current = (await a.next('player', (m) => m.reason === 'room' && m.player.id === a.welcome.id)).player;
  const appearance = { ...DEFAULT_APPEARANCE, color: 4, hair: 2, body: 2, heldItem: 3 };
  a.send({ type: 'profile', name: '自販機テスト', outfit: 1, appearance });
  await b.next('player', (m) => m.reason === 'profile' && m.player.id === a.welcome.id);
  await walk(26, 3);
  const bottle = (await b.next('player', (m) => m.reason === 'vending' && m.player.id === a.welcome.id)).player;
  assert.deepEqual(bottle.appearance, { ...appearance, heldItem: 2 }); assert.equal(bottle.name, '自販機テスト');
  await step('right'); assert.equal(current.x, 26); assert.equal(current.appearance?.heldItem, 2);
  assert.equal(b.seen.filter((m) => m.type === 'player' && m.reason === 'vending' && m.player.id === a.welcome.id).length, 1);
  const c = await connect(); assert.equal(c.welcome.players.find((p) => p.id === a.welcome.id)?.appearance?.heldItem, 2);
});

test('all-floor broadcasts and meeting schedules synchronize across rooms, permit shared edits and persist', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-broadcast-office-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = join(dir, 'announcements.json'); const { connect } = await fixture(t, undefined, undefined, file);
  const a = await connect(), b = await connect();
  a.send({ type: 'profile', name: 'はな', outfit: 0 }); await a.next('player', (m) => m.reason === 'profile' && m.player.id === a.welcome.id);
  b.send({ type: 'change-room', roomId: 'garden', requestId: 1 }); await b.next('objects', (m) => m.roomId === 'garden');
  const publishId = randomUUID();
  a.send({ type: 'announcement-publish', title: '全体会議', message: '作戦室へどうぞ。', durationMinutes: 3, actionId: publishId, author: 'forged' });
  assert.equal((await a.next('announcement-result', (m) => m.actionId === publishId)).error, undefined);
  const notice = (await b.next('announcements', (m) => m.announcements.length === 1)).announcements[0];
  assert.equal(notice.author, 'はな'); assert.equal(notice.title, '全体会議');
  const dismissId = randomUUID(); b.send({ type: 'announcement-dismiss', id: notice.id, actionId: dismissId });
  assert.equal((await b.next('announcement-result', (m) => m.actionId === dismissId)).error, undefined);
  await a.next('announcements', (m) => !m.announcements.length);
  await new Promise((r) => setTimeout(r, 360));
  const id = randomUUID(), schedule = { title: '定例会議', message: '全員集合！', startsAt: Date.now() + 2 * 60_000, repeat: 'weekdays', leadMinutes: 5, displayMinutes: 3, enabled: true };
  a.send({ type: 'schedule-save', id, expectedVersion: 0, schedule, actionId: randomUUID() });
  assert.equal((await a.next('announcement-result')).error, undefined);
  // Saturday creation has its next weekday in the future: change to daily to exercise the live notice window.
  await b.next('announcements', (m) => m.schedules.some((s) => s.id === id));
  await new Promise((r) => setTimeout(r, 360));
  b.send({ type: 'schedule-save', id, expectedVersion: 1, schedule: { ...schedule, repeat: 'daily', title: '変更した会議' }, actionId: randomUUID() });
  assert.equal((await b.next('announcement-result')).error, undefined);
  const saved = await a.next('announcements', (m) => m.schedules[0]?.version === 2);
  assert.equal(saved.announcements[0].title, '変更した会議');
  const c = await connect(); const joined = await c.next('announcements');
  assert.equal(joined.schedules[0].version, 2); assert.equal(joined.announcements[0].title, '変更した会議');
  assert.equal(new AnnouncementStore(file).snapshot().schedules[0].version, 2);
  await new Promise((r) => setTimeout(r, 360));
  b.send({ type: 'schedule-save', id, expectedVersion: 1, schedule, actionId: randomUUID() });
  assert.match((await b.next('announcement-result')).error!, /更新/);
  a.send({ type: 'schedule-delete', id, expectedVersion: 2, actionId: randomUUID() });
  assert.equal((await a.next('announcement-result')).error, undefined);
  assert.equal((await b.next('announcements', (m) => !m.schedules.length && !m.announcements.length)).schedules.length, 0);
  assert.equal(new AnnouncementStore(file).snapshot().schedules.length, 0);
});

test('room changes never clone roaming residents and Pokemon buddies synchronize independently', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect();
  const first = await a.next('pets'); assert.ok(first.pets.some((pet) => pet.id === 'pet:dog'));
  const residents = [];
  for (const [i, room] of ROOMS.map((room) => room.id).entries()) {
    a.send({ type: 'change-room', roomId: room, requestId: i + 1 });
    const snapshot = await a.next('pets', (m) => m.roomId === room);
    assert.ok(snapshot.pets.length <= 2); residents.push(...snapshot.pets);
  }
  assert.equal(residents.length, 10); assert.equal(new Set(residents.map((p) => p.id)).size, 10);
  assert.equal(new Set(residents.map((p) => p.kind)).size, 10);
  assert.equal(residents.find((p) => p.kind === 'cat')?.roomId, 'library');
  assert.equal(residents.find((p) => p.kind === 'vacuum')?.roomId, 'cafe');
  a.send({ type: 'change-room', roomId: 'office', requestId: 13 });
  assert.equal((await a.next('pets', (m) => m.roomId === 'office')).pets[0].id, first.pets[0].id);
  for (const buddy of ['pikachu', 'eevee', 'snorlax', 'vacuum']) {
    a.send({ type: 'profile', name: '新しいバディ', outfit: 0, buddy });
    const changed = await b.next('player', (m) => m.reason === 'profile' && m.player.id === a.welcome.id && m.player.buddy === buddy);
    assert.equal(changed.player.buddy, buddy); assert.ok(changed.player.buddyPosition);
  }
  const c = await connect(); assert.equal(c.welcome.players.find((p) => p.id === a.welcome.id)?.buddy, 'vacuum');
  assert.ok(b.seen.filter((m) => m.type === 'pets').every((m) => m.roomId === 'office'));
});


test('daily incidents agree across rooms and late joins; JST midnight updates existing clients even if a newcomer joins first', async (t) => {
  let now = Date.parse('2026-10-17T14:59:59.000Z');
  const { connect } = await fixture(t, undefined, undefined, undefined, () => now);
  const a = await connect(), b = await connect();
  const first = await a.next('daily-event'); assert.deepEqual(await b.next('daily-event'), first);
  b.send({ type: 'change-room', roomId: 'library', requestId: 1 });
  await b.next('player', (m) => m.reason === 'room');
  assert.equal(first.event.day, '2026-10-17');
  now = Date.parse('2026-10-17T15:00:00.000Z');
  const late = await connect(), next = await late.next('daily-event');
  assert.equal(next.event.day, '2026-10-18'); assert.equal(next.serverNow, now);
  assert.deepEqual(await a.next('daily-event', (m) => m.event.day === '2026-10-18'), next);
  assert.deepEqual(await b.next('daily-event', (m) => m.event.day === '2026-10-18'), next);
  a.send({ type: 'daily-event', event: { ...next.event, episodeId: 'kaiju-01' } });
  assert.equal(parseClientMessage(JSON.stringify({ type: 'daily-event', event: next.event })), undefined);
});

test('walking style synchronizes to peers and late joins; invalid styles cannot replace the profile', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect();
  a.send({ type: 'profile', name: 'ぴょこさん', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, walkStyle: 3, heldItem: 1 } });
  const own = await a.next('player', (m) => m.reason === 'profile');
  const peer = await b.next('player', (m) => m.reason === 'profile');
  assert.equal(own.player.appearance?.walkStyle, 3); assert.deepEqual(peer.player.appearance, own.player.appearance);
  a.send({ type: 'profile', name: '不正', outfit: 0, appearance: { ...DEFAULT_APPEARANCE, walkStyle: 6 } });
  const late = await connect(), joined = late.welcome.players.find((p) => p.id === a.welcome.id)!;
  assert.equal(joined.name, 'ぴょこさん'); assert.equal(joined.appearance?.walkStyle, 3); assert.equal(joined.appearance?.heldItem, 1);
  const { walkStyle: _style, ...legacy } = { ...DEFAULT_APPEARANCE, color: 2, heldItem: 3 };
  a.send({ type: 'profile', name: '旧クライアント', outfit: 2, appearance: legacy });
  const reset = await a.next('player', (m) => m.reason === 'profile');
  assert.equal(reset.player.appearance?.walkStyle, 0); assert.equal(reset.player.appearance?.heldItem, 3);
});

test('cockpit play synchronizes only inside the simulator, reaches late entrants, and rejects overlapping or outside commands', async (t) => {
  const { connect } = await fixture(t), a = await connect(), b = await connect(), outside = await connect();
  const denied = randomUUID(); outside.send({ type: 'robot-action', action: 'punch', actionId: denied });
  assert.match((await outside.next('robot-result', (m) => m.actionId === denied)).error!, /操縦室/);
  for (const client of [a, b]) { client.send({ type: 'change-room', roomId: 'cockpit', requestId: 1 }); await client.next('robot-state'); }
  a.send({ type: 'profile', name: '操縦テスト', outfit: 0 }); await a.next('player', (m) => m.reason === 'profile');
  const actionId = randomUUID(); a.send({ type: 'robot-action', action: 'punch', actionId, operator: 'spoof', startedAt: 1 });
  const started = await a.next('robot-state', (m) => m.state.action === 'punch');
  assert.deepEqual((await b.next('robot-state', (m) => m.state.action === 'punch')).state, started.state);
  assert.equal((await a.next('robot-result', (m) => m.actionId === actionId)).error, undefined);
  const overlap = randomUUID(); b.send({ type: 'robot-action', action: 'pose', actionId: overlap });
  assert.match((await b.next('robot-result', (m) => m.actionId === overlap)).error!, /演出中/);
  const late = await connect(); late.send({ type: 'change-room', roomId: 'cockpit', requestId: 1 });
  assert.deepEqual((await late.next('robot-state')).state, started.state);
  assert.equal(outside.seen.some((m) => m.type === 'robot-state'), false);
  assert.equal(started.state.operator, '操縦テスト'); assert.notEqual(started.state.startedAt, 1);
});

test('arcade games synchronize players and spectators, reject outsiders and stale moves, and clean up travel/disconnects', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-arcade-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { connect } = await fixture(t, join(dir, 'objects.json'), join(dir, 'links.json'), join(dir, 'announcements.json'));
  const a = await connect(), b = await connect(), spectator = await connect(), outsider = await connect();
  for (const client of [a, b, spectator]) { client.send({ type: 'change-room', roomId: 'arcade', requestId: 1 }); await client.next('arcade-state'); }
  let snapshot = a.seen.filter((m) => m.type === 'arcade-state').at(-1)!;
  const table = () => snapshot.tables.find((s) => s.game === 'four')!;
  const action = async (client: typeof a, command: string, value?: number, roundId = table().roundId) => {
    await new Promise((resolve) => setTimeout(resolve, 90));
    const actionId = randomUUID(); client.send({ type: 'arcade-action', game: 'four', command, value, roundId, actionId });
    const result = await client.next('arcade-result', (r) => r.actionId === actionId);
    if (!result.error) snapshot = await a.next('arcade-state', (s) => command === 'join' ? s.tables[0].members.length > table().members.length : command === 'start' ? s.tables[0].phase === 'playing' : command === 'drop' ? s.tables[0].board.filter(Boolean).length > table().board.filter(Boolean).length : true);
    return result;
  };
  assert.ok((await action(outsider, 'join')).error);
  assert.equal((await action(a, 'join')).error, undefined);
  assert.equal((await action(b, 'join')).error, undefined);
  assert.equal((await action(a, 'start')).error, undefined);
  assert.ok((await action(spectator, 'drop', 1)).error);
  assert.ok((await action(b, 'drop', 1)).error);
  assert.equal((await action(a, 'drop', 1)).error, undefined);
  await spectator.next('arcade-state', (s) => s.tables[0].board[36] === 1);
  assert.equal(outsider.seen.some((m) => m.type === 'arcade-state'), false);
  assert.ok((await action(b, 'drop', 1, randomUUID())).error);
  // Identical action ids must not place another stone on a later turn.
  await new Promise((resolve) => setTimeout(resolve, 90));
  const replay = { type: 'arcade-action', game: 'four', command: 'drop', value: 2, roundId: table().roundId, actionId: randomUUID() };
  b.send(replay); await b.next('arcade-result', (r) => r.actionId === replay.actionId);
  snapshot = await a.next('arcade-state', (s) => s.tables[0].board[37] === 2);
  await action(a, 'drop', 3); b.send(replay);
  a.send({ type: 'change-room', roomId: 'library', requestId: 2 });
  const ended = await b.next('arcade-state', (s) => s.tables[0].phase === 'done');
  assert.equal(ended.tables[0].members.length, 1); assert.equal(ended.tables[0].board.filter(Boolean).length, 3);
  const late = await connect(); late.send({ type: 'change-room', roomId: 'arcade', requestId: 1 });
  assert.equal((await late.next('arcade-state')).tables[0].phase, 'done');
  b.ws.close(); await spectator.next('arcade-state', (s) => s.tables[0].members.length === 0);
  // Warp out follows the same automatic departure rules as room switching.
  snapshot = spectator.seen.filter((m) => m.type === 'arcade-state').at(-1)!;
  const actionId = randomUUID(); spectator.send({ type: 'arcade-action', game: 'four', command: 'join', roundId: table().roundId, actionId });
  await spectator.next('arcade-result', (r) => r.actionId === actionId);
  spectator.send({ type: 'warp-to', targetId: outsider.welcome.id, requestId: 3 });
  await late.next('arcade-state', (s) => s.tables[0].members.length === 0);
  const traveled = await spectator.next('player', (m) => m.player.id === spectator.welcome.id && m.reason === 'warp');
  assert.equal(traveled.player.roomId, 'office');
});

test('solo rhythm play and independent cabinets share only changed tables, including prompts and judged scores', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-rhythm-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { connect } = await fixture(t, join(dir, 'objects.json'), join(dir, 'links.json'), join(dir, 'announcements.json'));
  const a = await connect(), b = await connect();
  for (const client of [a, b]) { client.send({ type: 'change-room', roomId: 'arcade', requestId: 1 }); await client.next('arcade-state'); }
  const send = async (client: typeof a, game: 'clap' | 'star', command: string, roundId: string, beatId?: number, value?: number) => {
    await new Promise((resolve) => setTimeout(resolve, 90));
    const actionId = randomUUID(); client.send({ type: 'arcade-action', game, command, roundId, actionId, beatId, value });
    return client.next('arcade-result', (m) => m.actionId === actionId);
  };
  const initial = a.seen.find((m) => m.type === 'arcade-state')!;
  const clap = initial.tables.find((table) => table.game === 'clap')!;
  assert.equal((await send(a, 'clap', 'join', clap.roundId)).error, undefined);
  assert.equal((await send(a, 'clap', 'start', clap.roundId)).error, undefined);
  const started = await a.next('arcade-state', (s) => s.tables.some((table) => table.game === 'clap' && table.phase === 'playing'));
  const playing = started.tables.find((table) => table.game === 'clap')!;
  assert.equal(playing.members.length, 1); assert.equal(playing.beats.length, 20);
  const star = initial.tables.find((table) => table.game === 'star')!;
  assert.equal((await send(b, 'star', 'join', star.roundId)).error, undefined);
  const starUpdate = await a.next('arcade-state', (s) => s.tables.some((table) => table.game === 'star' && table.members.length === 1));
  assert.deepEqual(starUpdate.tables.map((table) => table.game), ['star']);
  await new Promise((resolve) => setTimeout(resolve, Math.max(0, playing.beats[0].at - Date.now() - 90)));
  assert.equal((await send(a, 'clap', 'beat', playing.roundId, 0, 0)).error, undefined);
  const scored = await b.next('arcade-state', (s) => s.tables.some((table) => table.game === 'clap' && table.members[0]?.score === 30));
  assert.deepEqual(scored.tables.map((table) => table.game), ['clap']);
  const late = await connect(); late.send({ type: 'change-room', roomId: 'arcade', requestId: 1 });
  const full = await late.next('arcade-state'); assert.equal(full.tables.length, 8);
  assert.equal(full.tables.find((table) => table.game === 'clap')!.members[0].score, 30); assert.equal(full.tables.find((table) => table.game === 'star')!.members.length, 1);
  a.ws.close(); await b.next('arcade-state', (s) => s.tables.some((table) => table.game === 'clap' && table.members.length === 0));
});

test('lost items have one shared three-kind registry across floors, furniture edits, late joins and period rollover', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-lost-items-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  let now = LOST_ITEMS_EPOCH + 7 * LOST_ITEM_PERIOD_MS + 10_000;
  const { connect } = await fixture(t, join(dir, 'objects.json'), join(dir, 'links.json'), join(dir, 'announcements.json'), undefined, () => now);
  const a = await connect(), b = await connect();
  const first = await a.next('lost-items'), second = await b.next('lost-items');
  assert.deepEqual(first, second); assert.equal(first.items.length, 3);
  assert.equal(new Set(first.items.map((i) => i.kind)).size, 3); assert.equal(new Set(first.items.map((i) => i.roomId)).size, 3);
  assert.equal(parseClientMessage(JSON.stringify({ type: 'lost-items', items: Array(100).fill(first.items[0]) })), undefined);
  const item = first.items[0];
  a.send({ type: 'change-room', roomId: item.roomId, requestId: 1 }); await a.next('player', (m) => m.player.id === a.welcome.id && m.reason === 'room');
  b.send({ type: 'change-room', roomId: 'office', requestId: 1 }); await b.next('player', (m) => m.player.id === b.welcome.id && m.reason === 'room');
  assert.equal(a.seen.filter((m) => m.type === 'lost-items').length, 1); // Travel uses the same building registry.
  const editId = randomUUID(); a.send({ type: 'object-place', kind: 'mug', x: item.x, y: item.y, rotation: 0, editId });
  assert.equal((await a.next('object-result', (m) => m.editId === editId)).error, undefined);
  const relocated = await a.next('lost-items', (m) => m.items.some((i) => i.id === item.id && (i.x !== item.x || i.y !== item.y)));
  assert.deepEqual((await b.next('lost-items')).items, relocated.items); assert.equal(relocated.items.length, 3);
  assert.equal(relocated.items.filter((i) => i.kind === item.kind).length, 1);
  assert.equal(relocated.items.find((i) => i.id === item.id)!.roomId, item.roomId);
  const late = await connect(); assert.deepEqual((await late.next('lost-items')).items, relocated.items);
  now = first.expiresAt + 1;
  // An arrival exactly at rollover must also refresh existing clients, rather
  // than consuming the new period only for the newcomer.
  const boundary = await connect(); const nextPeriod = await boundary.next('lost-items');
  assert.ok(nextPeriod.expiresAt > first.expiresAt); assert.equal(nextPeriod.items.length, 3);
  assert.deepEqual((await a.next('lost-items', (m) => m.expiresAt === nextPeriod.expiresAt)).items, nextPeriod.items);
  assert.deepEqual((await b.next('lost-items', (m) => m.expiresAt === nextPeriod.expiresAt)).items, nextPeriod.items);
  assert.ok(!nextPeriod.items.some((i) => relocated.items.some((old) => old.kind === i.kind)));
  now += LOST_ITEM_PERIOD_MS;
  const scheduled = await a.next('lost-items', (m) => m.serverNow === now);
  assert.equal(scheduled.items.length, 3); assert.equal(new Set(scheduled.items.map((i) => i.kind)).size, 3);
});

test('floor vehicles synchronize to newcomers, survive the dropper leaving, and competing pickup requests lease one unit', async (t) => {
  const { connect } = await fixture(t), owner = await connect();
  for (let i = 0; i < 10; i++) {
    if (i) await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
    owner.send({ type: 'move', direction: 'left', requestId: 200 + i });
    await owner.next('player', (m) => m.requestId === 200 + i);
  }
  const takeId = randomUUID(); owner.send({ type: 'vehicle-take', kind: 'bike', actionId: takeId });
  assert.equal((await owner.next('vehicle-result', (m) => m.actionId === takeId)).error, undefined);
  const rider = await owner.next('player', (m) => m.reason === 'vehicle' && !!m.player.riding);
  const unitId = rider.player.riding!.id;
  owner.send({ type: 'change-room', roomId: 'garden', requestId: 220 });
  await owner.next('player', (m) => m.requestId === 220);
  await new Promise((resolve) => setTimeout(resolve, 90));
  owner.send({ type: 'move', direction: 'left', requestId: 221 });
  const moved = await owner.next('player', (m) => m.requestId === 221);
  await new Promise((resolve) => setTimeout(resolve, 360));
  const dropId = randomUUID(); owner.send({ type: 'vehicle-drop', actionId: dropId, x: 1, y: 1, roomId: 'office' });
  assert.equal((await owner.next('vehicle-result', (m) => m.actionId === dropId)).error, undefined);
  const dropped = await owner.next('vehicles', (m) => m.units.some((u) => u.id === unitId && !!u.ground));
  assert.deepEqual(dropped.units.find((u) => u.id === unitId)?.ground, { roomId: 'garden', x: moved.player.x, y: moved.player.y });
  owner.ws.terminate();
  const a = await connect(), b = await connect();
  const initial = await a.next('vehicles'); assert.ok(initial.units.find((u) => u.id === unitId)?.ground);
  for (const client of [a, b]) {
    client.send({ type: 'change-room', roomId: 'garden', requestId: 230 });
    const arrived = await client.next('player', (m) => m.player.id === client.welcome.id && m.requestId === 230);
    if (Math.abs(arrived.player.x - moved.player.x) + Math.abs(arrived.player.y - moved.player.y) > 1) {
      await new Promise((resolve) => setTimeout(resolve, STEP_MS + 5));
      client.send({ type: 'move', direction: 'down', requestId: 231 });
      await client.next('player', (m) => m.player.id === client.welcome.id && m.requestId === 231);
    }
  }
  const aId = randomUUID(), bId = randomUUID();
  a.send({ type: 'vehicle-pickup', unitId, actionId: aId }); b.send({ type: 'vehicle-pickup', unitId, actionId: bId });
  const results = await Promise.all([a.next('vehicle-result', (m) => m.actionId === aId), b.next('vehicle-result', (m) => m.actionId === bId)]);
  assert.equal(results.filter((m) => !m.error).length, 1);
  const picked = await a.next('vehicles', (m) => m.units.some((u) => u.id === unitId && !!u.riderId));
  assert.equal(picked.units.length, 9); assert.equal(picked.units.find((u) => u.id === unitId)?.ground, undefined);
  // Replaying an already accepted request returns its result, without another mutation.
  const winner = results[0].error ? b : a, winnerId = results[0].error ? bId : aId;
  winner.send({ type: 'vehicle-pickup', unitId, actionId: winnerId });
  assert.equal((await winner.next('vehicle-result', (m) => m.actionId === winnerId)).error, undefined);
});

test('magic duel synchronizes HP, rejects interference and announces the winner to other floors and late arrivals', async (t) => {
  const { connect } = await fixture(t); const a = await connect(), b = await connect(), audience = await connect();
  for (const client of [a, b]) { client.send({ type: 'change-room', roomId: 'arena', requestId: 1 }); await client.next('player', m => m.reason === 'room' && m.player.id === client.welcome.id); }
  audience.send({ type: 'change-room', roomId: 'library', requestId: 1 }); await audience.next('player', m => m.reason === 'room' && m.player.id === audience.welcome.id);
  for (const client of [a, b]) { const actionId = randomUUID(); client.send({ type: 'arena-action', command: 'join', actionId, hp: 999 }); assert.equal((await client.next('arena-result', m => m.actionId === actionId)).error, undefined); }
  assert.deepEqual((await a.next('arena-state', m => m.state.phase === 'playing')).state.fighters.map(f => f.hp), [100, 100]);
  const call = randomUUID(); audience.send({ type: 'spell-cast', spell: 'call', targetIds: [a.welcome.id], actionId: call }); assert.match((await audience.next('spell-result', m => m.actionId === call)).error!, /対戦中/);
  for (let i = 0; i < 4; i++) {
    const actionId = randomUUID(); a.send({ type: 'spell-cast', spell: 'fire', actionId }); assert.equal((await a.next('spell-result', m => m.actionId === actionId)).error, undefined);
    await b.next('arena-state', m => m.state.fighters[1]?.hp === 100 - (i + 1) * 25);
    if (i < 3) await new Promise(r => setTimeout(r, 1250));
  }
  const result = await audience.next('announcements', m => m.announcements.some(a => a.category === 'arena'));
  const broadcast = result.announcements.find(a => a.category === 'arena')!; assert.match(broadcast.message, /勝ち.*HP0/);
  const late = await connect(); assert.equal((await late.next('announcements')).announcements.filter(a => a.id === broadcast.id).length, 1);
  const leaveId = randomUUID(); a.send({ type: 'arena-action', command: 'leave', actionId: leaveId }); await a.next('arena-result', m => m.actionId === leaveId);
  assert.equal(audience.seen.filter(m => m.type === 'announcements').at(-1)!.announcements.filter(a => a.category === 'arena').length, 1);
});

test('dash moves up to five tiles, respects walls and its cooldown; ice recast is rejected until expiry', async (t) => {
  const { connect } = await fixture(t); const a = await connect();
  a.send({ type: 'change-room', roomId: 'arena', requestId: 1 }); await a.next('player', m => m.reason === 'room');
  await new Promise(r => setTimeout(r, STEP_MS + 20));
  a.send({ type: 'dash', direction: 'up', requestId: 2 }); const dash = await a.next('player', m => m.requestId === 2);
  assert.equal(dash.player.y, 12); assert.equal(dash.player.x, 15);
  a.send({ type: 'dash', direction: 'up', requestId: 3 }); assert.equal((await a.next('player', m => m.requestId === 3)).player.y, 12);
  let id = randomUUID(); a.send({ type: 'spell-cast', spell: 'blizzard', actionId: id }); assert.equal((await a.next('spell-result', m => m.actionId === id)).error, undefined);
  const shield = await a.next('ice-state', m => !!m.shields.length); assert.equal(shield.shields[0].y, 11);
  id = randomUUID(); a.send({ type: 'spell-cast', spell: 'blizzard', actionId: id }); assert.ok((await a.next('spell-result', m => m.actionId === id)).error);
  await new Promise(r => setTimeout(r, 950)); a.send({ type: 'dash', direction: 'up', requestId: 4 }); assert.equal((await a.next('player', m => m.requestId === 4)).player.y, 12);
  await new Promise(r => setTimeout(r, 2150));
  id = randomUUID(); a.send({ type: 'spell-cast', spell: 'blizzard', actionId: id }); assert.equal((await a.next('spell-result', m => m.actionId === id)).error, undefined);
});

test('birthday comments are shared across floors and read by late arrivals without bulk-broadcasting every thread', async (t) => {
  const now = Date.parse('2026-10-18T12:00:00+09:00'), { connect } = await fixture(t, undefined, undefined, undefined, undefined, undefined, () => now);
  const a = await connect(), b = await connect(); const owner = (await a.next('birthdays')).selfId;
  b.send({ type: 'change-room', roomId: 'library', requestId: 1 }); await b.next('player', m => m.reason === 'room');
  const saveId = randomUUID(); a.send({ type: 'birthday-save', month: 10, day: 18, expectedVersion: 0, actionId: saveId }); await a.next('birthday-result', m => m.actionId === saveId);
  assert.equal((await b.next('birthdays', m => m.entries.length === 1)).entries[0].id, owner);
  const view = { type: 'birthday-thread', id: owner, date: '2026-10-18', actionId: randomUUID() };
  a.send(view); b.send({ ...view, actionId: randomUUID() }); await a.next('birthday-thread'); await b.next('birthday-thread');
  const actionId = randomUUID(); b.send({ type: 'birthday-comment', id: owner, date: view.date, text: 'Happy birthday!', actionId, authorId: owner, authorName: 'Forged' });
  assert.equal((await b.next('birthday-result', m => m.actionId === actionId)).error, undefined);
  const thread = await a.next('birthday-thread', m => m.comments.length === 1); assert.equal(thread.comments[0].authorId, `guest:${b.welcome.id}`); assert.notEqual(thread.comments[0].authorName, 'Forged');
  const late = await connect(); const snapshot = await late.next('birthdays'); assert.equal('comments' in snapshot, false);
  late.send({ ...view, actionId: randomUUID() }); assert.equal((await late.next('birthday-thread')).comments[0].text, 'Happy birthday!');
  b.ws.close(); assert.equal((await a.next('birthday-thread', m => m.comments.length === 0)).comments.length, 0);
});
