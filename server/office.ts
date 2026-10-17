import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { COLS, ROWS, SPAWN, STEP_MS, canWalk } from '../src/game/world.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
import type { Player, ServerMessage } from '../src/network/protocol.ts';
import { VoiceRoom, readIceServers } from './voice.ts';

export function attachOffice(server: Server): () => void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const players = new Map<WebSocket, Player>();
  const alive = new Set<WebSocket>();
  const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 64 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(message));
  };
  const broadcast = (message: ServerMessage, except?: WebSocket) => {
    for (const ws of players.keys()) if (ws !== except) send(ws, message);
  };
  const voice = new VoiceRoom(players, send, readIceServers());
  const spawn = (except?: WebSocket) => {
    const occupied = new Set([...players].filter(([ws]) => ws !== except).map(([, { x, y }]) => `${x},${y}`));
    const tiles = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (canWalk(x, y) && !occupied.has(`${x},${y}`)) tiles.push({ x, y });
    }
    tiles.sort((a, b) => (Math.abs(a.x - SPAWN.x) + Math.abs(a.y - SPAWN.y)) -
      (Math.abs(b.x - SPAWN.x) + Math.abs(b.y - SPAWN.y)));
    return tiles[0] ?? SPAWN;
  };

  wss.on('connection', (ws) => {
    const player: Player = { id: randomUUID(), name: 'ゲスト', outfit: 0, ...spawn(), facing: 'down' };
    players.set(ws, player);
    alive.add(ws);
    send(ws, { type: 'welcome', id: player.id, players: [...players.values()] });
    broadcast({ type: 'player', player, reason: 'join' }, ws);
    let lastMove = -Infinity;
    let windowStart = Date.now();
    let messages = 0;
    let signals = 0;
    ws.on('pong', () => alive.add(ws));
    ws.on('error', () => ws.terminate());
    ws.on('message', (data, isBinary) => {
      if (isBinary) { ws.close(1003, 'Text messages only'); return; }
      const now = Date.now();
      if (now - windowStart >= 1000) { windowStart = now; messages = 0; signals = 0; }
      const message = parseClientMessage(data.toString());
      if (message?.type === 'voice-signal' ? ++signals > 120 : ++messages > 40) { ws.close(1008, 'Too many messages'); return; }
      if (!message) return;
      if (message.type === 'voice-state') { voice.state(ws, message); return; }
      if (message.type === 'voice-signal') { voice.signal(ws, message); return; }
      if (message.type === 'profile') {
        player.name = message.name;
        player.outfit = message.outfit;
      } else if (message.type === 'reset') {
        Object.assign(player, spawn(ws), { facing: 'down' });
        lastMove = now;
      } else {
        player.facing = message.direction;
        const [dx, dy] = vectors[message.direction];
        if (now - lastMove >= STEP_MS && canWalk(player.x + dx, player.y + dy)) {
          player.x += dx;
          player.y += dy;
          lastMove = now;
        }
      }
      broadcast({ type: 'player', player, reason: message.type,
        ...('requestId' in message ? { requestId: message.requestId } : {}) });
      voice.refresh();
    });
    ws.on('close', () => {
      players.delete(ws);
      alive.delete(ws);
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
    if (!sameOrigin || players.size >= 50) { socket.destroy(); return; }
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
    server.off('upgrade', upgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  };
}
