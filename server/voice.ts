import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { MAX_VOICE_MEMBERS, proximityGain } from '../src/audio/proximity.ts';
import type { IceServer, VoiceSnapshot, VoiceState } from '../src/audio/protocol.ts';
import type { ClientMessage, Player, ServerMessage } from '../src/network/protocol.ts';

export class VoiceRoom {
  private states = new Map<WebSocket, VoiceState>();
  private pairs = new Map<string, string>();
  private sent = new Map<WebSocket, string>();
  private players: Map<WebSocket, Player>;
  private send: (ws: WebSocket, message: ServerMessage) => void;
  private iceServers: IceServer[];

  constructor(players: Map<WebSocket, Player>, send: (ws: WebSocket, message: ServerMessage) => void, iceServers: IceServer[]) {
    this.players = players; this.send = send; this.iceServers = iceServers;
  }

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
    const livePairs = new Set<string>();
    const snapshots = new Map<WebSocket, VoiceSnapshot>();
    for (const [ws, self] of this.states) {
      const a = this.players.get(ws);
      if (!a) continue;
      const peers = [];
      if (self.listening) for (const [other, state] of this.states) {
        const b = this.players.get(other);
        if (other === ws || !b || !state.listening || proximityGain(a, b) <= 0) continue;
        const key = this.key(a.id, b.id);
        livePairs.add(key);
        if (!this.pairs.has(key)) this.pairs.set(key, randomUUID());
        peers.push({ id: b.id, session: this.pairs.get(key)!, microphone: state.microphone });
      }
      snapshots.set(ws, { type: 'voice', self, peers, iceServers: self.listening ? this.iceServers : [] });
    }
    for (const key of this.pairs.keys()) if (!livePairs.has(key)) this.pairs.delete(key);
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

export function readIceServers(): IceServer[] {
  const raw = process.env.RTC_ICE_SERVERS;
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
