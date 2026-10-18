import type { ChatAction, ChatEvent } from '../game/chat.ts';
import type { PolicyAction } from '../game/world-policy.ts';
import type { DummyControl } from '../game/dummy-avatars.ts';
import type { ArcadeAction } from '../game/arcade.ts';
import type { BirthdayAction } from '../game/birthdays.ts';
import type { DevWorldAction } from '../game/dev-world.ts';
import type { SpellAction } from '../game/spells.ts';
import { DASH_MS } from '../game/dash.ts';
import type { ArenaAction } from '../game/arena.ts';
import type { RobotAction } from '../game/robot.ts';
import type { AnnouncementAction } from '../game/announcements.ts';
import type { RoomPet } from '../game/buddies.ts';
import type { RoomId } from '../game/rooms.ts';
import type { RoomObject } from '../game/objects.ts';
import type { Direction } from '../game/world.ts';
import { movementStep } from '../game/transport.ts';
import type { VehicleAction, VehicleUnit } from '../game/transport.ts';
import { directions } from './protocol.ts';
import type { ClientMessage, Player, Profile, ServerMessage } from './protocol.ts';
import type { VoiceSignal, VoiceSnapshot, VoicePayload, VoiceState } from '../audio/protocol.ts';
import type { Person } from '../game/directory.ts';
import type { LinkEdit } from '../game/object-links.ts';
import type { ReactionKind } from '../game/reactions.ts';

