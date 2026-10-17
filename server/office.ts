import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { COLS, ROWS, STEP_MS } from '../src/game/world.ts';
import { MAX_PLAYERS, POSITION_FRAME_MS, directions, parseClientMessage } from '../src/network/protocol.ts';
import type { Player, Position, ServerMessage } from '../src/network/protocol.ts';
import { VoiceRoom, readIceProvider } from './voice.ts';
import type { SlackAuth } from './auth.ts';
import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { getRoom } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
import { placementProblem, walkableWithObjects } from '../src/game/objects.ts';
import { ObjectStore } from './objects.ts';

class EditError extends Error {}

export function attachOffice(server: Server, auth?: SlackAuth, options: { objectsFile?: string } = {}): () => void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const players = new Map<WebSocket, Player>();
  const store = new ObjectStore(options.objectsFile);
  const alive = new Set<WebSocket>();
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const sendRaw = (ws: WebSocket, serialized: string) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 64 * 1024) { ws.terminate(); return; }
    ws.send(serialized);
  };
  const send = (ws: WebSocket, message: ServerMessage) => sendRaw(ws, JSON.stringify(message));
  const broadcast = (message: ServerMessage, except?: WebSocket) => {
    const serialized = JSON.stringify(message);
    for (const ws of players.keys()) if (ws !== except) sendRaw(ws, serialized);
  };
  const voice = new VoiceRoom(players, send, readIceProvider());
  const pending = new Map<string, Position>();
  const frame = setInterval(() => {
    if (pending.size) {
      broadcast({ type: 'positions', positions: [...pending.values()] });
      pending.clear();
    }
    voice.refreshIfDirty();
  }, POSITION_FRAME_MS);
  frame.unref();
  const roomObjects = (roomId: RoomId) => store.list().filter((o) => o.roomId === roomId);
  const sendObjects = (ws: WebSocket, roomId: RoomId) => send(ws, { type: 'objects', roomId, objects: roomObjects(roomId) });
  const spawn = (roomId: RoomId = 'office', except?: WebSocket) => {
    const origin = getRoom(roomId).spawn;
    const objects = roomObjects(roomId);
    const occupied = new Set([...players].filter(([ws, player]) => ws !== except && player.roomId === roomId).map(([, { x, y }]) => `${x},${y}`));
    const tiles = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (walkableWithObjects(x, y, roomId, objects) && !occupied.has(`${x},${y}`)) tiles.push({ x, y });
    }
    tiles.sort((a, b) => (Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y)) -
      (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)));
    return tiles[0] ?? origin;
  };

  const identities = new Map<WebSocket, string>();
  let nextSlot = 0;
  const unsubscribe = auth?.onRevoke((id) => {
    for (const [ws, session] of identities) if (session === id) ws.close(4001, 'Session ended');
  });
  wss.on('connection', (ws, request) => {
    const identity = auth?.identify(request);
    if (identity) identities.set(ws, identity.id);
    const player: Player = { id: randomUUID(), slot: ++nextSlot, name: identity?.user.name ?? 'ゲスト', outfit: 0, appearance: { ...DEFAULT_APPEARANCE }, roomId: 'office',
      slack: identity?.user.slack ?? null, slackVerified: !!identity, ...spawn(), facing: 'down' };
    players.set(ws, player);
    alive.add(ws);
    send(ws, { type: 'welcome', id: player.id, players: [...players.values()] });
    broadcast({ type: 'player', player, reason: 'join' }, ws);
    sendObjects(ws, player.roomId);
    let lastMove = -Infinity;
    let windowStart = Date.now();
    let messages = 0;
    let signals = 0;
    let lastEdit = -Infinity;
    ws.on('pong', () => alive.add(ws));
    ws.on('error', () => ws.terminate());
    ws.on('message', (data, isBinary) => {
      if (identity && auth?.identify(request)?.id !== identity.id) { ws.close(4001, 'Session ended'); return; }
      if (isBinary) { ws.close(1003, 'Text messages only'); return; }
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; messages = 0; signals = 0; }
      const message = parseClientMessage(data.toString());
      if (message?.type === 'voice-signal' ? ++signals > 120 : ++messages > 40) { ws.close(1008, 'Too many messages'); return; }
      if (!message) return;
      if (message.type === 'voice-state') { voice.state(ws, message); return; }
      if (message.type === 'voice-signal') { voice.signal(ws, message); return; }
      if (message.type === 'object-place' || message.type === 'object-move' || message.type === 'object-remove') {
        if (now - lastEdit < 350) { send(ws, { type: 'object-result', editId: message.editId, error: '少し待ってから、もう一度操作してください。' }); return; }
        lastEdit = now;
        const roomId = player.roomId;
        const owner = identity ? `slack:${identity.user.slack.teamId}:${identity.user.slack.userId}` : `guest:${player.id}`;
        void store.transact((objects) => {
          if (!players.has(ws) || player.roomId !== roomId || (identity && auth?.identify(request)?.id !== identity.id)) throw new EditError('部屋が変わったため操作を取り消しました。');
          const existing = 'id' in message ? objects.find((o) => o.id === message.id) : undefined;
          if (message.type !== 'object-place' && (!existing || existing.roomId !== roomId || existing.owner !== owner)) throw new EditError('自分が置いた家具・小物だけを編集できます。');
          if (message.type === 'object-remove') { objects.splice(objects.indexOf(existing!), 1); return; }
          const candidate = { id: existing?.id ?? randomUUID(), owner, roomId, kind: message.type === 'object-place' ? message.kind : existing!.kind,
            x: message.x, y: message.y, rotation: message.rotation };
          const error = placementProblem(candidate, objects, [...players.values()]);
          if (error) throw new EditError(error);
          if (existing) objects.splice(objects.indexOf(existing), 1, candidate);
          else objects.push(candidate);
        }).then(() => {
          for (const [client, person] of players) if (person.roomId === roomId) sendObjects(client, roomId);
          send(ws, { type: 'object-result', editId: message.editId });
        }).catch((error: unknown) => send(ws, { type: 'object-result', editId: message.editId,
          error: error instanceof EditError ? error.message : '家具・小物を保存できませんでした。時間をおいて試してください。' }));
        return;
      }
      if (message.type === 'profile') {
        player.name = identity?.user.name ?? message.name;
        player.outfit = message.outfit;
        player.appearance = message.appearance;
        player.slack = identity?.user.slack ?? message.slack ?? null;
      } else if (message.type === 'change-room') {
        player.roomId = message.roomId;
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        pending.delete(player.id);
        broadcast({ type: 'player', player, reason: 'room', requestId: message.requestId });
        sendObjects(ws, player.roomId);
        voice.refresh();
        lastMove = now;
        return;
      } else if (message.type === 'reset') {
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        lastMove = now;
      } else {
        player.facing = message.direction;
        const [dx, dy] = vectors[message.direction];
        if (now - lastMove >= STEP_MS && walkableWithObjects(player.x + dx, player.y + dy, player.roomId, roomObjects(player.roomId))) {
          player.x += dx;
          player.y += dy;
          lastMove = now;
        }
      }
      if (message.type === 'profile') broadcast({ type: 'player', player, reason: 'profile' });
      else {
        // Immediate authoritative acknowledgment keeps local movement responsive.
        send(ws, { type: 'player', player, reason: message.type, requestId: message.requestId });
        pending.set(player.id, [player.slot, player.x, player.y, directions.indexOf(player.facing) |
          (message.type === 'reset' || ((pending.get(player.id)?.[3] ?? 0) & 4) ? 4 : 0)]);
        voice.markDirty();
      }
    });
    ws.on('close', () => {
      players.delete(ws);
      identities.delete(ws);
      alive.delete(ws);
      pending.delete(player.id);
      voice.leave(ws);
      broadcast({ type: 'left', id: player.id });
    });
  });
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    // Other paths (including Vite HMR) belong to their respective server handlers.
    if (request.url?.split('?')[0] !== '/office') return;
    const origin = request.headers.origin;
    let sameOrigin = false;
    try { sameOrigin = !!origin && new URL(origin).host === request.headers.host; } catch { /* invalid origin */ }
    if (!sameOrigin || players.size >= MAX_PLAYERS) { socket.destroy(); return; }
    if (auth && !auth.canJoin(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  };
  server.on('upgrade', upgrade);
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.delete(ws)) { ws.terminate(); continue; }
      ws.ping();
    }
  }, 15_000);
  heartbeat.unref();
  return () => {
    clearInterval(heartbeat);
    clearInterval(frame);
    unsubscribe?.();
    server.off('upgrade', upgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
