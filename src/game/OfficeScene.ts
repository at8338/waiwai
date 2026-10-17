import { ArcadeUI } from './arcade-ui.ts';
import { ARCADE_GAMES, ARCADE_IDS } from './arcade.ts';
import { CockpitUI } from './cockpit-ui.ts';
import { CockpitView } from './CockpitView.ts';
import { ROBOT_CONSOLE_KINDS, robotLocation } from './robot.ts';
import { walkingMotion } from './walking.ts';
import { DailyEventsUI } from './daily-events-ui.ts';
import { DailyEventsView } from './daily-events-view.ts';
import { AnnouncementsUI } from './announcements-ui.ts';
import { LOST_ITEM_CATALOG } from './lost-items.ts';
import { LostItemsView } from './lost-items-view.ts';
import { seatSpots, restingSeat } from './seating.ts';
import type { SeatSpot } from './seating.ts';
import { movementStep, VEHICLES } from './transport.ts';
import { VehicleDocksView, vehicleTexture } from './transport-view.ts';
import { TransportUI } from './transport-ui.ts';
import { SkyWindowView } from './SkyWindowView.ts';
import { RoomLighting } from './RoomLighting.ts';
import { CompanionsView } from './companions-view.ts';
import { BUDDIES } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
import Phaser from 'phaser';
import { avatarTexture, createAvatarTextures, drawOffice, drawRoomObject } from './art.ts';
import { Controls } from './controls.ts';
import { Walker, areaAt, COLS, ROWS, TILE } from './world.ts';
import type { Direction } from './world.ts';
import { OfficeConnection } from '../network/OfficeConnection.ts';
import type { ConnectionState } from '../network/OfficeConnection.ts';
import type { Player } from '../network/protocol.ts';
import { ProximityVoice } from '../audio/ProximityVoice.ts';
import type { VoiceUI } from '../audio/ProximityVoice.ts';
import { activateSlackDM, slackDMUrl } from '../slack/dm.ts';
import type { SlackIdentity } from '../slack/dm.ts';
import { DEFAULT_APPEARANCE, parseAppearance } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import { ROOMS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { MAX_ROOM_OBJECTS, OBJECT_CATALOG, objectContains, objectSize, placementProblem } from './objects.ts';
import type { ObjectKind, RoomObject } from './objects.ts';
import { ObjectLinksEditor } from './object-links-editor.ts';
import { boardInFront, objectTargets, targetAt } from './object-links.ts';
import { PeopleDirectory } from './people-directory.ts';
import { REACTIONS, REACTION_KINDS, REACTION_COOLDOWN_MS, reactionMotion } from './reactions.ts';
import type { ReactionKind } from './reactions.ts';

type AvatarView = {
  seatId?: string;
  sprite: Phaser.GameObjects.Image;
  vehicle: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  reactionLabel: Phaser.GameObjects.Text;
  sparkles: Phaser.GameObjects.Graphics;
};
type Peer = { player: Player; walker: Walker; view: AvatarView };

export class OfficeScene extends Phaser.Scene {
  private arcadeUI?: ArcadeUI;
  private cockpitUI?: CockpitUI;
  private cockpitView?: CockpitView;
  private dailyUI?: DailyEventsUI;
  private dailyView?: DailyEventsView;
  private announcementsUI?: AnnouncementsUI;
  private lostItems?: LostItemsView;
  private seats = new Map<string, SeatSpot>();
  private vehicleUI?: TransportUI;
  private vehicleDocks?: VehicleDocksView;
  private skyWindow?: SkyWindowView;
  private lighting?: RoomLighting;
  private companions?: CompanionsView;
  private buddyChoice: BuddyKind | null = null;
  readonly walker = new Walker();
  private controls = new Controls();
  private avatar!: AvatarView;
  private outfit = 0;
  private playerName = 'あなた';
  private lastArea = '';
  private inputController = new AbortController();
  private connection?: OfficeConnection;
  private localId?: string;
  private connected = false;
  private peers = new Map<string, Peer>();
  private players = new Map<string, Player>();
  private voice?: ProximityVoice;
  private speaking = new Set<string>();
  private slack: SlackIdentity | null;
  private selectedPlayer?: string;
  private participantsDirty = false;
  private lastParticipantsAt = 0;
  private loginRequired: boolean;
  private appearancePickup?: (appearance: Appearance) => void;
  private appearance: Appearance = { ...DEFAULT_APPEARANCE };
  private roomId: RoomId = 'office';
  private mapViews: Phaser.GameObjects.GameObject[] = [];
  private objects: RoomObject[] = [];
  private objectViews: Phaser.GameObjects.Graphics[] = [];
  private objectsReady = false;
  private editMode: 'none' | 'place' | 'move' | 'remove' = 'none';
  private objectKind: ObjectKind = 'desk';
  private objectRotation = 0;
  private selectedObject?: string;
  private pendingEdit?: string;
  private ghost?: Phaser.GameObjects.Graphics;
  private atDoor = false;
  private directoryUI?: PeopleDirectory;
  private linksUI?: ObjectLinksEditor;
  private frontBoard?: string;
  private reactions = new Map<string, { kind: ReactionKind; startedAt: number }>();
  private nextReactionAt = 0;
  private reactionBlocked = true;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(slack: SlackIdentity | null = null, loginRequired = false) { super('office'); this.slack = slack; this.loginRequired = loginRequired; }

  private makeAvatar(local: boolean): AvatarView {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x6e684b, 0.3).fillRect(-6, -1, 12, 3);
    const sprite = this.add.image(0, 0, avatarTexture(this, this.appearance, 'down', 0)).setOrigin(0.5, 1);
    const label = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#fff9e6',
      backgroundColor: local ? '#355b49' : '#786346', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setResolution(2);
    const reactionLabel = this.add.text(0, 0, '', { fontFamily: 'sans-serif', fontSize: '8px', color: '#506444',
      backgroundColor: '#fff0bf', padding: { x: 4, y: 2 } }).setOrigin(0.5, 1).setResolution(2).setVisible(false);
    const sparkles = this.add.graphics();
    const vehicle = this.add.image(0, 0, vehicleTexture(this, 'bike', 'down', 0)).setOrigin(0.5, 1).setVisible(false);
    return { sprite, vehicle, shadow, label, reactionLabel, sparkles };
  }

  create(): void {
    this.mapViews = drawOffice(this, this.roomId, () => { if (this.editMode === 'none') this.dailyUI?.openCalendar(); }, (game) => { if (this.editMode === 'none') this.arcadeUI?.open(game); });
    this.lostItems = new LostItemsView(this, this.inputController.signal, (item) => {
      if (this.editMode !== 'none' || document.querySelector('dialog[open]')) return;
      this.controls.clear();
      const entry = LOST_ITEM_CATALOG[item.kind];
      document.querySelector('#lost-item-title')!.textContent = entry.name;
      document.querySelector('#lost-item-description')!.textContent = entry.note;
      document.querySelector<HTMLDialogElement>('#lost-item-info')!.showModal();
    });
    document.querySelector('#lost-item-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#lost-item-info')!.close(), { signal: this.inputController.signal });
    this.dailyUI = new DailyEventsUI(this.inputController.signal, (room) => this.connection?.changeRoom(room), () => {
      if (document.querySelector('dialog[open]')) return false;
      this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.dailyView = new DailyEventsView(this, () => { if (this.editMode === 'none') this.dailyUI?.inspect(); });
    this.cockpitUI = new CockpitUI(this.inputController.signal, (action, id) => this.connection?.robot(action, id) ?? false, (room) => this.connection?.changeRoom(room), () => {
      if (document.querySelector('dialog[open]')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.cockpitView = new CockpitView(this);
    this.arcadeUI = new ArcadeUI(this.inputController.signal, (action) => this.connection?.arcade(action) ?? false, () => {
      if (document.querySelector('dialog[open]')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.lighting = new RoomLighting(this);
    this.skyWindow = new SkyWindowView(document.querySelector<HTMLCanvasElement>('#sky-window')!);
    createAvatarTextures(this);
    this.companions = new CompanionsView(this, (kind, owner) => {
      if (this.editMode !== 'none') return;
      this.controls.clear();
      document.querySelector('#buddy-info-title')!.textContent = `${BUDDIES[kind].icon} ${BUDDIES[kind].name}`;
      document.querySelector('#buddy-info-owner')!.textContent = owner;
      document.querySelector('#buddy-info-description')!.textContent = BUDDIES[kind].description;
      const dialog = document.querySelector<HTMLDialogElement>('#buddy-info')!; if (!dialog.open) dialog.showModal();
    });
    this.avatar = this.makeAvatar(true);
    this.controls.attach(this.game.canvas);
    this.setupRoomTools();
    this.setupReactions();
    this.announcementsUI = new AnnouncementsUI(this.inputController.signal, (action) => this.connection?.announcement(action) ?? false, () => { this.controls.clear(); this.setEditMode('none'); });
    this.vehicleUI = new TransportUI(this.inputController.signal, (kind, id) => this.connection?.vehicle(kind, id) ?? false, () => { this.controls.clear(); this.setEditMode('none'); });
    this.vehicleDocks = new VehicleDocksView(this, () => { if (this.editMode === 'none') this.vehicleUI?.open(); });
    this.linksUI = new ObjectLinksEditor({ signal: this.inputController.signal, owner: () => this.owner(),
      resolve: (id) => objectTargets(this.roomId, this.objects).find((o) => o.id === id),
      send: (edit) => this.connection?.editLinks(edit), open: () => this.controls.clear() });
    this.directoryUI = new PeopleDirectory({ signal: this.inputController.signal,
      open: () => this.controls.clear(),
      warp: (id) => { this.controls.clear(); this.setEditMode('none'); return this.connection?.warpTo(id) ?? false; },
    });
    document.querySelector('#participants')?.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>('[data-dm-player]');
      if (target) this.openSlackDM(target.dataset.dmPlayer!);
    }, { signal: this.inputController.signal });
    this.voice = new ProximityVoice({
      sendState: (state) => this.connection?.setVoice(state),
      sendSignal: (to, session, payload) => this.connection?.signalVoice(to, session, payload),
      notify: (state) => this.renderVoice(state),
    });
    document.querySelector('#voice-toggle')?.addEventListener('click', () => {
      if (document.querySelector('#voice-toggle')?.getAttribute('aria-pressed') === 'true') this.voice?.stop();
      else void this.voice?.start();
    }, { signal: this.inputController.signal });
    document.querySelector('#mic-toggle')?.addEventListener('click', () => { void this.voice?.toggleMicrophone(); }, { signal: this.inputController.signal });
    document.querySelector('#reset-position')?.addEventListener('click', () => {
      this.controls.clear();
      this.connection?.reset();
      this.game.canvas.focus({ preventScroll: true });
    }, { signal: this.inputController.signal });
    document.addEventListener('walk-step', ((event: CustomEvent<Direction>) => {
      if (!this.walker.moving) this.connection?.move(event.detail);
    }) as EventListener, { signal: this.inputController.signal });

    if (!this.loginRequired) this.connection = new OfficeConnection({
      state: (state) => this.setConnectionState(state),
      welcome: (id, players) => {
        this.clearPeers();
        this.players.clear();
        this.localId = id; this.arcadeUI?.setIdentity(id);
        this.showRoom(players.find((p) => p.id === id)?.roomId ?? 'office');
        for (const player of players) this.receivePlayer(player, true);
      },
      arcadeState: (state) => { if (this.roomId === 'arcade') this.arcadeUI?.receive(state); },
      arcadeResult: (result) => this.arcadeUI?.result(result.actionId, result.error),
      robotState: (state) => { if (this.roomId === 'cockpit') { this.cockpitUI?.receive(state); this.cockpitView?.receive(state); } },
      robotResult: (result) => this.cockpitUI?.result(result.actionId, result.error),
      dailyEvent: (state) => { this.dailyUI?.receive(state); this.dailyView?.receive(state); this.skyWindow?.setDailyEvent(state); },
      announcements: (state) => { this.announcementsUI?.snapshot(state); this.dailyUI?.receiveSchedules(state); },
      announcementResult: (id, error) => this.announcementsUI?.result(id, error),
      vehicles: (units) => { this.vehicleUI?.inventory(units); this.vehicleDocks?.receive(units); },
      vehicleResult: (id, error) => this.vehicleUI?.result(id, error),
      pets: (roomId, pets) => this.companions?.pets(roomId, pets),
      player: (player, snap, reason) => this.receivePlayer(player, snap, reason),
      reaction: (message) => {
        if (message.roomId !== this.roomId || this.players.get(message.playerId)?.roomId !== this.roomId) return;
        this.reactions.set(message.playerId, { kind: message.kind, startedAt: performance.now() });
        this.participantsDirty = true;
        if (message.playerId === this.localId) {
          this.nextReactionAt = performance.now() + REACTION_COOLDOWN_MS;
          document.querySelector('#reaction-status')!.textContent = `${REACTIONS[message.kind].label}をみんなに伝えました。`;
          this.updateReactionTools();
        }
      },
      left: (id) => this.removePlayer(id),
      directory: (people, warning) => this.directoryUI?.setPeople(people, warning),
      travelComplete: () => this.directoryUI?.complete(),
      travelError: (error) => this.directoryUI?.fail(error),
      objects: (roomId, objects) => {
        if (roomId !== this.roomId) return;
        this.objects = objects; this.lostItems?.setObjects(objects); this.dailyView?.setObjects(objects); this.seats = seatSpots(roomId, objects); this.participantsDirty = true; this.lighting?.setObjects(objects); this.objectsReady = true; this.drawObjects(); this.updateObjectTools();
        this.linksUI?.refreshTarget(); this.linksUI?.setReady(this.connected);
      },
      objectLinks: (snapshot) => { if (snapshot.roomId === this.roomId) { this.linksUI?.snapshot(snapshot); this.linksUI?.setReady(this.connected && this.objectsReady); } },
      linkResult: (result) => this.linksUI?.result(result),
      objectResult: (editId, error) => {
        if (editId !== this.pendingEdit) return;
        this.pendingEdit = undefined;
        this.objectStatus(error ?? '家具・小物を保存しました。');
        if (!error) this.selectedObject = undefined;
        this.ghost?.destroy(); this.ghost = undefined;
        this.updateObjectTools();
      },
      voice: (snapshot) => this.voice?.accept(snapshot),
      voiceSignal: (signal) => this.voice?.signal(signal),
    });
    this.sendProfile();
    if (this.loginRequired) {
      document.querySelector('#connection-message')!.textContent = 'Slackでログインすると入室できます。';
      document.querySelector('#connection-label')!.textContent = 'ログインを待っています';
    }
    const cleanup = () => {
      this.controls.destroy();
      this.inputController.abort();
      this.voice?.destroy();
      this.connection?.destroy();
      this.companions?.clear();
      this.lighting?.destroy();
      this.vehicleDocks?.destroy(); this.vehicleUI?.destroy(); this.announcementsUI?.destroy(); this.dailyUI?.destroy(); this.arcadeUI?.destroy(); this.cockpitUI?.destroy(); this.cockpitView?.destroy(); this.dailyView?.destroy(); this.lostItems?.destroy();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.game.canvas.focus({ preventScroll: true });
    this.game.canvas.parentElement?.querySelector('.loading')?.remove();
    this.update(0, 0);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connected = state === 'online';
    this.announcementsUI?.setConnected(this.connected); this.dailyUI?.setConnected(this.connected); this.cockpitUI?.setConnected(this.connected); this.arcadeUI?.setConnected(this.connected);
    this.vehicleUI?.setConnected(this.connected);
    this.voice?.setConnected(this.connected);
    this.linksUI?.setReady(this.connected && this.objectsReady);
    if (!this.connected) {
      this.reactions.clear(); this.nextReactionAt = 0;
      this.controls.clear();
      this.clearPeers();
      this.players.clear();
      this.companions?.clear();
      this.localId = undefined;
      this.objectsReady = false;
      this.setEditMode('none');
      if (this.selectedPlayer) this.renderSlackTarget();
    }
    const messages = {
      connecting: 'オフィスに接続しています…',
      online: '同じURLを開いて、いっしょに歩こう。',
      reconnecting: '接続が切れました。もう一度つないでいます…',
    };
    document.querySelector('#connection-message')!.textContent = messages[state];
    document.querySelector('#connection-label')!.textContent = this.connected ? 'みんなと接続中' : state === 'connecting' ? '接続しています' : '再接続しています';
    document.querySelector('#app')!.setAttribute('data-connection', state);
    document.querySelector('#profile-presence')!.textContent = this.connected ? 'オフィスにいます' : '接続を待っています';
    (document.querySelector('#reset-position') as HTMLButtonElement).disabled = !this.connected;
    this.renderParticipants();
    this.directoryUI?.setConnection(this.connected, this.localId);
    this.updateObjectTools();
    this.updateReactionTools();
    if (this.connected) document.querySelector('#reaction-status')!.textContent = 'ボタンやマップ操作中の1〜4キーで、気持ちを伝えよう。歩くと動作が終わります。';
  }

  private renderVoice(state: VoiceUI): void {
    this.speaking = state.speakers;
    const join = document.querySelector<HTMLButtonElement>('#voice-toggle')!;
    const mic = document.querySelector<HTMLButtonElement>('#mic-toggle')!;
    join.textContent = state.active ? '音声を終了' : state.busy ? '準備しています…' : '音声に参加';
    join.setAttribute('aria-pressed', String(state.active));
    join.disabled = !this.connected || (state.busy && !state.active);
    mic.textContent = state.microphone ? 'マイクをOFF' : 'マイクをON';
    mic.setAttribute('aria-pressed', String(state.microphone));
    mic.disabled = !state.active || state.busy;
    const status = document.querySelector('#voice-status')!;
    if (status.textContent !== state.message) status.textContent = state.message;
    document.querySelector('#voice-nearby')!.textContent = state.active ? `近くに${state.nearby}人 · ${state.connected}人と接続中` : '初期状態はマイクOFFです。';
    document.querySelector('#voice-controls')!.setAttribute('data-microphone', String(state.microphone));
    for (const item of document.querySelectorAll<HTMLElement>('[data-player-id]')) {
      item.dataset.speaking = String(this.speaking.has(item.dataset.playerId!));
    }
  }

  private clearPeers(): void {
    for (const { view } of this.peers.values()) this.destroyView(view);
    this.peers.clear();
  }

  private destroyView(view: AvatarView): void {
    view.sprite.destroy(); view.vehicle.destroy(); view.shadow.destroy(); view.label.destroy(); view.reactionLabel.destroy(); view.sparkles.destroy();
  }

  private receivePlayer(player: Player, snap: boolean, reason?: string): void {
    const previous = this.players.get(player.id);
    if (previous && (snap || previous.x !== player.x || previous.y !== player.y || previous.roomId !== player.roomId)) this.reactions.delete(player.id);
    this.players.set(player.id, player);
    if (player.id === this.localId) {
      if (reason === 'vending' && player.appearance) {
        this.appearance = { ...player.appearance };
        this.appearancePickup?.(this.appearance);
        document.querySelector('#office-notice')!.textContent = '自販機でペットボトルを受け取りました。ひと息つこう。';
      }
      if (player.roomId !== this.roomId) this.showRoom(player.roomId);
      if (player.slackVerified) {
        this.playerName = player.name;
        this.slack = player.slack ?? null;
        document.querySelector('#profile-name')!.textContent = player.name;
      }
      this.walker.setStepMs(movementStep(player.riding?.kind));
      this.walker.receive(player, player.facing, snap);
      this.vehicleUI?.setPlayer(player);
    } else if (player.roomId !== this.roomId) {
      const peer = this.peers.get(player.id);
      if (peer) this.destroyView(peer.view);
      this.peers.delete(player.id);
    } else {
      let peer = this.peers.get(player.id);
      if (!peer) {
        peer = { player, walker: new Walker(), view: this.makeAvatar(false) };
        peer.view.sprite.setInteractive({ useHandCursor: true })
          .on('pointerup', () => { if (this.editMode === 'none') this.openSlackDM(player.id); });
        peer.view.vehicle.setInteractive({ useHandCursor: true }).on('pointerup', () => { if (this.editMode === 'none') this.openSlackDM(player.id); });
        peer.view.label.setInteractive({ useHandCursor: true })
          .on('pointerup', () => { if (this.editMode === 'none') this.openSlackDM(player.id); });
        this.peers.set(player.id, peer);
        snap = true;
      }
      peer.player = player;
      peer.walker.setStepMs(movementStep(player.riding?.kind));
      peer.walker.receive(player, player.facing, snap);
    }
    this.companions?.player(player, snap);
    this.participantsDirty = true;
    this.voice?.setWorld(this.localId, this.players, player.id);
    if (this.selectedPlayer === player.id) this.renderSlackTarget();
  }

  private removePlayer(id: string): void {
    this.companions?.remove(id);
    this.reactions.delete(id);
    const peer = this.peers.get(id);
    if (peer) this.destroyView(peer.view);
    this.peers.delete(id);
    this.players.delete(id);
    this.voice?.setWorld(this.localId, this.players, id);
    this.renderParticipants();
    if (this.selectedPlayer === id) this.renderSlackTarget();
  }

  private renderParticipants(): void {
    const list = document.querySelector('#participants')!;
    // Preserve keyboard focus while positions, names, or Slack settings change.
    const existing = new Map([...list.children].map((element) => [(element as HTMLElement).dataset.playerId, element as HTMLElement]));
    for (const [id, item] of existing) if (!id || this.players.get(id)?.roomId !== this.roomId) item.remove();
    for (const player of this.players.values()) {
      if (player.roomId !== this.roomId) continue;
      let item = existing.get(player.id);
      if (!item) {
        item = document.createElement('li');
        const name = document.createElement(player.id === this.localId ? 'strong' : 'button');
        name.className = 'participant-name';
        if (name instanceof HTMLButtonElement) {
          name.type = 'button';
          name.dataset.dmPlayer = player.id;
        }
        const location = document.createElement('span');
        const slackStatus = document.createElement('span');
        slackStatus.className = 'participant-slack';
        const reaction = document.createElement('span'); reaction.className = 'participant-reaction';
        const vehicle = document.createElement('span'); vehicle.className = 'participant-vehicle';
        const seat = document.createElement('span'); seat.className = 'participant-seat';
        item.append(name, location, slackStatus, reaction, vehicle, seat);
        list.append(item);
      }
      item.dataset.playerId = player.id;
      item.dataset.tileX = String(player.x);
      item.dataset.tileY = String(player.y);
      item.dataset.buddy = player.buddy ?? '';
      item.dataset.buddyPosition = JSON.stringify(player.buddyPosition ?? null);
      item.dataset.riding = player.riding?.kind ?? '';
      item.children[4].textContent = player.riding ? `${VEHICLES[player.riding.kind].icon} ${VEHICLES[player.riding.kind].name}で移動中` : '';
      const seatId = player.id === this.localId ? this.avatar.seatId : this.peers.get(player.id)?.view.seatId;
      item.dataset.seatId = seatId ?? '';
      item.children[5].textContent = seatId ? '着席中' : '';
      item.dataset.walkStyle = String(player.appearance?.walkStyle ?? 0);
      item.dataset.heldItem = String(player.appearance?.heldItem ?? 0);
      item.dataset.outfit = String(player.outfit);
      item.dataset.roomId = player.roomId;
      item.dataset.speaking = String(this.speaking.has(player.id));
      const name = item.children[0];
      name.textContent = player.name + (player.id === this.localId ? '（あなた）' : '');
      if (player.id !== this.localId) name.setAttribute('aria-label', `${player.name}さんのSlack DMを開く`);
      item.children[1].textContent = areaAt(player);
      item.children[2].textContent = player.slackVerified ? 'Slackログイン済み' : player.slack ? 'Slack手動設定' : 'Slack未設定';
      const reaction = this.reactions.get(player.id);
      item.dataset.reaction = reaction?.kind ?? '';
      item.children[3].textContent = reaction ? `${REACTIONS[reaction.kind].icon} ${REACTIONS[reaction.kind].label}` : '';
    }
    document.querySelectorAll('[data-player-count]').forEach((element) => {
      const text = this.connected ? `${this.players.size}人が滞在中` : '接続を待っています';
      if (element.textContent !== text) element.textContent = text;
    });
    const localCount = [...this.players.values()].filter((p) => p.roomId === this.roomId).length;
    document.querySelectorAll('[data-room-count]').forEach((node) => { node.textContent = `${localCount}人がこの部屋にいます`; });
    for (const room of ROOMS) {
      const count = [...this.players.values()].filter((p) => p.roomId === room.id).length;
      const label = document.querySelector(`[data-room-occupancy="${room.id}"]`);
      if (label) label.textContent = `${count}人${room.id === this.roomId ? ' · いまここ' : ''}`;
    }
  }

  setName(name: string): void {
    this.playerName = name.trim() || 'あなた';
    this.sendProfile();
  }

  setOutfit(color: number): void {
    this.setAppearance({ ...this.appearance, color });
  }

  onAppearancePickup(handler: (appearance: Appearance) => void): void { this.appearancePickup = handler; }

  setAppearance(appearance: Appearance): void { this.appearance = { ...appearance }; this.outfit = Math.min(appearance.color, 2); this.sendProfile(); }

  setBuddy(kind: BuddyKind | null): void { this.buddyChoice = kind; this.sendProfile(); }

  setSlack(slack: SlackIdentity | null): void { this.slack = slack; this.sendProfile(); }

  private sendProfile(): void {
    this.connection?.setProfile({ name: this.playerName, outfit: this.outfit, appearance: this.appearance, slack: this.slack, buddy: this.buddyChoice });
  }

  private openSlackDM(id: string): void {
    this.controls.clear();
    this.selectedPlayer = id;
    this.renderSlackTarget();
    document.querySelector('#slack-target')?.scrollIntoView({ block: 'nearest' });
    const player = this.players.get(id);
    if (!this.connected || !player || id === this.localId) return;
    if (!activateSlackDM(player.slack, (url) => window.location.assign(url)) && slackDMUrl(player.slack)) {
      document.querySelector('#slack-target-message')!.textContent = 'Slackアプリを開けませんでした。インストール状態を確認し、下のリンクからもう一度お試しください。';
    }
  }

  private renderSlackTarget(): void {
    const card = document.querySelector<HTMLElement>('#slack-target')!;
    card.hidden = false;
    const selected = this.selectedPlayer ? this.players.get(this.selectedPlayer) : undefined;
    const player = selected?.roomId === this.roomId ? selected : undefined;
    const link = document.querySelector<HTMLAnchorElement>('#slack-dm-link')!;
    const url = player && this.connected ? slackDMUrl(player.slack) : undefined;
    document.querySelector('#slack-target-name')!.textContent = player ? `${player.name}さんのSlack DM` : '相手はオフィスにいません';
    const message = !this.connected ? 'オフィスへの接続が切れています。再接続後に相手を選び直してください。'
      : !player ? '相手が退出しました。Slackのリンクを解除しました。'
      : url ? 'SlackアプリでDMを開きます。開かなかった場合は、下のリンクからもう一度開けます。'
      : '相手のSlackが未設定です。相手にワークスペースIDとメンバーIDの設定をお願いしてください。';
    document.querySelector('#slack-target-message')!.textContent = message;
    document.querySelector('#slack-target-ids')!.textContent = url && player?.slack ? `${player.slack.teamId} / ${player.slack.userId}` : '';
    if (url) { link.href = url; link.hidden = false; }
    else { link.removeAttribute('href'); link.hidden = true; }
  }

  private openRoomPicker(): void {
    this.controls.clear();
    const dialog = document.querySelector<HTMLDialogElement>('#room-dialog')!;
    if (!dialog.open) dialog.showModal();
  }

  private showRoom(id: RoomId): void {
    this.reactions.clear();
    this.roomId = id; this.arcadeUI?.setRoom(id); this.cockpitUI?.setRoom(id); this.cockpitView?.setRoom(id);
    this.companions?.setRoom(id);
    this.lighting?.setRoom(id);
    this.vehicleDocks?.setRoom(id);
    this.skyWindow?.setRoom(id); this.dailyView?.setRoom(id); this.dailyUI?.setRoom(id);
    this.game.canvas.dataset.roomPets = '[]';
    this.frontBoard = undefined; this.linksUI?.reset();
    this.atDoor = false;
    this.lastArea = '';
    this.clearPeers();
    this.setEditMode('none');
    this.lostItems?.setRoom(id); document.querySelector('#office-notice')!.textContent = '';
    this.seats.clear(); this.objects = []; this.objectsReady = false; this.pendingEdit = undefined;
    for (const view of [...this.mapViews, ...this.objectViews]) view.destroy();
    this.objectViews = [];
    this.mapViews = drawOffice(this, id, () => { if (this.editMode === 'none') this.dailyUI?.openCalendar(); }, (game) => { if (this.editMode === 'none') this.arcadeUI?.open(game); });
    const room = getRoom(id);
    this.game.canvas.setAttribute('aria-label', `${room.name}。矢印キーまたはWASDで移動。Tabキーでマップから移動できます。`);
    document.querySelectorAll('[data-room-name]').forEach((node) => { node.textContent = room.name; });
    document.querySelector('#room-description')!.textContent = room.description;
    document.querySelector('#robot-location')!.textContent = `WAIWAI-01 / ${robotLocation(id)}`;
    document.querySelector('#map-title')!.textContent = `${room.name}へ、ようこそ。`;
    document.querySelector('#room-number')!.textContent = String(ROOMS.indexOf(room) + 1).padStart(2, '0');
    document.querySelector('.map-legend')!.textContent = id === 'arcade' ? '8台の筐体で、対戦・協力・リズム遊び。ひとりでも気軽にどうぞ。' : id === 'cockpit' ? '操縦パネルでシミュレーターへ。機体の部位から、各部屋へ移動できます。' : `${room.description} 近づいて会話。人をクリックしてSlackへ、家具をクリックしてリンクへ。`;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-room]')) button.disabled = button.dataset.room === id;
    // Other-room roster entries are kept for occupancy, but avatars stay local.
    for (const player of this.players.values()) if (player.id !== this.localId && player.roomId === id) this.receivePlayer(player, true);
    if (this.selectedPlayer) this.renderSlackTarget();
    this.updateObjectTools();
  }

  private setupRoomTools(): void {
    const signal = this.inputController.signal;
    document.querySelector('#room-picker-open')!.addEventListener('click', () => this.openRoomPicker(), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-room]')) button.addEventListener('click', () => {
      if (!this.connected) return;
      this.controls.clear();
      this.connection?.changeRoom(button.dataset.room as RoomId);
      document.querySelector<HTMLDialogElement>('#room-dialog')!.close();
    }, { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-object-mode]')) button.addEventListener('click', () => {
      this.setEditMode(button.dataset.objectMode as typeof this.editMode);
    }, { signal });
    document.querySelector<HTMLSelectElement>('#object-kind')!.addEventListener('change', (event) => {
      this.objectKind = (event.target as HTMLSelectElement).value as ObjectKind;
      this.setEditMode('place');
    }, { signal });
    document.querySelector('#object-rotate')!.addEventListener('click', () => { this.objectRotation = (this.objectRotation + 1) % 4; this.updateObjectTools(); }, { signal });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.setEditMode('none'); }, { signal });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => this.previewObject(pointer));
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.editMode === 'none' && over.length) return;
      this.editAt(pointer);
    });
  }

  private setupReactions(): void {
    const signal = this.inputController.signal;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) button.addEventListener('click', () => {
      this.playReaction(button.dataset.reaction as ReactionKind);
    }, { signal });
    this.game.canvas.addEventListener('keydown', (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.code === 'KeyE' && this.editMode === 'none') { event.preventDefault(); this.vehicleUI?.open(); return; }
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(event.code);
      if (index !== -1) { event.preventDefault(); this.playReaction(REACTION_KINDS[index]); }
    }, { signal });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', () => { this.reducedMotion = preference.matches; }, { signal });
    this.updateReactionTools();
  }
  private playReaction(kind: ReactionKind): void {
    if (!this.connected || performance.now() < this.nextReactionAt) return;
    this.controls.clear(); this.setEditMode('none');
    if (!this.connection?.react(kind)) return;
    this.nextReactionAt = performance.now() + REACTION_COOLDOWN_MS;
    document.querySelector('#reaction-status')!.textContent = 'リアクションを伝えています…';
    this.updateReactionTools(); this.game.canvas.focus({ preventScroll: true });
  }
  private updateReactionTools(): void {
    this.reactionBlocked = !this.connected || performance.now() < this.nextReactionAt;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) button.disabled = this.reactionBlocked;
    if (!this.connected) document.querySelector('#reaction-status')!.textContent = 'オフィスへの接続後にリアクションできます。';
  }

  private owner(): string {
    const player = this.localId ? this.players.get(this.localId) : undefined;
    return player?.slackVerified && player.slack ? `slack:${player.slack.teamId}:${player.slack.userId}` : `guest:${this.localId}`;
  }
  private objectStatus(message: string): void { document.querySelector('#object-status')!.textContent = message; }
  private updateObjectTools(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-object-mode]')) {
      button.setAttribute('aria-pressed', String(button.dataset.objectMode === this.editMode));
      button.disabled = button.dataset.objectMode !== 'none' && (!this.connected || !this.objectsReady || !!this.pendingEdit);
    }
    const rotate = document.querySelector<HTMLButtonElement>('#object-rotate')!;
    rotate.textContent = `回転 ${this.objectRotation * 90}°`;
    rotate.disabled = this.editMode === 'none' || this.editMode === 'remove' || !!this.pendingEdit;
    const kind = this.objects.find((o) => o.id === this.selectedObject)?.kind ?? this.objectKind;
    const { w, h } = objectSize(kind, this.objectRotation);
    document.querySelector('#object-dimensions')!.textContent = `${w}×${h}マス · クリック位置が左上`;
    document.querySelector('#object-count')!.textContent = `${this.objects.length} / ${MAX_ROOM_OBJECTS}`;
    this.game.canvas.style.cursor = this.editMode === 'none' ? 'default' : 'crosshair';
  }
  private setEditMode(mode: typeof this.editMode): void {
    this.editMode = mode;
    this.selectedObject = undefined;
    this.ghost?.destroy(); this.ghost = undefined;
    this.controls.clear();
    const hints = { none: '家具のクリックでリンクを開けます。家具・小物を選び、「置く」を押してマップをクリック。配置はみんなに共有されます。',
      place: '置きたい位置の左上のマスをクリック。「回転」で向きを変更。Escでおわります。',
      move: '自分が置いた家具・小物をクリックし、移動先のマスをクリックしてください。', remove: '片づけたい自分の家具・小物をクリックしてください。' };
    this.objectStatus(hints[mode]); this.updateObjectTools();
  }
  private drawObjects(): void {
    for (const view of this.objectViews) view.destroy();
    this.objectViews = this.objects.map((o) => drawRoomObject(this, o));
  }
  private previewObject(pointer: Phaser.Input.Pointer): void {
    this.ghost?.destroy(); this.ghost = undefined;
    if (!this.objectsReady || this.pendingEdit || (this.editMode !== 'place' && !(this.editMode === 'move' && this.selectedObject))) return;
    const selected = this.objects.find((o) => o.id === this.selectedObject);
    const object: RoomObject = { id: selected?.id ?? 'preview', owner: this.owner(), roomId: this.roomId,
      kind: selected?.kind ?? this.objectKind, x: Math.floor(pointer.x / TILE), y: Math.floor(pointer.y / TILE), rotation: this.objectRotation };
    const error = placementProblem(object, this.objects, [...this.players.values()]);
    this.ghost = drawRoomObject(this, object).setAlpha(error ? 0.25 : 0.65).setDepth(2000);
    const { w, h } = objectSize(object.kind);
    this.ghost.lineStyle(1, error ? 0xb96551 : 0xfff3bc).strokeRect(-w * TILE / 2, -h * TILE / 2, w * TILE, h * TILE);
  }
  private editAt(pointer: Phaser.Input.Pointer): void {
    const x = Math.floor(pointer.x / TILE), y = Math.floor(pointer.y / TILE);
    if (this.editMode === 'none') {
      const door = getRoom(this.roomId).door;
      if (x === door.x && y === door.y) this.openRoomPicker();
      else if (this.connected && this.objectsReady) { const target = targetAt(this.roomId, this.objects, { x, y }); if (target?.kind === 'calendar') this.dailyUI?.openCalendar(); else if (target?.kind === 'arcade' && this.roomId === 'arcade') this.arcadeUI?.open(ARCADE_IDS.find((id) => x >= ARCADE_GAMES[id].x && x < ARCADE_GAMES[id].x + 3 && y >= ARCADE_GAMES[id].y && y < ARCADE_GAMES[id].y + 3)); else if (target && this.roomId === 'cockpit' && (ROBOT_CONSOLE_KINDS as readonly string[]).includes(target.kind)) this.cockpitUI?.open(); else if (target) this.linksUI?.open(target); }
      return;
    }
    if (!this.connected || !this.objectsReady || this.pendingEdit) return;
    const target = this.objects.find((o) => objectContains(o, x, y));
    const editId = crypto.randomUUID();
    if (this.editMode === 'remove' || (this.editMode === 'move' && !this.selectedObject)) {
      if (!target || target.owner !== this.owner()) { this.objectStatus('自分が置いた家具・小物を選んでください。'); return; }
      if (this.editMode === 'move') {
        this.selectedObject = target.id; this.objectRotation = target.rotation;
        this.objectKind = target.kind;
        document.querySelector<HTMLSelectElement>('#object-kind')!.value = target.kind;
        this.updateObjectTools();
        this.objectStatus(`${OBJECT_CATALOG[target.kind].name}の移動先をクリック。「回転」で向きを変えられます。`); return;
      }
      this.connection?.editObject({ type: 'object-remove', id: target.id, editId });
    } else {
      const selected = this.objects.find((o) => o.id === this.selectedObject);
      const candidate: RoomObject = { id: selected?.id ?? 'preview', owner: this.owner(), roomId: this.roomId, kind: selected?.kind ?? this.objectKind, x, y, rotation: this.objectRotation };
      const error = placementProblem(candidate, this.objects, [...this.players.values()]);
      if (error) { this.objectStatus(error); return; }
      if (selected) this.connection?.editObject({ type: 'object-move', id: selected.id, x, y, rotation: this.objectRotation, editId });
      else this.connection?.editObject({ type: 'object-place', kind: this.objectKind, x, y, rotation: this.objectRotation, editId });
    }
    this.pendingEdit = editId; this.ghost?.destroy(); this.ghost = undefined;
    this.objectStatus('家具・小物を保存しています…'); this.updateObjectTools();
  }

  private drawAvatar(view: AvatarView, walker: Walker, appearance: Appearance, name: string, time: number, id?: string): void {
    let { x, y } = walker.position();
    const reaction = id ? this.reactions.get(id) : undefined;
    const motion = reaction ? reactionMotion(reaction.kind, performance.now() - reaction.startedAt, this.reducedMotion) : undefined;
    if (reaction && !motion) { this.reactions.delete(id!); this.participantsDirty = true; }
    const riding = id ? this.players.get(id)?.riding : undefined;
    const seat = this.connected && this.objectsReady ? restingSeat(this.seats, walker.tile, walker.moving, !!riding, !!motion) : undefined;
    if (view.seatId !== seat?.id) { view.seatId = seat?.id; this.participantsDirty = true; }
    if (seat) { x = seat.anchor.x; y = seat.anchor.y; }
    const walk = walkingMotion(appearance.walkStyle, time, walker.facing, walker.moving && !motion && !riding && !seat, this.reducedMotion);
    const lift = (motion?.lift ?? walk.lift) + (riding?.kind === 'bike' ? 4 : 0);
    const frame = riding && walker.moving && !motion ? 1 + Math.floor(time / 95) % 2 : walk.frame;
    view.sprite.setPosition(Math.round(x + walk.offsetX), Math.round(y + 6 - lift)).setRotation(motion?.tilt ?? walk.tilt).setScale(walk.scaleX, motion?.scaleY ?? walk.scaleY)
      .setTexture(avatarTexture(this, appearance, motion ? 'down' : seat?.facing ?? walker.facing, frame, motion?.pose ?? (seat ? 'sit' : 'stand'))).setDepth(seat?.depth ?? y + 7);
    view.vehicle.setVisible(!!riding);
    if (riding) view.vehicle.setTexture(vehicleTexture(this, riding.kind, walker.facing, frame)).setPosition(Math.round(x), Math.round(y + 10 - (motion?.lift ?? 0))).setDepth(y + 6.5);
    view.shadow.setPosition(Math.round(x), Math.round(y) + 5).setScale(motion?.shadow ?? walk.shadow, 1).setDepth(y + 6);
    view.label.setText(name).setPosition(Math.round(x), Math.round(y - 20 - lift)).setDepth(ROWS * TILE + 20);
    view.reactionLabel.setVisible(!!motion);
    if (motion && reaction) view.reactionLabel.setText(REACTIONS[reaction.kind].text)
      .setPosition(Math.round(x), Math.max(14, Math.round(y - 35 - lift))).setDepth(ROWS * TILE + 21);
    view.sparkles.clear().setPosition(x, y - lift).setDepth(y + 8);
    if (motion?.sparkle) {
      view.sparkles.lineStyle(1, 0xf1cf7b, motion.sparkle);
      for (const [dx, dy] of [[-13, -23], [14, -30], [-8, -37]]) {
        view.sparkles.lineBetween(dx - 2, dy, dx + 2, dy); view.sparkles.lineBetween(dx, dy - 2, dx, dy + 2);
      }
    }
    if (id === this.localId) {
      this.game.canvas.dataset.walkStyle = String(appearance.walkStyle);
      this.game.canvas.dataset.walkFrame = String(walk.frame);
      this.game.canvas.dataset.walkLift = String(walk.lift);
      this.game.canvas.dataset.localReaction = motion && reaction ? reaction.kind : '';
      this.game.canvas.dataset.seatId = seat?.id ?? '';
      this.game.canvas.dataset.seatFacing = seat?.facing ?? '';
      const status = document.querySelector('#seating-status')!;
      const text = seat ? `${seat.name}に着席中 · 移動すると立ち上がります。` : '椅子・机・ソファの正面で止まると、自動で座ります。';
      if (status.textContent !== text) status.textContent = text;
    }
  }

  update(time: number, delta: number): void {
    const now = Date.now();
    this.lostItems?.update(now); this.dailyView?.update(now, this.reducedMotion);
    this.lighting?.update(now); this.cockpitView?.update(now, this.reducedMotion);
    this.skyWindow?.update(now, this.reducedMotion);
    if (this.reactionBlocked !== (!this.connected || performance.now() < this.nextReactionAt)) this.updateReactionTools();
    if (this.participantsDirty && time - this.lastParticipantsAt >= 100) {
      this.participantsDirty = false;
      this.lastParticipantsAt = time;
      this.renderParticipants();
    }
    this.companions?.update(time, delta, this.reducedMotion);
    this.walker.update(delta);
    if (this.editMode === 'none' && !this.walker.moving && this.connection?.readyToMove) {
      const direction = this.controls.direction();
      if (direction) { if (this.localId) this.reactions.delete(this.localId); this.connection.move(direction); }
    }
    this.drawAvatar(this.avatar, this.walker, this.appearance, this.playerName, time, this.localId);
    this.avatar.sprite.setAlpha(this.connected ? 1 : 0.45);
    for (const peer of this.peers.values()) {
      peer.walker.update(delta);
      this.drawAvatar(peer.view, peer.walker, parseAppearance(peer.player.appearance, peer.player.outfit)!, peer.player.name + (this.speaking.has(peer.player.id) ? ' ♪' : ''), time, peer.player.id);
    }
    const area = areaAt({ ...this.walker.tile, roomId: this.roomId });
    if (area !== this.lastArea) {
      this.lastArea = area;
      document.querySelectorAll('[data-current-area]').forEach((element) => { element.textContent = area; });
    }
    const door = getRoom(this.roomId).door;
    const atDoor = this.walker.tile.x === door.x && this.walker.tile.y === door.y;
    if (atDoor && !this.atDoor && this.connected && this.editMode === 'none') this.openRoomPicker();
    this.atDoor = atDoor;
    const board = boardInFront(this.roomId, this.walker.tile);
    if (!board) this.frontBoard = undefined;
    else if (board.id !== this.frontBoard && this.connected && this.editMode === 'none' && !this.walker.moving &&
      !document.querySelector('dialog[open]') && this.linksUI?.hasLinks(board.id)) {
      this.frontBoard = board.id; this.linksUI.open(board);
    }
    this.game.canvas.dataset.roomId = this.roomId;
    this.game.canvas.dataset.roomObjects = String(this.objects.length);
    this.game.canvas.dataset.tileX = String(this.walker.tile.x);
    this.game.canvas.dataset.tileY = String(this.walker.tile.y);
    this.game.canvas.dataset.riding = this.localId ? this.players.get(this.localId)?.riding?.kind ?? '' : '';
    this.game.canvas.dataset.connectedPlayers = String(this.players.size);
  }
}

export function startOffice(parent: HTMLElement, slack: SlackIdentity | null = null, loginRequired = false): { game: Phaser.Game; scene: OfficeScene } {
  const scene = new OfficeScene(slack, loginRequired);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: COLS * TILE, height: ROWS * TILE,
    backgroundColor: '#ead3a5', pixelArt: true, roundPixels: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], input: { keyboard: false }, audio: { noAudio: true },
  });
  return { game, scene };
}
