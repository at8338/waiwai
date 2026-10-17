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
const self: Player[] = [];
const voices = new Map<number, VoiceSnapshot>();
const pending = new Map<string, number>();
let unexpectedCloses = 0, measured = false, bytes = 0, positions = 0, sent = 0, relayed = 0;
const latencies: number[] = [];
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
      if (measured) bytes += Buffer.byteLength(String(raw));
      if (message.type === 'welcome') { self[i] = message.players.find(({ id }) => id === message.id)!; resolve(); }
      if (message.type === 'player' && message.player.id === self[i]?.id) {
        self[i] = message.player;
        if (message.requestId) {
          const key = `${i}:${message.requestId}`, start = pending.get(key);
          if (start !== undefined) { latencies.push(performance.now() - start); pending.delete(key); }
        }
      }
      if (message.type === 'positions' && measured) positions++;
      if (message.type === 'voice') { voices.set(i, message); assert.ok(message.peers.length <= 4); }
      if (message.type === 'voice-signal') relayed++;
    }));
    await welcome;
    ws.send(JSON.stringify({ type: 'profile', name: `負荷試験${i}`, outfit: i % 3 }));
    if (i < 30) ws.send(JSON.stringify({ type: 'voice-state', listening: true, microphone: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(voices.size, 30);
  const reset = once(child, 'message'); child.send('reset'); await reset;
  measured = true;
  const start = performance.now();
  const directions: Array<[Direction, number, number]> = [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]];
  const timers = clients.map((ws, i) => setInterval(() => {
    const p = self[i];
    const choices = directions.filter(([, dx, dy]) => canWalk(p.x + dx, p.y + dy));
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
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  timers.forEach(clearInterval); clearInterval(signals);
  await new Promise((resolve) => setTimeout(resolve, 200));
  const elapsed = (performance.now() - start) / 1000;
  const metricsPromise = once(child, 'message'); child.send('metrics');
  const [metrics] = await metricsPromise as [{ cpuMicros: { user: number; system: number }; rssBytes: number; eventLoopP99Ms: number }];
  measured = false;
  assert.equal(unexpectedCloses, 0);
  assert.equal(pending.size, 0);
  assert.equal(latencies.length, sent);
  assert.ok(relayed > 0);
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  assert.ok(p95 < 250, `ack p95 ${p95}ms exceeds 250ms`);
  const result = { at: new Date().toISOString(), platform: `${process.platform}/${process.arch}`, seconds: elapsed, clients: 150, voiceSignalingMembers: 30,
    audioMediaMeasured: false, movementRequests: sent, unexpectedCloses, ackP95Ms: p95, ackMaxMs: latencies.at(-1),
    eventLoopP99Ms: metrics.eventLoopP99Ms, serverCpuOneCorePercent: (metrics.cpuMicros.user + metrics.cpuMicros.system) / (elapsed * 1e6) * 100,
    serverRssMiB: metrics.rssBytes / 1024 ** 2, serverPayloadEgressMbps: bytes * 8 / elapsed / 1e6, positionFramesReceived: positions, relayedSignals: relayed };
  console.log(JSON.stringify(result, null, 2));
  if (process.env.LOAD_REPORT) await writeFile(process.env.LOAD_REPORT, JSON.stringify(result, null, 2) + '\n');
} finally {
  cleanupTimers.forEach(clearInterval);
  measured = false; clients.forEach((ws) => ws.terminate()); child.send('close');
  setTimeout(() => child.kill(), 2000).unref();
}
