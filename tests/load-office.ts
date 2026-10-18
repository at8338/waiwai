import { continuousWalkable, worldStep } from '../src/game/continuous-world.ts';
import { ROOM_IDS } from '../src/game/rooms.ts';
import { randomUUID } from 'node:crypto';
import { ARCADE_IDS, arcadeCapacity } from '../src/game/arcade.ts';
import type { ArcadeTable, ArcadeGame, ArcadeCommand } from '../src/game/arcade.ts';
import { isRhythmGame, nearestBeat } from '../src/game/arcade-rhythm.ts';
import { BUDDY_KINDS } from '../src/game/buddies.ts';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { writeFile } from 'node:fs/promises';
import WebSocket from 'ws';
import { canWalk, STEP_MS } from '../src/game/world.ts';
import type { Direction } from '../src/game/world.ts';
import type { Player, ServerMessage } from '../src/network/protocol.ts';
import type { VoiceSnapshot } from '../src/audio/protocol.ts';
const seconds = Number(process.env.LOAD_SECONDS ?? 30);
assert.ok(seconds >= 10 && seconds <= 3600);
const child = fork(new URL('./load-server.ts', import.meta.url), { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
const clients: WebSocket[] = [];
const arcadeMode = process.env.LOAD_ARCADE === 'true';
const continuousMode = process.env.LOAD_CONTINUOUS === 'true';
assert.ok(!continuousMode || !arcadeMode, 'Run continuous and arcade load scenarios separately');
let boundaryCrossings = 0;
const tables = new Map<ArcadeGame, ArcadeTable>();
const arcadeActors: Array<{ client: number; game: ArcadeGame }> = [];
const arcadePending = new Map<string, { start: number; resolve: (error?: string) => void }>();
const arcadeLatency: number[] = [];
let arcadeActions = 0;
const arcadeCommand = (client: number, game: ArcadeGame, command: ArcadeCommand, value?: number, beatId?: number): Promise<void> => new Promise((resolve, reject) => {
  const table = tables.get(game); if (!table) { reject(new Error(`Missing arcade snapshot: ${game}`)); return; } const actionId = randomUUID();
  const timeout = setTimeout(() => { arcadePending.delete(actionId); reject(new Error('Arcade ack timeout')); }, 5000);
  arcadePending.set(actionId, { start: performance.now(), resolve: (error) => { clearTimeout(timeout); if (error) reject(new Error(error)); else resolve(); } });
  clients[client].send(JSON.stringify({ type: 'arcade-action', game, command, value, beatId, actionId, roundId: table.roundId })); arcadeActions++;
});
const self: Player[] = [];
const voices = new Map<number, VoiceSnapshot>();
const pending = new Map<string, number>();
let unexpectedCloses = 0, measured = false, bytes = 0, positions = 0, sent = 0, relayed = 0;
const latencies: number[] = [];
const payloadByType: Record<string, number> = {};
const cleanupTimers: Array<ReturnType<typeof setInterval>> = [];
try {
  const [{ port }] = await once(child, 'message') as [{ port: number }];
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 150; i++) {
    const ws = new WebSocket(origin.replace('http:', 'ws:') + '/office', { origin });
    clients.push(ws);
    ws.on('error', (error) => { if (measured) throw error; });
    ws.on('close', () => { if (measured) unexpectedCloses++; });
    const welcome = new Promise<void>((resolve) => ws.on('message', (raw) => {
      const message = JSON.parse(String(raw)) as ServerMessage;
      if (measured) { const size=Buffer.byteLength(String(raw)); bytes += size; payloadByType[message.type]=(payloadByType[message.type]??0)+size; }
      if (message.type === 'welcome') { self[i] = message.players.find(({ id }) => id === message.id)!; resolve(); }
      if (message.type === 'player' && message.player.id === self[i]?.id) {
        if (measured && self[i].roomId !== message.player.roomId) boundaryCrossings++;
        self[i] = message.player;
        if (message.requestId) {
          const key = `${i}:${message.requestId}`, start = pending.get(key);
          if (start !== undefined) { latencies.push(performance.now() - start); pending.delete(key); }
        }
      }
      if (message.type === 'positions' && measured) positions++;
      if (message.type === 'arcade-state' && i === 0) for (const table of message.tables) tables.set(table.game, table);
      if (message.type === 'arcade-result') { const request = arcadePending.get(message.actionId); if (request) { arcadePending.delete(message.actionId); arcadeLatency.push(performance.now() - request.start); request.resolve(message.error); } }
      if (message.type === 'voice') { voices.set(i, message); assert.ok(message.peers.length <= 4); }
      if (message.type === 'voice-signal') relayed++;
    }));
    await welcome;
    ws.send(JSON.stringify({ type: 'profile', name: `負荷試験${i}`, outfit: i % 3, ...(process.env.LOAD_BUDDIES === 'true' ? { buddy: BUDDY_KINDS[i % BUDDY_KINDS.length] } : {}) }));
    if (continuousMode) { ws.send(JSON.stringify({ type: 'change-room', roomId: ROOM_IDS[i % ROOM_IDS.length], requestId: 1 })); ws.send(JSON.stringify({ type: 'world-mode', enabled: true, requestId: 2 })); }
    if (arcadeMode) ws.send(JSON.stringify({ type: 'change-room', roomId: 'arcade', requestId: 1 }));
    if (i < 30) ws.send(JSON.stringify({ type: 'voice-state', listening: true, microphone: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(voices.size, 30);
  if (arcadeMode) {
    let index = 0;
    for (const game of ARCADE_IDS) {
      const host = index;
      for (let seat = 0; seat < arcadeCapacity(game); seat++) { await arcadeCommand(index, game, 'join'); arcadeActors.push({ client: index++, game }); }
      await arcadeCommand(host, game, 'start');
    }
  }
  const reset = once(child, 'message'); child.send('reset'); await reset;
  measured = true;
  const start = performance.now();
  const directions: Array<[Direction, number, number]> = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
  const timers = clients.map((ws, i) => setInterval(() => {
    const p = self[i];
    const choices = directions.filter(([direction, dx, dy]) => { if (!continuousMode) return canWalk(p.x + dx, p.y + dy, p.roomId); const next = worldStep(p,direction); return !!next && continuousWalkable(next); });
    const [direction] = choices[Math.floor(Math.random() * choices.length)];
    const requestId = ++sent;
    pending.set(`${i}:${requestId}`, performance.now());
    ws.send(JSON.stringify({ type: 'move', direction, requestId }));
  }, STEP_MS + 10 + (i % 7)));
  cleanupTimers.push(...timers);
  const signals = setInterval(() => {
    for (const [i, snapshot] of voices) for (const peer of snapshot.peers) {
      clients[i].send(JSON.stringify({ type: 'voice-signal', to: peer.id, session: peer.session,
        payload: { kind: 'description', type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' } }));
    }
  }, 1000);
  cleanupTimers.push(signals);
  let arcadeFailure: unknown;
  const attempted = new Set<string>(), fireAt = new Map<number, number>();
  if (arcadeMode) cleanupTimers.push(setInterval(() => {
    const now = Date.now();
    for (const actor of arcadeActors) {
      const table = tables.get(actor.game)!; if (table.phase !== 'playing') continue;
      let command: ArcadeCommand | undefined, value = 0, beatId: number | undefined, key = '';
      if (actor.game === 'four' && table.members[table.turn].id === self[actor.client].id) { command = 'drop'; value = table.board.findIndex((v, col) => col < 7 && !v); key = `${table.roundId}:${table.revision}`; }
      else if (actor.game === 'reflex' && table.light === 'go' && actor.client % 2 === table.round % 2) { command = 'tap'; value = table.round; key = `${table.roundId}:${table.round}`; }
      else if (actor.game === 'meteor' && now - (fireAt.get(actor.client) ?? 0) >= 500 && table.meteors.some((m) => m.lane === actor.client % 3)) { command = 'fire'; value = actor.client % 3; fireAt.set(actor.client, now); key = `${table.roundId}:${now}`; }
      else if (isRhythmGame(actor.game)) {
        const hold = table.holds.find((h) => h.id === self[actor.client].id), beat = hold ? table.beats[hold.beatId] : nearestBeat(table.beats, now);
        if (beat && (hold ? now >= hold.startedAt + beat.span : now >= beat.at && now <= beat.at + 120)) { command = actor.game === 'toast' ? hold ? 'toast-release' : 'toast-press' : 'beat'; value = beat.key; beatId = beat.id; key = `${table.roundId}:${beat.id}:${command}`; }
      }
      key = `${actor.client}:${key}`; if (!command || attempted.has(key)) continue; attempted.add(key);
      void arcadeCommand(actor.client, actor.game, command, value, beatId).catch((error) => { arcadeFailure = error; });
    }
  }, 50));
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  cleanupTimers.forEach(clearInterval);
  if (arcadeFailure) throw arcadeFailure;
  timers.forEach(clearInterval); clearInterval(signals);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const elapsed = (performance.now() - start) / 1000;
  const metricsPromise = once(child, 'message'); child.send('metrics');
  const [metrics] = await metricsPromise as [{ cpuMicros: { user: number; system: number }; rssBytes: number; eventLoopP99Ms: number }];
  measured = false;
  assert.equal(arcadePending.size, 0);
  if (continuousMode) { assert.equal(self.filter(p => p.continuous).length,150); assert.ok(boundaryCrossings > 0, 'No continuous boundaries were crossed'); }
  assert.equal(unexpectedCloses, 0);
  assert.equal(pending.size, 0);
  assert.equal(latencies.length, sent);
  assert.ok(relayed > 0);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  assert.ok(p95 < 250, `ack p95 ${p95}ms exceeds 250ms`);
  arcadeLatency.sort((a, b) => a - b);
  if (arcadeMode) { assert.equal(arcadeActors.length, 28); assert.ok(arcadeActions > 100); assert.ok(arcadeLatency[Math.floor(arcadeLatency.length * .95)] < 250, 'Arcade ack p95 exceeds 250ms'); }
  const result = { payloadByType, continuousMode, boundaryCrossings, arcadePlayers: arcadeActors.length, arcadeActions, arcadeAckP95Ms: arcadeLatency[Math.floor(arcadeLatency.length * .95)], at: new Date().toISOString(), platform: `${process.platform}/${process.arch}`, seconds: elapsed, clients: 150, voiceSignalingMembers: 30,
    equippedBuddies: self.filter((p) => p.buddy).length, audioMediaMeasured: false, movementRequests: sent, unexpectedCloses, ackP95Ms: p95, ackMaxMs: latencies.at(-1),
    eventLoopP99Ms: metrics.eventLoopP99Ms, serverCpuOneCorePercent: (metrics.cpuMicros.user + metrics.cpuMicros.system) / (elapsed * 1e6) * 100,
    serverRssMiB: metrics.rssBytes / 1024 ** 2, serverPayloadEgressMbps: bytes * 8 / elapsed / 1e6, positionFramesReceived: positions, relayedSignals: relayed };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.LOAD_REPORT) await writeFile(process.env.LOAD_REPORT, JSON.stringify(result, null, 2) + '\n');
} finally {
  cleanupTimers.forEach(clearInterval);
  measured = false; clients.forEach((ws) => ws.terminate()); child.send('close');
  setTimeout(() => child.kill(), 2000).unref();
}
