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
    const waiters = new Set<() => void>();
    ws.on('error', () => {});
    ws.on('message', (raw) => {
      inbox.push(JSON.parse(raw.toString()) as ServerMessage);
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
    return { ws, next, welcome, send: (message: unknown) => ws.send(JSON.stringify(message)) };
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