export type ConnectionState = 'connecting' | 'online' | 'reconnecting';
export type ConnectionHandlers = {
  dummies?: (message: Extract<ServerMessage, { type: 'dummy-state' }>) => void;
  dummyResult?: (id: string, error?: string) => void;
  policy?: (message: Extract<ServerMessage, { type: 'world-policy' }>) => void;
  policyResult?: (id: string, error?: string) => void;
  chat?: (event: ChatEvent) => void;
  ice?: (message: Extract<ServerMessage, { type: 'ice-state' }>) => void;
  arena?: (message: Extract<ServerMessage, { type: 'arena-state' }>) => void;
  arenaResult?: (message: Extract<ServerMessage, { type: 'arena-result' }>) => void;
  spellEffect?: (message: Extract<ServerMessage, { type: 'spell-effect' }>) => void;
  spellResult?: (message: Extract<ServerMessage, { type: 'spell-result' }>) => void;
  devWorld?: (message: Extract<ServerMessage, { type: 'dev-world-state' }>) => void;
  devWorldResult?: (id: string, error?: string) => void;
  birthdays?: (message: Extract<ServerMessage, { type: 'birthdays' }>) => void;
  birthdayThread?: (message: Extract<ServerMessage, { type: 'birthday-thread' }>) => void;
  birthdayResult?: (id: string, error?: string) => void;
  lostItems?: (message: Extract<ServerMessage, { type: 'lost-items' }>) => void;
  arcadeState?: (message: Extract<ServerMessage, { type: 'arcade-state' }>) => void;
  arcadeResult?: (message: Extract<ServerMessage, { type: 'arcade-result' }>) => void;
  robotState?: (message: Extract<ServerMessage, { type: 'robot-state' }>) => void;
  robotResult?: (message: Extract<ServerMessage, { type: 'robot-result' }>) => void;
  dailyEvent?: (message: Extract<ServerMessage, { type: 'daily-event' }>) => void;
  announcements?: (message: Extract<ServerMessage, { type: 'announcements' }>) => void;
  announcementResult?: (actionId: string, error?: string) => void;
  state: (state: ConnectionState) => void;
  welcome: (id: string, players: Player[]) => void;
  player: (player: Player, snap: boolean, reason?: Extract<ServerMessage, { type: 'player' }>['reason']) => void;
  left: (id: string) => void;
  voice: (snapshot: VoiceSnapshot) => void;
  voiceSignal: (signal: VoiceSignal) => void;
  vehicles?: (units: VehicleUnit[]) => void;
  vehicleResult?: (actionId: string, error?: string) => void;
  pets?: (roomId: RoomId, pets: RoomPet[]) => void;
  objects?: (roomId: RoomId, objects: RoomObject[]) => void;
  objectResult?: (editId: string, error?: string) => void;
  directory?: (people: Person[], warning?: string) => void;
  travelComplete?: () => void;
  travelError?: (error: string) => void;
  objectLinks?: (snapshot: Extract<ServerMessage, { type: 'object-links' }>) => void;
  linkResult?: (result: Extract<ServerMessage, { type: 'link-result' }>) => void;
  reaction?: (message: Extract<ServerMessage, { type: 'reaction' }>) => void;
  restResult?: (error?: string) => void;
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
  private warpRequest?: number;
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
        if (message.player.id === this.id && (message.reason === 'spell' || message.reason === 'rest' || message.reason === 'policy')) {
          this.pending = undefined; this.warpRequest = undefined; window.clearTimeout(this.watchdog); this.nextRequestAt = performance.now() + movementStep(message.player.riding?.kind);
        }
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
        if (message.player.id === this.id && message.reason === 'vending') this.profile = { ...this.profile, appearance: message.player.appearance };
        this.handlers.player(message.player, message.reason === 'reset' || message.reason === 'join' || message.reason === 'room' || message.reason === 'warp' || message.reason === 'spell' || message.reason === 'rest' || message.reason === 'policy', message.reason);
        if (message.player.id === this.id && message.reason === 'warp' && message.requestId === this.warpRequest) {
          this.warpRequest = undefined;
          this.handlers.travelComplete?.();
        }
      } else if (message.type === 'positions') {
        for (const [slot, x, y, flags, buddyX, buddyY, buddyFacing] of message.positions) {
          const id = this.slots.get(slot);
          if (!id) continue;
          const previous = this.players.get(id);
          // Own acknowledgments are newer than a coalesced remote frame.
          if (!previous || id === this.id) continue;
          const player = { ...previous, x, y, facing: directions[flags & 3], ...(buddyX !== undefined && buddyY !== undefined && buddyFacing !== undefined ? { buddyPosition: { x: buddyX, y: buddyY, facing: directions[buddyFacing] } } : {}) };
          this.players.set(id, player);
          this.handlers.player(player, (flags & 4) !== 0, flags & 8 ? 'dash' : undefined);
        }
      } else if (message.type === 'left') {
        const player = this.players.get(message.id);
        if (player) this.slots.delete(player.slot);
        this.players.delete(message.id); this.handlers.left(message.id);
      }
      else if (message.type === 'chat-state' || message.type === 'chat-history' || message.type === 'chat-message' || message.type === 'chat-result') this.handlers.chat?.(message);
      else if (message.type === 'ice-state') this.handlers.ice?.(message);
      else if (message.type === 'arena-state') this.handlers.arena?.(message);
      else if (message.type === 'arena-result') this.handlers.arenaResult?.(message);
      else if (message.type === 'spell-effect') this.handlers.spellEffect?.(message);
      else if (message.type === 'spell-result') this.handlers.spellResult?.(message);
      else if (message.type === 'lost-items') this.handlers.lostItems?.(message);
      else if (message.type === 'arcade-state') this.handlers.arcadeState?.(message);
      else if (message.type === 'arcade-result') this.handlers.arcadeResult?.(message);
      else if (message.type === 'robot-state') this.handlers.robotState?.(message);
      else if (message.type === 'robot-result') this.handlers.robotResult?.(message);
      else if (message.type === 'daily-event') this.handlers.dailyEvent?.(message);
      else if (message.type === 'world-policy') this.handlers.policy?.(message);
      else if (message.type === 'dummy-state') this.handlers.dummies?.(message);
      else if (message.type === 'dummy-result') this.handlers.dummyResult?.(message.actionId, message.error);
      else if (message.type === 'policy-result') this.handlers.policyResult?.(message.actionId, message.error);
      else if (message.type === 'dev-world-state') this.handlers.devWorld?.(message);
      else if (message.type === 'dev-world-result') this.handlers.devWorldResult?.(message.actionId, message.error);
      else if (message.type === 'birthdays') this.handlers.birthdays?.(message);
      else if (message.type === 'birthday-thread') this.handlers.birthdayThread?.(message);
      else if (message.type === 'birthday-result') this.handlers.birthdayResult?.(message.actionId, message.error);
      else if (message.type === 'announcements') this.handlers.announcements?.(message);
      else if (message.type === 'announcement-result') this.handlers.announcementResult?.(message.actionId, message.error);
      else if (message.type === 'vehicles') this.handlers.vehicles?.(message.units);
      else if (message.type === 'vehicle-result') this.handlers.vehicleResult?.(message.actionId, message.error);
      else if (message.type === 'pets') this.handlers.pets?.(message.roomId, message.pets);
      else if (message.type === 'reaction') this.handlers.reaction?.(message);
      else if (message.type === 'rest-result') this.handlers.restResult?.(message.error);
      else if (message.type === 'directory') this.handlers.directory?.(message.people, message.warning);
      else if (message.type === 'travel-error') {
        if (message.requestId !== this.warpRequest) return;
        this.warpRequest = undefined;
        this.pending = undefined;
        window.clearTimeout(this.watchdog);
        this.handlers.travelError?.(message.error);
      }
      else if (message.type === 'object-links') this.handlers.objectLinks?.(message);
      else if (message.type === 'link-result') this.handlers.linkResult?.(message);
      else if (message.type === 'objects') this.handlers.objects?.(message.roomId, message.objects);
      else if (message.type === 'object-result') this.handlers.objectResult?.(message.editId, message.error);
      else if (message.type === 'voice') this.handlers.voice(message);
      else if (message.type === 'voice-signal') this.handlers.voiceSignal(message);
    };
    socket.onerror = () => socket.close();
    socket.onclose = (event) => {
      if (this.disposed || this.socket !== socket) return;
      window.clearTimeout(this.watchdog);
      this.online = false;
      this.pending = undefined;
      this.warpRequest = undefined;
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
  dash(direction: Direction): void { if (this.readyToMove) { this.request({ type: 'dash', direction, requestId: ++this.sequence }); this.nextRequestAt = performance.now() + DASH_MS; } }

  changeRoom(roomId: RoomId): void {
    if (this.online) this.request({ type: 'change-room', roomId, requestId: ++this.sequence });
  }

  warpTo(targetId: string): boolean {
    if (!this.online) return false;
    this.request({ type: 'warp-to', targetId, requestId: ++this.sequence });
    return true;
  }

  editObject(message: Extract<ClientMessage, { editId: string }>): void { if (this.online) this.send(message); }
  editLinks(message: LinkEdit): void { if (this.online) this.send(message); }
  react(kind: ReactionKind): boolean {
    if (!this.online || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.send({ type: 'reaction', kind }); return true;
  }
  rest(resting: boolean): boolean {
    if (!this.online || this.socket?.readyState !== WebSocket.OPEN) return false;
    this.send({ type: 'rest', resting }); return true;
  }

  arcade(action: ArcadeAction): boolean { if (!this.online) return false; this.send(action); return true; }
  robot(action: RobotAction, actionId: string): boolean { if (!this.online) return false; this.send({ type: 'robot-action', action, actionId }); return true; }

  announcement(action: AnnouncementAction): boolean { if (!this.online) return false; this.send(action); return true; }
  chat(action: ChatAction): boolean { if (!this.online) return false; this.send(action); return true; }
  birthday(action: BirthdayAction): boolean { if (!this.online) return false; this.send(action); return true; }
  devWorld(action: DevWorldAction): boolean { if (!this.online) return false; this.send(action); return true; }
  setPolicy(action: PolicyAction): boolean { if (!this.online) return false; this.send(action); return true; }
  controlDummies(action: DummyControl): boolean { if (!this.online) return false; this.send(action); return true; }
  castSpell(action: SpellAction): boolean { if (!this.online) return false; this.send(action); return true; }
  arenaAction(action: ArenaAction): boolean { if (!this.online) return false; this.send(action); return true; }

  vehicle(action: VehicleAction, actionId: string): boolean {
    if (!this.online) return false;
    this.send({ ...action, actionId }); return true;
  }

  reset(): void {
    if (this.online) this.request({ type: 'reset', requestId: ++this.sequence });
  }

  private request(message: Extract<ClientMessage, { requestId: number }>): void {
    if (this.warpRequest !== undefined) this.handlers.travelError?.('別の移動操作に切り替えました。');
    this.warpRequest = message.type === 'warp-to' ? message.requestId : undefined;
    this.pending = message.requestId;
    this.nextRequestAt = performance.now() + movementStep(this.players.get(this.id ?? '')?.riding?.kind);
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
