import { createHmac, randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { MAX_VOICE_MEMBERS, MAX_VOICE_PEERS, proximityGain } from '../src/audio/proximity.ts';
import type { IceServer, VoiceSnapshot, VoiceState } from '../src/audio/protocol.ts';
import type { ClientMessage, Player, ServerMessage } from '../src/network/protocol.ts';

export class VoiceRoom {
  private states = new Map<WebSocket, VoiceState>();
  private pairs = new Map<string, string>();
  private sent = new Map<WebSocket, string>();
  private players: Map<WebSocket, Player>;
  private send: (ws: WebSocket, message: ServerMessage) => void;
  private iceProvider: (id: string) => IceServer[];
  private dirty = false;
  private lastRefresh = 0;

  constructor(players: Map<WebSocket, Player>, send: (ws: WebSocket, message: ServerMessage) => void, ice: IceServer[] | ((id: string) => IceServer[])) {
    this.players = players; this.send = send; this.iceProvider = typeof ice === 'function' ? ice : () => ice;
  }

  markDirty(): void { this.dirty = true; }
  refreshIfDirty(): void { if (this.dirty || Date.now() - this.lastRefresh > 60_000) this.refresh(); }

  private key(a: string, b: string): string { return [a, b].sort().join(':'); }

  state(ws: WebSocket, next: VoiceState): void {
    if (next.listening && !this.states.get(ws)?.listening &&
        [...this.states.values()].filter((state) => state.listening).length >= MAX_VOICE_MEMBERS) {
      this.send(ws, { type: 'voice', self: { listening: false, microphone: false }, peers: [], iceServers: [], error: 'capacity' });
      return;
    }
    this.states.set(ws, next);
    this.refresh();
  }

  refresh(): void {
    this.dirty = false;
    this.lastRefresh = Date.now();
    const members = [...this.states].flatMap(([ws, state]) => {
      const player = this.players.get(ws);
      return player && state.listening ? [{ ws, state, player }] : [];
    });
    const candidates = [];
    const nearby = new Map<string, number>();
    for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) {
      const a = members[i].player, b = members[j].player;
      if (proximityGain(a, b) <= 0) continue;
      const key = this.key(a.id, b.id);
      candidates.push({ a, b, key, existing: this.pairs.has(key), distance: Math.hypot(a.x - b.x, a.y - b.y) });
      nearby.set(a.id, (nearby.get(a.id) ?? 0) + 1);
      nearby.set(b.id, (nearby.get(b.id) ?? 0) + 1);
    }
    // Keep valid conversations stable; fill free slots with the nearest reciprocal pairs.
    candidates.sort((a, b) => Number(b.existing) - Number(a.existing) || a.distance - b.distance || a.key.localeCompare(b.key));
    const livePairs = new Map<string, string>();
    const degree = new Map<string, number>();
    for (const { a, b, key } of candidates) {
      if ((degree.get(a.id) ?? 0) >= MAX_VOICE_PEERS || (degree.get(b.id) ?? 0) >= MAX_VOICE_PEERS) continue;
      livePairs.set(key, this.pairs.get(key) ?? randomUUID());
      degree.set(a.id, (degree.get(a.id) ?? 0) + 1);
      degree.set(b.id, (degree.get(b.id) ?? 0) + 1);
    }
    this.pairs = livePairs;
    const snapshots = new Map<WebSocket, VoiceSnapshot>();
    for (const [ws, self] of this.states) {
      const a = this.players.get(ws);
      if (!a) continue;
      const peers = [];
      if (self.listening) for (const [other, state] of this.states) {
        const b = this.players.get(other);
        if (other === ws || !b || !state.listening || proximityGain(a, b) <= 0) continue;
        const key = this.key(a.id, b.id);
        if (!this.pairs.has(key)) continue;
        peers.push({ id: b.id, session: this.pairs.get(key)!, microphone: state.microphone });
      }
      snapshots.set(ws, { type: 'voice', self, peers, iceServers: self.listening ? this.iceProvider(a.id) : [],
        limited: (nearby.get(a.id) ?? 0) > peers.length });
    }
    for (const [ws, snapshot] of snapshots) {
      const serialized = JSON.stringify(snapshot);
      if (this.sent.get(ws) !== serialized) {
        this.sent.set(ws, serialized);
        this.send(ws, snapshot);
      }
    }
  }

  signal(ws: WebSocket, message: Extract<ClientMessage, { type: 'voice-signal' }>): void {
    const a = this.players.get(ws);
    if (!a || !this.states.get(ws)?.listening) return;
    const target = [...this.players].find(([, player]) => player.id === message.to);
    if (!target) return;
    const [other, b] = target;
    if (other === ws || !this.states.get(other)?.listening || proximityGain(a, b) <= 0) return;
    if (this.pairs.get(this.key(a.id, b.id)) !== message.session) return;
    this.send(other, { type: 'voice-signal', from: a.id, session: message.session, payload: message.payload });
  }

  leave(ws: WebSocket): void {
    this.states.delete(ws); this.sent.delete(ws); this.refresh();
  }
}

// coturn TURN REST authentication: the shared secret never leaves the server.
// One-hour credentials rotate every half hour, including long-running sessions.
export function readIceProvider(env: NodeJS.ProcessEnv = process.env, now = Date.now): (id: string) => IceServer[] {
  const fixed = readIceServers(env.RTC_ICE_SERVERS);
  if (!env.TURN_SHARED_SECRET && !env.TURN_URLS) return () => fixed;
  if (!env.TURN_SHARED_SECRET || env.TURN_SHARED_SECRET.length < 32 || !env.TURN_URLS) throw new Error('Set TURN_URLS and TURN_SHARED_SECRET (at least 32 characters) together.');
  const secret = env.TURN_SHARED_SECRET;
  const urls = env.TURN_URLS.split(',').map((url) => url.trim());
  if (!urls.length || urls.some((url) => !/^turns?:[^\s]+$/.test(url))) throw new Error('Invalid TURN_URLS.');
  return (id) => {
    const expires = (Math.floor(now() / 1_800_000) + 2) * 1800;
    const username = `${expires}:${id}`;
    const credential = createHmac('sha1', secret).update(username).digest('base64');
    return [...fixed, { urls, username, credential }];
  };
}

export function readIceServers(raw = process.env.RTC_ICE_SERVERS): IceServer[] {
  if (!raw) return [];
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('RTC_ICE_SERVERS must be valid JSON.'); }
  if (!Array.isArray(value) || value.length > 8) throw new Error('RTC_ICE_SERVERS must be an array of up to 8 ICE servers.');
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid ICE server configuration.');
    const data = item as Record<string, unknown>;
    const urls = typeof data.urls === 'string' ? [data.urls] : data.urls;
    if (!Array.isArray(urls) || !urls.length || !urls.every((url) => typeof url === 'string' && /^(stun|stuns|turn|turns):/.test(url))) throw new Error('Invalid ICE server URLs.');
    if ((data.username !== undefined && typeof data.username !== 'string') ||
        (data.credential !== undefined && typeof data.credential !== 'string')) throw new Error('Invalid ICE server credentials.');
    return { urls: urls as string[], username: data.username as string | undefined, credential: data.credential as string | undefined };
  });
}
