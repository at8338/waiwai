import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { OfficeHub } from './office-hub.ts';
import { MemberStore } from './members.ts';
import type { ServerMessage } from '../src/network/protocol.ts';
import type { SpaceSnapshot } from '../src/game/spaces.ts';
const admin = { name: '管理者', accountId: 'slack:TADMIN:UADMIN' };
const users = { admin, a: { name: 'A', accountId: 'slack:TTEAM:UALPHA' }, b: { name: 'B', accountId: 'slack:TTEAM:UBETA' }, both: { name: '両方', accountId: 'slack:TTEAM:UBOTH' }, pending: { name: '新規', accountId: 'slack:TTEAM:UNEW' } };
async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'waiwai-hub-'));
  const members = new MemberStore(join(dir, 'office-members.json'));
  for (const key of ['admin', 'a', 'b', 'both'] as const) await members.remember(users[key]);
  const auth = { identify: (r: { headers: { cookie?: string } }) => { const token = r.headers.cookie as keyof typeof users; return users[token] ? { id: token, user: users[token] } : undefined; }, canJoin: (r: { headers: { cookie?: string } }) => !!users[r.headers.cookie as keyof typeof users], onRevoke: () => () => {} };
  const server = createServer((req, res) => { void hub.handle(req, res).then(handled => { if (!handled) res.writeHead(404).end(); }); });
  const hub = new OfficeHub(server, auth, { WAIWAI_DATA_FILE: join(dir, 'office-objects.json'), WAIWAI_ADMIN_ACCOUNT_ID: admin.accountId });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`, clients: WebSocket[] = [];
  t.after(async () => { for (const client of clients) client.terminate(); hub.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }); });
  const request = async (key: keyof typeof users | 'guest', action?: unknown, csrf = false) => fetch(origin + '/api/spaces', {
    method: action ? 'POST' : 'GET', headers: { cookie: key, ...(action ? { 'Content-Type': 'application/json', Origin: csrf ? 'https://evil.example' : origin } : {}) }, ...(action ? { body: JSON.stringify(action) } : {}),
  });
  const snapshot = async () => (await request('admin')).json() as Promise<SpaceSnapshot>;
  const save = async (action: Record<string, unknown>) => { const response = await request('admin', { ...action, revision: (await snapshot()).revision }); assert.equal(response.status, 200, await response.clone().text()); return response.json() as Promise<SpaceSnapshot>; };
  const connect = async (key: keyof typeof users, space: string) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + `/office?space=${encodeURIComponent(space)}`, { origin, headers: { cookie: key } }); clients.push(ws);
    const seen: ServerMessage[] = [], inbox: ServerMessage[] = []; const waits = new Set<() => void>(); ws.on('error', () => {});
    ws.on('message', raw => { const data = JSON.parse(raw.toString()); seen.push(data); inbox.push(data); for (const check of waits) check(); });
    const next = <T extends ServerMessage['type']>(type: T, match: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true) => new Promise<Extract<ServerMessage, { type: T }>>((resolve, reject) => {
      const timer = setTimeout(() => { waits.delete(check); reject(new Error(`No ${type}`)); }, 2500);
      const check = () => { const i = inbox.findIndex(m => m.type === type && match(m as Extract<ServerMessage, { type: T }>)); if (i >= 0) { clearTimeout(timer); waits.delete(check); resolve(inbox.splice(i, 1)[0] as Extract<ServerMessage, { type: T }>); } }; waits.add(check); check();
    });
    const welcome = await next('welcome'); return { ws, seen, next, welcome, send: (m: unknown) => ws.send(JSON.stringify(m)) };
  };
  const rejectUpgrade = (key: string, query: string) => new Promise<number>((resolve, reject) => {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + '/office' + query, { origin, headers: { cookie: key } }); clients.push(ws);
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('Upgrade timeout')); }, 2000);
    ws.on('unexpected-response', (_req, response) => { clearTimeout(timer); response.resume(); ws.terminate(); resolve(response.statusCode!); }); ws.on('error', () => {}); ws.on('open', () => { clearTimeout(timer); reject(new Error('Unauthorized connection')); });
  });
  return { hub, dir, request, save, snapshot, connect, rejectUpgrade };
}
async function split(f: Awaited<ReturnType<typeof fixture>>) {
  const red = (await f.save({ type: 'create', name: '赤チーム' })).spaces.at(-1)!.id;
  const blue = (await f.save({ type: 'create', name: '青チーム' })).spaces.at(-1)!.id;
  await f.save({ type: 'membership', accountId: users.a.accountId, spaceIds: [red] });
  await f.save({ type: 'membership', accountId: users.b.accountId, spaceIds: [blue] });
  await f.save({ type: 'membership', accountId: users.both.accountId, spaceIds: [red, blue] });
  return { red, blue };
}
test('server API exposes only authorized choices; unassigned and forged memberships cannot enter', async t => {
  const f = await fixture(t), { red, blue } = await split(f);
  const a = await (await f.request('a')).json() as SpaceSnapshot;
  assert.deepEqual(a.spaces.map(s => s.id), [red]); assert.equal(a.members, undefined);
  const pending = await (await f.request('pending')).json() as SpaceSnapshot;
  assert.equal(pending.spaces.length, 0); assert.ok((await f.snapshot()).members!.some(m => m.id === users.pending.accountId));
  assert.equal((await f.request('a', { type: 'create', name: '侵入', revision: a.revision, administrator: true })).status, 403);
  assert.equal((await f.request('admin', { type: 'create', name: 'CSRF', revision: a.revision }, true)).status, 403);
  for (const [key, query] of [['a', `?space=${blue}`], ['a', ''], ['pending', `?space=${red}`], ['guest', `?space=${red}`], ['admin', '?space=../escape'], ['admin', `?space=${red}&space=${blue}`]]) assert.equal(await f.rejectUpgrade(key, query), 403);
  const peer = await f.connect('both', blue); assert.equal(peer.welcome.players.length, 1);
});
test('avatars, voice, global chat, DM, groups, birthdays, announcements, objects and history stay inside a server', async t => {
  const f = await fixture(t), { red, blue } = await split(f);
  const a = await f.connect('a', red), other = await f.connect('both', red), b = await f.connect('b', blue), otherBlue = await f.connect('both', blue);
  assert.equal(b.welcome.players.length, 1); assert.equal(other.welcome.players.length, 2); assert.equal(otherBlue.welcome.players.length, 2);
  const directory = await a.next('directory'); assert.equal(directory.people.some(p => p.name === 'B'), false);
  a.send({ type: 'warp-to', targetId: b.welcome.id, requestId: 45 });
  assert.ok((await a.next('travel-error')).error);
  const call = randomUUID(); a.send({ type: 'spell-cast', spell: 'call', targetIds: [b.welcome.id], actionId: call });
  assert.ok((await a.next('spell-result', m => m.actionId === call)).error);
  a.send({ type: 'voice-state', listening: true, microphone: true }); b.send({ type: 'voice-state', listening: true, microphone: true });
  assert.equal((await a.next('voice', m => m.self.listening)).peers.length, 0); assert.equal((await b.next('voice', m => m.self.listening)).peers.length, 0);
  a.send({ type: 'chat-send', target: { kind: 'global' }, actionId: randomUUID(), text: '赤だけの発言', shareSlack: false });
  await other.next('chat-message', m => m.message.text === '赤だけの発言');
  otherBlue.send({ type: 'chat-history', target: { kind: 'global' }, actionId: randomUUID() });
  assert.equal((await otherBlue.next('chat-history')).messages.length, 0);
  const forbidden = randomUUID(); a.send({ type: 'chat-send', target: { kind: 'dm', peerId: users.b.accountId }, actionId: forbidden, text: '越境DM', shareSlack: false });
  assert.match((await a.next('chat-result', m => m.actionId === forbidden)).error!, /同じサーバー/);
  const group = randomUUID(); a.send({ type: 'chat-group-create', actionId: group, groupId: randomUUID(), name: '越境', memberIds: [users.b.accountId] });
  assert.match((await a.next('chat-result', m => m.actionId === group)).error!, /同じサーバー/);
  const birthday = randomUUID(); a.send({ type: 'birthday-save', month: 1, day: 2, expectedVersion: 0, actionId: birthday }); await a.next('birthday-result', m => m.actionId === birthday);
  await other.next('birthdays', m => m.entries.some(e => e.id === users.a.accountId));
  const announce = randomUUID(); a.send({ type: 'announcement-publish', title: '赤の会議', message: '集合', durationMinutes: 5, actionId: announce });
  await other.next('announcements', m => m.announcements.some(n => n.title === '赤の会議'));
  for (const peer of [a, b]) { peer.send({ type: 'change-room', roomId: 'cafe', requestId: 77 }); await peer.next('objects', m => m.roomId === 'cafe'); }
  const edit = randomUUID(); a.send({ type: 'object-place', editId: edit, kind: 'plant', x: 16, y: 16, rotation: 0 });
  assert.equal((await a.next('object-result', m => m.editId === edit)).error, undefined);
  await a.next('objects', m => m.objects.length === 1);
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(b.seen.some(m => m.type === 'objects' && m.objects.length > 0), false);
  for (const peer of [b, otherBlue]) {
    assert.equal(peer.seen.some(m => m.type === 'chat-message' && m.message.text === '赤だけの発言'), false);
    assert.equal(peer.seen.some(m => m.type === 'birthdays' && m.entries.some(e => e.id === users.a.accountId)), false);
    assert.equal(peer.seen.some(m => m.type === 'announcements' && m.announcements.some(n => n.title === '赤の会議')), false);
    assert.equal(peer.seen.some(m => m.type === 'player' && m.player.id === a.welcome.id), false);
  }
  assert.equal((await a.next('chat-state')).slackEnabled, false);
});
test('revoking membership closes every affected tab immediately and disabling a server rejects new connections', async t => {
  const f = await fixture(t), { red, blue } = await split(f);
  const a = await f.connect('a', red), tab = await f.connect('a', red), b = await f.connect('b', blue);
  const closed = [a, tab].map(p => new Promise<number>(resolve => p.ws.once('close', code => resolve(code))));
  await f.save({ type: 'membership', accountId: users.a.accountId, spaceIds: [] });
  assert.deepEqual(await Promise.all(closed), [4003, 4003]); assert.equal(b.ws.readyState, WebSocket.OPEN);
  assert.equal(await f.rejectUpgrade('a', `?space=${red}`), 403);
  const bClosed = new Promise<number>(resolve => b.ws.once('close', code => resolve(code)));
  await f.save({ type: 'update', id: blue, name: '青チーム', enabled: false });
  assert.equal(await bClosed, 4003); assert.equal(await f.rejectUpgrade('admin', `?space=${blue}`), 403);
});
