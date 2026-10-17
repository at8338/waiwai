import type { Direction } from '../game/world.ts';
import { STEP_MS } from '../game/world.ts';
import { directions } from './protocol.ts';
import type { ClientMessage, Player, Profile, ServerMessage } from './protocol.ts';
import type { VoiceSignal, VoiceSnapshot, VoicePayload, VoiceState } from '../audio/protocol.ts';

export type ConnectionState = 'connecting' | 'online' | 'reconnecting';
export type ConnectionHandlers = {
  state: (state: ConnectionState) => void;
  welcome: (id: string, players: Player[]) => void;
  player: (player: Player, snap: boolean) => void;
  left: (id: string) => void;
  voice: (snapshot: VoiceSnapshot) => void;
  voiceSignal: (signal: VoiceSignal) => void;
};

export class OfficeConnection {
  private socket?: WebSocket;
  private reconnectTimer?: number;
  private watchdog?: number;
  private attempts = 0;
  private disposed = false;
  private profile: Profile = { name: 'あなた', outfit: 0 };
  private sequence = 0;
  private pending?: number;
  private id?: string;
  private online = false;
  private nextRequestAt = 0;
  private handlers: ConnectionHandlers;
  private players = new Map<string, Player>();
  private slots = new Map<number, string>();

  constructor(handlers: ConnectionHandlers) {
    this.handlers = handlers;
    this.connect();
  }

  private connect(): void {
    if (this.disposed) return;
    this.handlers.state(this.attempts ? 'reconnecting' : 'connecting');
    const url = new URL('/office', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = this.socket = new WebSocket(url);
    this.watchdog = window.setTimeout(() => socket.close(), 8000);
    socket.onmessage = (event) => {
      if (this.disposed || this.socket !== socket) return;
      let message: ServerMessage;
      try { message = JSON.parse(event.data) as ServerMessage; } catch { socket.close(); return; }
      if (message.type === 'welcome') {
        window.clearTimeout(this.watchdog);
        this.pending = undefined;
        this.online = true;
        this.attempts = 0;
        this.id = message.id;
        this.players = new Map(message.players.map((player) => [player.id, player]));
        this.slots = new Map(message.players.map((player) => [player.slot, player.id]));
        this.handlers.welcome(message.id, message.players);
        this.handlers.state('online');
        this.send({ type: 'profile', ...this.profile });
      } else if (message.type === 'player') {
        if (message.player.id === this.id && message.requestId !== undefined) {
          // A reset can supersede an in-flight move. Ignore that older response.
          if (this.pending !== undefined && message.requestId < this.pending) return;
          if (message.requestId === this.pending) {
            this.pending = undefined;
            window.clearTimeout(this.watchdog);
          }
        }
        this.players.set(message.player.id, message.player);
        this.slots.set(message.player.slot, message.player.id);
        this.handlers.player(message.player, message.reason === 'reset' || message.reason === 'join');
      } else if (message.type === 'positions') {
        for (const [slot, x, y, flags] of message.positions) {
          const id = this.slots.get(slot);
          if (!id) continue;
          const previous = this.players.get(id);
          // Own acknowledgments are newer than a coalesced remote frame.
          if (!previous || id === this.id) continue;
          const player = { ...previous, x, y, facing: directions[flags & 3] };
          this.players.set(id, player);
          this.handlers.player(player, (flags & 4) !== 0);
        }
      } else if (message.type === 'left') {
        const player = this.players.get(message.id);
        if (player) this.slots.delete(player.slot);
        this.players.delete(message.id); this.handlers.left(message.id);
      }
      else if (message.type === 'voice') this.handlers.voice(message);
      else if (message.type === 'voice-signal') this.handlers.voiceSignal(message);
    };
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      if (this.disposed || this.socket !== socket) return;
      window.clearTimeout(this.watchdog);
      this.online = false;
      this.pending = undefined;
      this.id = undefined;
      this.players.clear();
      this.slots.clear();
      if (event.code === 4001) {
        this.handlers.state('reconnecting');
        window.location.reload();
        return;
      }
      this.attempts++;
      this.handlers.state('reconnecting');
      this.reconnectTimer = window.setTimeout(() => this.connect(), Math.min(750 * 2 ** (this.attempts - 1), 10_000));
    };
  }

  get readyToMove(): boolean { return this.online && this.pending === undefined && performance.now() >= this.nextRequestAt; }

  private send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  move(direction: Direction): void {
    if (!this.readyToMove) return;
    this.request({ type: 'move', direction, requestId: ++this.sequence });
  }

  reset(): void {
    if (this.online) this.request({ type: 'reset', requestId: ++this.sequence });
  }

  private request(message: Extract<ClientMessage, { requestId: number }>): void {
    this.pending = message.requestId;
    this.nextRequestAt = performance.now() + STEP_MS;
    window.clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => this.socket?.close(), 5000);
    this.send(message);
  }

  setProfile(profile: Profile): void {
    this.profile = { ...profile };
    if (this.online) this.send({ type: 'profile', ...this.profile });
  }

  setVoice(state: VoiceState): void { if (this.online) this.send({ type: 'voice-state', ...state }); }
  signalVoice(to: string, session: string, payload: VoicePayload): void {
    if (this.online) this.send({ type: 'voice-signal', to, session, payload });
  }

  destroy(): void {
    this.disposed = true;
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.watchdog);
    this.socket?.close();
  }
}
