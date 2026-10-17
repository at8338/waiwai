import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { attachOffice } from './office.ts';
import type { ServerMessage, Player } from '../src/network/protocol.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import { STEP_MS, canWalk } from '../src/game/world.ts';

async function fixture(t: TestContext) {
  const server = createServer((_request, response) => response.end('ok'));
  const dispose = attachOffice(server);
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
  const movedB = await b.next('player', (m) => m.reason === 'move');
  assert.deepEqual(movedA, movedB);
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
  await b.next('player', (m) => m.reason === 'move');
  a.send({ type: 'reset', requestId: 2 });
  const reset = await b.next('player', (m) => m.reason === 'reset');
  assert.ok(canWalk(reset.player.x, reset.player.y));
  assert.equal(reset.player.facing, 'down');
  assert.equal(reset.requestId, 2);
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
  for (let i = 0; i < 9; i++) clients.push(await connect());
  for (const client of clients.slice(0, 8)) {
    client.send({ type: 'voice-state', listening: true, microphone: false });
    assert.equal((await client.next('voice', (message) => message.self.listening)).self.listening, true);
  }
  const last = clients[8];
  last.send({ type: 'voice-state', listening: true, microphone: false });
  assert.equal((await last.next('voice')).error, 'capacity');
  clients[0].send({ type: 'voice-state', listening: false, microphone: false });
  await clients[0].next('voice', (message) => !message.self.listening);
  last.send({ type: 'voice-state', listening: true, microphone: false });
  assert.equal((await last.next('voice', (message) => message.self.listening)).self.listening, true);
});
