import { isMapTap, mapTap } from './map-tap.ts';
import { laptopThrowMotion } from './laptop-throw.ts';
import { AdminUI } from './admin-ui.ts';
import { DummyAvatarsUI } from './dummy-avatars-ui.ts';
import { FocusUI } from './focus-ui.ts';
import { ClickTravel } from './click-travel.ts';
import { SpeechBubbles } from './speech-bubbles.ts';
import { SpeechBubblesView } from './speech-bubbles-view.ts';
import { defaultWorldPolicy, policyAllows } from './world-policy.ts';
import type { WorldPolicy } from './world-policy.ts';
import { ART_WIDTH, ART_HEIGHT, configureArtCamera } from './art-resolution.ts';
import { ChatUI } from './chat-ui.ts';
import { playerIdentity } from './identity.ts';
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
import { PokemonJournalUI } from './pokemon-journal-ui.ts';
import { BirthdaysUI } from './birthdays-ui.ts';
import { DevWorldUI } from './dev-world-ui.ts';
import { CombatUI } from './combat-ui.ts';
import { SpellsUI } from './spells-ui.ts';
import { SpellsView } from './spells-view.ts';
import { DASH_MS } from './dash.ts';
import { isPokemonKind } from './pokemon-journal.ts';
import { BUDDIES } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
import Phaser from 'phaser';
import { avatarTexture, laptopTexture, createAvatarTextures, drawOffice, drawRoomObject } from './art.ts';
import { Controls } from './controls.ts';
import { Walker, areaAt, ROWS, TILE } from './world.ts';
import type { Direction, Furniture, Point } from './world.ts';
import { OfficeConnection } from '../network/OfficeConnection.ts';
import type { ConnectionState } from '../network/OfficeConnection.ts';
import type { Player } from '../network/protocol.ts';
import { ProximityVoice } from '../audio/ProximityVoice.ts';
import type { VoiceUI } from '../audio/ProximityVoice.ts';
import type { SlackIdentity } from '../slack/dm.ts';
import { DEFAULT_APPEARANCE, parseAppearance } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import { ROOMS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { MAX_ROOM_OBJECTS, OBJECT_CATALOG, objectContains, objectSize, placementProblem, walkableWithObjects } from './objects.ts';
import type { IceSnapshot } from './arena.ts';
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
  laptop: Phaser.GameObjects.Image;
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
  private pokemonJournal?: PokemonJournalUI;
  private birthdaysUI?: BirthdaysUI;
  private devWorldUI?: DevWorldUI;
  private adminUI?: AdminUI;
  private dummyUI?: DummyAvatarsUI;
  private worldPolicy: WorldPolicy = defaultWorldPolicy();
  getWorldPolicy(): WorldPolicy { return this.worldPolicy; }
  private spellsUI?: SpellsUI;
  private combatUI?: CombatUI;
  private spellsView?: SpellsView;
  private buddyChoice: BuddyKind | null = null;
  readonly walker = new Walker();
  private clickTravel = new ClickTravel();
  private clickTimer?: ReturnType<typeof setTimeout>;
  private lastClick?: { x: number; y: number; time: number; origin: Point };
  private mouseMovement = false;
  private travelIce?: IceSnapshot;
  private travelIceOffset = 0;
  private destinationMarker?: Phaser.GameObjects.Graphics;
  private focusUI?: FocusUI;
  private controls = new Controls(() => { this.clickTravel.clear(); clearTimeout(this.clickTimer); this.lastClick = undefined; });
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
  private chatUI?: ChatUI;
  private speech = new SpeechBubbles();
  private speechView?: SpeechBubblesView;
  private directoryUI?: PeopleDirectory;
  private linksUI?: ObjectLinksEditor;
  private frontBoard?: string;
  private reactions = new Map<string, { kind: ReactionKind; startedAt: number }>();
  private nextReactionAt = 0;
  private reactionBlocked = true;
  private restPending = false;
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
    const laptop = this.add.image(0, 0, laptopTexture(this)).setVisible(false);
    return { sprite, vehicle, laptop, shadow, label, reactionLabel, sparkles };
  }

  create(): void {
    configureArtCamera(this);
    this.mapViews = drawOffice(this, this.roomId, () => { if (this.editMode === 'none') this.dailyUI?.openCalendar(); }, (game) => { if (this.editMode === 'none') this.arcadeUI?.open(game); }, (item) => this.openBoard(item));
    this.lostItems = new LostItemsView(this, this.inputController.signal, (item) => {
      if (this.editMode !== 'none' || document.querySelector('dialog[open]:not(.chat-docked)')) return;
      this.controls.clear();
      const entry = LOST_ITEM_CATALOG[item.kind];
      document.querySelector('#lost-item-title')!.textContent = entry.name;
      document.querySelector('#lost-item-description')!.textContent = entry.note;
      document.querySelector<HTMLDialogElement>('#lost-item-info')!.showModal();
    });
    document.querySelector('#lost-item-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#lost-item-info')!.close(), { signal: this.inputController.signal });
    this.dailyUI = new DailyEventsUI(this.inputController.signal, (room) => this.connection?.changeRoom(room), () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false;
      this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.dailyView = new DailyEventsView(this, () => { if (this.editMode === 'none') this.dailyUI?.inspect(); });
    this.dailyView.setDecorations(this.mapViews);
    this.cockpitUI = new CockpitUI(this.inputController.signal, (action, id) => this.connection?.robot(action, id) ?? false, (room) => this.connection?.changeRoom(room), () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.cockpitView = new CockpitView(this);
    this.arcadeUI = new ArcadeUI(this.inputController.signal, (action) => this.connection?.arcade(action) ?? false, () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.lighting = new RoomLighting(this);
    this.skyWindow = new SkyWindowView(document.querySelector<HTMLCanvasElement>('#sky-window')!);
    createAvatarTextures(this);
    this.pokemonJournal = new PokemonJournalUI(this.inputController.signal, () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false;
      this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.companions = new CompanionsView(this, (kind, owner) => {
      if (this.editMode !== 'none') return;
      if (isPokemonKind(kind)) { this.pokemonJournal?.inspect(kind, this.roomId); return; }
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
    this.adminUI = new AdminUI(this.inputController.signal, action => this.connection?.setPolicy(action) ?? false, () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.spellsView = new SpellsView(this);
    this.dummyUI = new DummyAvatarsUI(this.inputController.signal, action => this.connection?.controlDummies(action) ?? false, () => this.roomId);
    this.combatUI = new CombatUI(this, this.inputController.signal, (action) => this.connection?.arenaAction(action) ?? false);
    this.spellsUI = new SpellsUI(this.inputController.signal, (action) => { this.controls.clear(); this.setEditMode('none'); return this.connection?.castSpell(action) ?? false; }, () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    if (import.meta.env.DEV) this.devWorldUI = new DevWorldUI(this.inputController.signal, (action) => this.connection?.devWorld(action) ?? false, (room) => this.connection?.changeRoom(room), () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.birthdaysUI = new BirthdaysUI(this.inputController.signal, (action) => this.connection?.birthday(action) ?? false, () => {
      if (document.querySelector('dialog[open]:not(.chat-docked)')) return false; this.controls.clear(); this.setEditMode('none'); return true;
    });
    this.announcementsUI = new AnnouncementsUI(this.inputController.signal, (action) => this.connection?.announcement(action) ?? false, () => { this.controls.clear(); this.setEditMode('none'); });
    this.vehicleUI = new TransportUI(this.inputController.signal, (action, id) => this.connection?.vehicle(action, id) ?? false, () => { this.controls.clear(); this.setEditMode('none'); });
    this.vehicleDocks = new VehicleDocksView(this, (unitId) => { if (this.editMode === 'none') this.vehicleUI?.open(unitId); });
    this.linksUI = new ObjectLinksEditor({ signal: this.inputController.signal, owner: () => this.owner(),
      resolve: (id) => objectTargets(this.roomId, this.objects).find((o) => o.id === id),
      send: (edit) => this.connection?.editLinks(edit), open: () => this.controls.clear() });
    this.chatUI = new ChatUI(this.inputController.signal, action => this.connection?.chat(action) ?? false, () => { this.controls.clear(); this.setEditMode('none'); }, id => [...this.players.values()].find(p => playerIdentity(p) === id)?.slack);
    this.focusUI = new FocusUI(this.inputController.signal, this.chatUI, () => this.game.scale.refresh(), () => { this.controls.clear(); this.setEditMode('none'); }, enabled => { this.mouseMovement = enabled; this.controls.clear(); this.setEditMode('none'); });
    this.destinationMarker = this.add.graphics().setDepth(10000);
    this.speechView = new SpeechBubblesView(this, this.speech);
    this.directoryUI = new PeopleDirectory({ signal: this.inputController.signal,
      open: () => this.controls.clear(),
      warp: (id) => { this.controls.clear(); this.setEditMode('none'); return this.connection?.warpTo(id) ?? false; },
    });
    document.querySelector('#participants')?.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>('[data-dm-player]');
      if (target) this.openDirectMessage(target.dataset.dmPlayer!);
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
      if (!this.walker.moving && !this.isResting() && !this.restPending) this.connection?.move(event.detail);
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
      lostItems: (state) => this.lostItems?.receive(state),
      arcadeState: (state) => { if (this.roomId === 'arcade') this.arcadeUI?.receive(state); },
      arcadeResult: (result) => this.arcadeUI?.result(result.actionId, result.error),
      robotState: (state) => { if (this.roomId === 'cockpit') { this.cockpitUI?.receive(state); this.cockpitView?.receive(state); } },
      robotResult: (result) => this.cockpitUI?.result(result.actionId, result.error),
      dailyEvent: (state) => { this.dailyUI?.receive(state); this.dailyView?.receive(state); this.skyWindow?.setDailyEvent(state); },
      announcements: (state) => { this.announcementsUI?.snapshot(state); this.dailyUI?.receiveSchedules(state); this.focusUI?.receive(state); },
      birthdays: (state) => { this.birthdaysUI?.receive(state); this.dailyUI?.receiveBirthdays(state); },
      chat: event => {
        this.chatUI?.receive(event);
        if (event.type === 'chat-message' && this.connected) {
          const now = performance.now(), ids = this.speech.receive(event.message, this.roomId, this.players.values(), now);
          const speech = ids.length ? this.speech.get(ids[0], now) : undefined; if (speech) this.speechView?.announce(speech);
        }
      },
      birthdayThread: (state) => this.birthdaysUI?.receiveThread(state),
      devWorld: (state) => this.devWorldUI?.receive(state),
      devWorldResult: (id, error) => this.devWorldUI?.result(id, error),
      policy: state => {
        this.worldPolicy = state.policy; this.adminUI?.receive(state); this.dailyUI?.setPolicy(state.policy); this.updateRoomButtons();
        document.dispatchEvent(new Event('waiwai-policy-changed'));
      },
      policyResult: (id, error) => this.adminUI?.result(id, error),
      dummies: state => this.dummyUI?.receive(state),
      dummyResult: (id, error) => this.dummyUI?.result(id, error),
      ice: (state) => { this.travelIce = state; this.travelIceOffset = state.serverNow - Date.now(); this.combatUI?.receiveIce(state); this.spellsUI?.receiveIce(state.activeUntil, state.serverNow); },
      arena: (state) => this.combatUI?.receive(state.state),
      arenaResult: (result) => this.combatUI?.result(result.actionId, result.error),
      spellResult: (result) => this.spellsUI?.result(result.actionId, result.error),
      spellEffect: (effect) => {
        if (effect.roomId !== this.roomId) return;
        this.spellsView?.receive(effect);
        if (effect.spell === 'call' && effect.targetIds.includes(this.localId ?? '')) document.querySelector('#office-notice')!.textContent = `🔔 ${effect.casterName}さんの「コール」で、${getRoom(effect.roomId).name}へ呼び寄せられました。`;
      },
      birthdayResult: (id, error) => this.birthdaysUI?.result(id, error),
      announcementResult: (id, error) => this.announcementsUI?.result(id, error),
      vehicles: (units) => { this.vehicleUI?.inventory(units); this.vehicleDocks?.receive(units); },
      vehicleResult: (id, error) => this.vehicleUI?.result(id, error),
      pets: (roomId, pets) => this.companions?.pets(roomId, pets),
      player: (player, snap, reason) => this.receivePlayer(player, snap, reason),
      restResult: (error) => {
        this.restPending = false; this.updateReactionTools();
        document.querySelector('#reaction-status')!.textContent = error ?? (this.isResting() ? '寝転び中 ·「起き上がる」ボタンか5キーでもどります。' : '起き上がりました。');
      },
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
      directory: (people, warning) => { this.directoryUI?.setPeople(people, warning); this.spellsUI?.setPeople(people); this.chatUI?.peopleChanged(people); },
      travelComplete: () => this.directoryUI?.complete(),
      travelError: (error) => this.directoryUI?.fail(error),
      objects: (roomId, objects) => {
        if (roomId !== this.roomId) return;
        this.objects = objects; this.dailyView?.setObjects(objects); this.seats = seatSpots(roomId, objects); this.participantsDirty = true; this.lighting?.setObjects(objects); this.objectsReady = true; this.drawObjects(); this.updateObjectTools();
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
      document.querySelector('#connection-message')!.textContent = 'アカウントでログインすると入室できます。';
      document.querySelector('#connection-label')!.textContent = 'ログインを待っています';
    }
    const cleanup = () => {
      this.controls.destroy();
      this.inputController.abort();
      this.voice?.destroy();
      this.connection?.destroy();
      this.companions?.clear();
      this.focusUI?.destroy();
      this.chatUI?.destroy();
      this.speechView?.destroy();
      this.birthdaysUI?.destroy();
      this.devWorldUI?.destroy();
      this.adminUI?.destroy();
      this.dummyUI?.destroy();
      this.combatUI?.destroy(); this.spellsUI?.destroy(); this.spellsView?.destroy();
      this.lighting?.destroy();
      this.vehicleDocks?.destroy(); this.vehicleUI?.destroy(); this.announcementsUI?.destroy(); this.dailyUI?.destroy(); this.arcadeUI?.destroy(); this.cockpitUI?.destroy(); this.cockpitView?.destroy(); this.dailyView?.destroy(); this.lostItems?.destroy();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.game.canvas.focus({ preventScroll: true });
    this.game.canvas.parentElement?.querySelector('.loading')?.remove();
    this.focusUI.activateDefaults(this.loginRequired);
    this.update(0, 0);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connected = state === 'online';
    this.announcementsUI?.setConnected(this.connected); this.dailyUI?.setConnected(this.connected); this.cockpitUI?.setConnected(this.connected); this.arcadeUI?.setConnected(this.connected);
    this.birthdaysUI?.setConnected(this.connected);
    this.devWorldUI?.setConnected(this.connected);
    this.adminUI?.setConnected(this.connected);
    this.dummyUI?.setConnected(this.connected);
    this.focusUI?.setConnected(this.connected);
    this.combatUI?.setConnected(this.connected, this.localId); this.spellsUI?.setConnected(this.connected, this.localId); if (!this.connected) this.spellsView?.clear();
    this.lostItems?.setConnected(this.connected);
    this.vehicleUI?.setConnected(this.connected); this.vehicleDocks?.setConnected(this.connected);
    this.voice?.setConnected(this.connected);
    this.linksUI?.setReady(this.connected && this.objectsReady);
    if (!this.connected) {
      this.speechView?.clear();
      this.reactions.clear(); this.nextReactionAt = 0; this.restPending = false;
      this.controls.clear();
      this.clearPeers();
      this.players.clear();
      this.companions?.clear();
      this.localId = undefined;
      this.objectsReady = false;
      this.setEditMode('none');
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
    this.updateRoomButtons();
    this.renderParticipants();
    this.chatUI?.connection(this.connected);
    this.directoryUI?.setConnection(this.connected, this.localId);
    this.updateObjectTools();
    this.updateReactionTools();
    if (this.connected) document.querySelector('#reaction-status')!.textContent = 'ボタンやマップ操作中の1〜4・6キーでリアクション。5キーで寝転ぶ／起き上がる。';
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
    view.sprite.destroy(); view.laptop.destroy(); view.vehicle.destroy(); view.shadow.destroy(); view.label.destroy(); view.reactionLabel.destroy(); view.sparkles.destroy();
  }

  private receivePlayer(player: Player, snap: boolean, reason?: string): void {
    const previous = this.players.get(player.id);
    if (previous && previous.roomId !== player.roomId) this.speechView?.remove(player.id);
    if (previous && (snap || previous.x !== player.x || previous.y !== player.y || previous.roomId !== player.roomId)) this.reactions.delete(player.id);
    this.players.set(player.id, player);
    if (player.resting) this.reactions.delete(player.id);
    if (player.id === this.localId) {
      if (reason === 'rest') { this.controls.clear(); this.restPending = false; }
      this.updateReactionTools();
      if (reason === 'spell') {
        this.controls.clear(); this.setEditMode('none');
        for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog[open]:not(.chat-docked)')) dialog.close();
        this.directoryUI?.fail('魔法で移動しました。現在の場所から操作できます。');
      }
      if (reason === 'vending' && player.appearance) {
        this.appearance = { ...player.appearance };
        this.appearancePickup?.(this.appearance);
        document.querySelector('#office-notice')!.textContent = '自販機でペットボトルを受け取りました。ひと息つこう。';
      }
      if (player.roomId !== this.roomId) this.showRoom(player.roomId);
      if (reason === 'policy') {
        this.controls.clear(); this.setEditMode('none');
        document.querySelector('#office-notice')!.textContent = '管理者がフロアを休止したため、公開中のフロアへ移動しました。';
      }
      if (player.accountId || player.slackVerified) {
        this.playerName = player.name;
        this.slack = player.slack ?? null;
        document.querySelector('#profile-name')!.textContent = player.name;
      }
      this.walker.setStepMs(reason === 'dash' ? DASH_MS : movementStep(player.riding?.kind));
      this.walker.receive(player, player.facing, snap, reason === 'dash');
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
          .on('pointerup', mapTap(() => { if (this.editMode === 'none') this.openDirectMessage(player.id); }));
        peer.view.vehicle.setInteractive({ useHandCursor: true }).on('pointerup', mapTap(() => { if (this.editMode === 'none') this.openDirectMessage(player.id); }));
        peer.view.label.setInteractive({ useHandCursor: true })
          .on('pointerup', mapTap(() => { if (this.editMode === 'none') this.openDirectMessage(player.id); }));
        this.peers.set(player.id, peer);
        snap = true;
      }
      peer.player = player;
      peer.walker.setStepMs(reason === 'dash' ? DASH_MS : movementStep(player.riding?.kind));
      peer.walker.receive(player, player.facing, snap, reason === 'dash');
    }
    this.companions?.player(player, snap);
    this.participantsDirty = true;
    this.voice?.setWorld(this.localId, this.players, player.id);
  }

  private removePlayer(id: string): void {
    this.speechView?.remove(id);
    this.companions?.remove(id);
    this.reactions.delete(id);
    const peer = this.peers.get(id);
    if (peer) this.destroyView(peer.view);
    this.peers.delete(id);
    this.players.delete(id);
    this.voice?.setWorld(this.localId, this.players, id);
    this.renderParticipants();
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
      if (player.id !== this.localId) name.setAttribute('aria-label', `${player.name}さんのWaiwai内DMを開く`);
      item.children[1].textContent = areaAt(player);
      item.children[2].textContent = player.dummy ? 'テスト用 · 自動返信 · マイクなし' : player.slackVerified ? 'Slackログイン済み' : player.accountId && !player.accountId.startsWith('guest:') ? 'アカウントログイン済み' : player.slack ? 'Slack手動設定' : 'ゲスト';
      const reaction = this.reactions.get(player.id);
      item.dataset.reaction = reaction?.kind ?? '';
      item.dataset.resting = String(!!player.resting);
      item.children[3].textContent = player.resting ? '寝転び中' : reaction ? `${REACTIONS[reaction.kind].icon} ${REACTIONS[reaction.kind].label}` : '';
    }
    document.querySelectorAll('[data-player-count]').forEach((element) => {
      const text = this.connected ? `${this.players.size}人が滞在中` : '接続を待っています';
      if (element.textContent !== text) element.textContent = text;
    });
    const localCount = [...this.players.values()].filter((p) => p.roomId === this.roomId).length;
    document.querySelectorAll('[data-room-count]').forEach((node) => { node.textContent = `${localCount}人がこの部屋にいます`; });
    for (const room of ROOMS) {
      const count = [...this.players.values()].filter((p) => p.roomId === room.id).length;
      for (const label of document.querySelectorAll(`[data-room-occupancy="${room.id}"]`)) {
        label.textContent = `${count}人${room.id === this.roomId && !label.classList.contains('room-shortcut-count') ? ' · いまここ' : ''}`;
      }
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

  private openDirectMessage(id: string): void {
    const player = this.players.get(id);
    if (!this.connected || !player || id === this.localId) return;
    this.chatUI?.openDM(playerIdentity(player));
  }

  private openRoomPicker(): void {
    this.controls.clear();
    const dialog = document.querySelector<HTMLDialogElement>('#room-dialog')!;
    if (!dialog.open) dialog.showModal();
  }

  private showRoom(id: RoomId): void {
    this.speechView?.clear();
    this.controls.clear(); this.travelIce = undefined;
    this.spellsView?.clear();
    this.reactions.clear();
    this.roomId = id; this.combatUI?.setRoom(id); this.arcadeUI?.setRoom(id); this.cockpitUI?.setRoom(id); this.cockpitView?.setRoom(id);
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
    this.mapViews = drawOffice(this, id, () => { if (this.editMode === 'none') this.dailyUI?.openCalendar(); }, (game) => { if (this.editMode === 'none') this.arcadeUI?.open(game); }, (item) => this.openBoard(item));
    this.dailyView?.setDecorations(this.mapViews);
    const room = getRoom(id);
    this.game.canvas.setAttribute('aria-label', `${room.name}。床をタップ・クリックして移動。矢印キーまたはWASDも使えます。Tabキーでマップから移動できます。`);
    document.querySelectorAll('[data-room-name]').forEach((node) => { node.textContent = room.name; });
    document.querySelector('#room-description')!.textContent = room.description;
    document.querySelector('#robot-location')!.textContent = `WAIWAI-01 / ${robotLocation(id)}`;
    document.querySelector('#map-title')!.textContent = `${room.name}へ、ようこそ。`;
    document.querySelector('#room-number')!.textContent = String(ROOMS.indexOf(room) + 1).padStart(2, '0');
    document.querySelector('.map-legend')!.textContent = id === 'arcade' ? '8台の筐体で、対戦・協力・リズム遊び。ひとりでも気軽にどうぞ。' : id === 'cockpit' ? '操縦パネルでシミュレーターへ。機体の部位から、各部屋へ移動できます。' : `${room.description} 近づいて会話。人をクリックしてSlackへ、家具をクリックしてリンクへ。`;
    this.updateRoomButtons();
    // Other-room roster entries are kept for occupancy, but avatars stay local.
    for (const player of this.players.values()) if (player.id !== this.localId && player.roomId === id) this.receivePlayer(player, true);
    this.updateObjectTools();
  }

  private updateRoomButtons(): void {
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-room]')) {
      const current = button.dataset.room === this.roomId;
      const allowed = policyAllows(this.worldPolicy, 'rooms', button.dataset.room!);
      button.disabled = !this.connected || current || !allowed;
      button.hidden = !allowed;
      button.dataset.roomBlocked = String(!allowed);
      button.title = allowed ? `${getRoom(button.dataset.room as RoomId).name}へ移動` : '管理者により利用停止中';
      if (current) button.setAttribute('aria-current', 'location');
      else button.removeAttribute('aria-current');
    }
    const openCount = ROOMS.filter(room => policyAllows(this.worldPolicy, 'rooms', room.id)).length;
    document.querySelectorAll('[data-open-room-count]').forEach(node => { node.textContent = `${openCount} ROOMS TO EXPLORE`; });
  }

  private setupRoomTools(): void {
    const signal = this.inputController.signal;
    document.querySelector('#room-picker-open')!.addEventListener('click', () => this.openRoomPicker(), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-room]')) button.addEventListener('click', () => {
      if (!this.connected) return;
      this.controls.clear();
      this.connection?.changeRoom(button.dataset.room as RoomId);
      const dialog = document.querySelector<HTMLDialogElement>('#room-dialog')!;
      if (dialog.open) dialog.close();
      else this.game.canvas.focus({ preventScroll: true });
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
      if (pointer.button !== 0 || !isMapTap(pointer)) return;
      if (this.editMode === 'none' && this.mouseMovement && this.connected && this.objectsReady && !this.isResting() && !this.restPending && !document.querySelector('dialog[open]:not(.chat-docked)')) {
        const point = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
        const tile = { x: Math.floor(point.x / TILE), y: Math.floor(point.y / TILE) };
        if (this.travelWalkable(tile.x, tile.y)) {
          const double = this.lastClick && this.lastClick.x === tile.x && this.lastClick.y === tile.y && performance.now() - this.lastClick.time <= 320;
          const origin = this.lastClick?.origin ?? { ...this.walker.tile };
          this.clickTravel.clear(); clearTimeout(this.clickTimer);
          const travel = () => {
            if (!this.mouseMovement || !this.connected || this.isResting() || document.querySelector('dialog[open]:not(.chat-docked)')) return;
            const ok = this.clickTravel.set(double ? origin : this.walker.tile, tile, (x,y) => this.travelWalkable(x,y), !!double);
            document.querySelector('#click-move-status')!.textContent = !ok ? 'そこへ歩ける通路がありません。' : double ? 'ダッシュ！ · 壁の手前で止まります' : '目的地まで移動中 · キー操作で中止';
          };
          if (double) { this.lastClick = undefined; travel(); }
          else { this.lastClick = { ...tile, time: performance.now(), origin: { ...this.walker.tile } }; this.clickTimer = setTimeout(travel, 250); }
          return;
        }
      }
      this.editAt(pointer);
    });
  }

  private setupReactions(): void {
    const signal = this.inputController.signal;
    document.querySelector('#toggle-rest')!.addEventListener('click', () => this.toggleRest(), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) button.addEventListener('click', () => {
      this.playReaction(button.dataset.reaction as ReactionKind);
    }, { signal });
    this.game.canvas.addEventListener('keydown', (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.code === 'Digit5') { event.preventDefault(); this.toggleRest(); return; }
      if (event.code === 'KeyM') { event.preventDefault(); document.querySelector<HTMLButtonElement>('#mouse-move-toggle')?.click(); return; }
      if (event.code === 'KeyQ') { event.preventDefault(); document.querySelector<HTMLButtonElement>('#spells-open')?.click(); return; }
      if (event.code === 'KeyF' || event.code === 'KeyB') { event.preventDefault(); this.spellsUI?.quick(event.code === 'KeyF' ? 'fire' : 'blizzard'); return; }
      if (event.code === 'KeyE' && this.editMode === 'none') { event.preventDefault(); this.vehicleUI?.quickAction(); return; }
      const kind = REACTION_KINDS.find(kind => event.code === `Digit${REACTIONS[kind].key}`);
      if (kind) { event.preventDefault(); this.playReaction(kind); }
    }, { signal });
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    preference.addEventListener('change', () => { this.reducedMotion = preference.matches; }, { signal });
    this.updateReactionTools();
  }
  private playReaction(kind: ReactionKind): void {
    if (!this.connected || this.isResting() || this.restPending || performance.now() < this.nextReactionAt) return;
    this.controls.clear(); this.setEditMode('none');
    if (!this.connection?.react(kind)) return;
    this.nextReactionAt = performance.now() + REACTION_COOLDOWN_MS;
    document.querySelector('#reaction-status')!.textContent = 'リアクションを伝えています…';
    this.updateReactionTools(); this.game.canvas.focus({ preventScroll: true });
  }
  private updateReactionTools(): void {
    const resting = this.isResting();
    this.reactionBlocked = !this.connected || resting || this.restPending || performance.now() < this.nextReactionAt;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-reaction]')) button.disabled = this.reactionBlocked;
    const button = document.querySelector<HTMLButtonElement>('#toggle-rest')!;
    button.disabled = !this.connected || this.restPending;
    button.setAttribute('aria-pressed', String(resting));
    button.querySelector('[data-rest-label]')!.textContent = resting ? '起き上がる' : '寝転ぶ';
    if (!this.connected) document.querySelector('#reaction-status')!.textContent = 'オフィスへの接続後にリアクションできます。';
  }
  private isResting(): boolean { return !!this.players.get(this.localId ?? '')?.resting; }
  private toggleRest(): void {
    if (!this.connected || this.restPending) return;
    this.controls.clear(); this.setEditMode('none');
    if (!this.connection?.rest(!this.isResting())) return;
    this.restPending = true; this.updateReactionTools();
    this.game.canvas.focus({ preventScroll: true });
  }

  private owner(): string {
    const player = this.localId ? this.players.get(this.localId) : undefined;
    return player ? playerIdentity(player) : `guest:${this.localId}`;
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
    this.dailyView?.setDecorations([...this.mapViews, ...this.objectViews]);
  }
  private previewObject(pointer: Phaser.Input.Pointer): void {
    this.ghost?.destroy(); this.ghost = undefined;
    if (!this.objectsReady || this.pendingEdit || (this.editMode !== 'place' && !(this.editMode === 'move' && this.selectedObject))) return;
    const selected = this.objects.find((o) => o.id === this.selectedObject);
    const object: RoomObject = { id: selected?.id ?? 'preview', owner: this.owner(), roomId: this.roomId,
      kind: selected?.kind ?? this.objectKind, x: Math.floor((pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2).x / TILE), y: Math.floor((pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2).y / TILE), rotation: this.objectRotation };
    const error = placementProblem(object, this.objects, [...this.players.values()]);
    this.ghost = drawRoomObject(this, object).setAlpha(error ? 0.25 : 0.65).setDepth(2000);
    const { w, h } = objectSize(object.kind);
    this.ghost.lineStyle(1, error ? 0xb96551 : 0xfff3bc).strokeRect(-w * TILE / 2, -h * TILE / 2, w * TILE, h * TILE);
  }
  private openBoard(item: Furniture): void {
    if (this.editMode !== 'none' || !this.connected || !this.objectsReady) return;
    const target = objectTargets(this.roomId, []).find((o) => o.kind === 'board' && o.x === item.x && o.y === item.y);
    if (target) this.linksUI?.open(target);
  }
  private editAt(pointer: Phaser.Input.Pointer): void {
    const x = Math.floor((pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2).x / TILE), y = Math.floor((pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2).y / TILE);
    if (this.editMode === 'none') {
      const door = getRoom(this.roomId).door;
      if (this.roomId !== 'arena' && x === door.x && y === door.y) this.openRoomPicker();
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
    const resting = !!(id && this.players.get(id)?.resting);
    const seat = this.connected && this.objectsReady && !resting ? restingSeat(this.seats, walker.tile, walker.moving, !!riding, !!motion) : undefined;
    if (view.seatId !== seat?.id) { view.seatId = seat?.id; this.participantsDirty = true; }
    if (seat) { x = seat.anchor.x; y = seat.anchor.y; }
    const walk = walkingMotion(appearance.walkStyle, time, walker.facing, walker.moving && !motion && !riding && !seat && !resting, this.reducedMotion);
    const lift = (motion?.lift ?? walk.lift) + (riding?.kind === 'bike' ? 4 : 0);
    const frame = riding && walker.moving && !motion ? 1 + Math.floor(time / 95) % 2 : walk.frame;
    view.sprite.setPosition(Math.round(x + walk.offsetX), Math.round(y + 6 - lift)).setRotation(motion?.tilt ?? walk.tilt).setScale(walk.scaleX, motion?.scaleY ?? walk.scaleY)
      .setTexture(avatarTexture(this, motion && reaction?.kind === 'anger' ? { ...appearance, heldItem: 0 } : appearance, motion ? 'down' : seat?.facing ?? walker.facing, frame, resting ? 'lie' : motion?.pose ?? (seat ? 'sit' : 'stand'))).setDepth(seat?.depth ?? y + 7);
    const thrown = motion && reaction?.kind === 'anger' ? laptopThrowMotion(performance.now() - reaction.startedAt, this.reducedMotion) : undefined;
    view.laptop.setVisible(!!thrown);
    if (thrown) view.laptop.setPosition(Math.round(x + thrown.x), Math.round(y + thrown.y)).setRotation(thrown.rotation).setAlpha(thrown.alpha).setDepth(ROWS * TILE + 22);
    view.vehicle.setVisible(!!riding);
    if (riding) view.vehicle.setTexture(vehicleTexture(this, riding.kind, walker.facing, frame)).setPosition(Math.round(x), Math.round(y + 10 - (motion?.lift ?? 0))).setDepth(y + 6.5);
    view.shadow.setPosition(Math.round(x), Math.round(y) + (resting ? -4 : 5)).setScale(resting ? 2.2 : motion?.shadow ?? walk.shadow, resting ? 1.8 : 1).setDepth(y + 6);
    const labelLift = lift + (thrown ? 24 : 0);
    view.label.setText(name).setPosition(Math.round(x), Math.round(y - 20 - labelLift)).setDepth(ROWS * TILE + 20);
    view.reactionLabel.setVisible(!!motion);
    if (motion && reaction) view.reactionLabel.setText(REACTIONS[reaction.kind].text)
      .setPosition(Math.round(x), Math.max(14, Math.round(y - 35 - labelLift))).setDepth(ROWS * TILE + 21);
    if (id) this.speechView?.draw(id, x, Math.min(view.label.y - view.label.height - 3, motion ? view.reactionLabel.y - view.reactionLabel.height - 3 : Infinity), performance.now(), this.reducedMotion);
    view.sparkles.clear().setPosition(x, y - lift).setDepth(motion && reaction?.kind === 'anger' ? ROWS * TILE + 23 : y + 8);
    if (motion && reaction?.kind === 'anger') {
      // Four little red corners form the familiar comic anger mark.
      view.sparkles.lineStyle(1, 0xc95f54, .9);
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        view.sparkles.lineBetween(-14 + dx * 4, -27 + dy * 2, -14 + dx * 2, -27 + dy * 2);
        view.sparkles.lineBetween(-14 + dx * 2, -27 + dy * 2, -14 + dx * 2, -27 + dy * 4);
      }
      if (thrown?.impact) {
        view.sparkles.fillStyle(0xb99c76, thrown.impact);
        for (const [dx, dy] of [[-10, 0], [8, 1], [-6, -5], [6, -6]]) view.sparkles.fillRect(thrown.x + dx, thrown.y + dy, 2, 1);
      }
    }
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
      this.game.canvas.dataset.localPose = resting ? 'lie' : motion?.pose ?? (seat ? 'sit' : 'stand');
      this.game.canvas.dataset.seatId = seat?.id ?? '';
      this.game.canvas.dataset.seatFacing = seat?.facing ?? '';
      const status = document.querySelector('#seating-status')!;
      const text = resting ? '床に寝転び中 ·「起き上がる」ボタンか5キーでもどります。' : seat ? `${seat.name}に着席中 · 移動すると立ち上がります。` : '椅子・机・ソファの正面で止まると、自動で座ります。';
      if (status.textContent !== text) status.textContent = text;
    }
  }

  private travelWalkable(x: number, y: number): boolean {
    return walkableWithObjects(x, y, this.roomId, this.objects) && !this.travelIce?.shields.some(s => s.roomId === this.roomId && s.x === x && s.y === y && s.expiresAt > Date.now() + this.travelIceOffset);
  }

  update(time: number, delta: number): void {
    const now = Date.now();
    this.lostItems?.update(now); this.dailyView?.update(now, this.reducedMotion);
    this.lighting?.update(now); this.cockpitView?.update(now, this.reducedMotion);
    this.skyWindow?.update(now, this.reducedMotion);
    if (this.reactionBlocked !== (!this.connected || this.isResting() || this.restPending || performance.now() < this.nextReactionAt)) this.updateReactionTools();
    if (this.participantsDirty && time - this.lastParticipantsAt >= 100) {
      this.participantsDirty = false;
      this.lastParticipantsAt = time;
      this.renderParticipants();
    }
    this.companions?.update(time, delta, this.reducedMotion);
    this.spellsView?.update(this.reducedMotion); this.combatUI?.update(this.reducedMotion);
    this.walker.update(delta);
    if (document.querySelector('dialog[open]:not(.chat-docked)')) this.controls.clear();
    if (this.isResting() || this.restPending) this.controls.clear();
    if (this.editMode === 'none' && !this.isResting() && !this.restPending && !this.walker.moving && this.connection?.readyToMove) {
      const dash = this.controls.takeDash(), direction = dash ?? this.controls.direction();
      const click = !direction && this.mouseMovement ? this.clickTravel.next(this.walker.tile, (x,y) => this.travelWalkable(x,y)) : undefined;
      if (this.clickTravel.lastStop) { document.querySelector('#click-move-status')!.textContent = this.clickTravel.lastStop === 'arrived' ? '到着しました。床をクリックすると移動できます。' : '通路がふさがったため停止しました。別の場所を選んでください。'; this.clickTravel.lastStop = undefined; }
      const next = direction ?? click?.direction;
      if (next) { if (direction) this.clickTravel.clear(); if (this.localId) this.reactions.delete(this.localId); if (dash || click?.dash) this.connection.dash(next); else this.connection.move(next); }
    }
    this.destinationMarker?.clear();
    if (this.clickTravel.goal) { const p = this.clickTravel.goal; this.destinationMarker?.lineStyle(1, 0xffed9c, 0.9).strokeRect(p.x * TILE + 2, p.y * TILE + 2, TILE - 4, TILE - 4); }
    this.speechView?.beginFrame();
    this.drawAvatar(this.avatar, this.walker, this.appearance, this.playerName, time, this.localId);
    this.avatar.sprite.setAlpha(this.connected ? 1 : 0.45);
    for (const peer of this.peers.values()) {
      peer.walker.update(delta);
      this.drawAvatar(peer.view, peer.walker, parseAppearance(peer.player.appearance, peer.player.outfit)!, peer.player.name + (this.speaking.has(peer.player.id) ? ' ♪' : ''), time, peer.player.id);
    }
    this.speechView?.endFrame();
    const area = areaAt({ ...this.walker.tile, roomId: this.roomId });
    if (area !== this.lastArea) {
      this.lastArea = area;
      document.querySelectorAll('[data-current-area]').forEach((element) => { element.textContent = area; });
    }
    const door = getRoom(this.roomId).door;
    const atDoor = this.roomId !== 'arena' && this.walker.tile.x === door.x && this.walker.tile.y === door.y;
    if (atDoor && !this.atDoor && this.connected && this.editMode === 'none') this.openRoomPicker();
    this.atDoor = atDoor;
    const board = boardInFront(this.roomId, this.walker.tile);
    if (!board) this.frontBoard = undefined;
    else if (board.id !== this.frontBoard && this.connected && this.editMode === 'none' && !this.walker.moving &&
      !document.querySelector('dialog[open]:not(.chat-docked)') && this.linksUI?.hasLinks(board.id)) {
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
    type: Phaser.AUTO, parent, width: ART_WIDTH, height: ART_HEIGHT,
    backgroundColor: '#ead3a5', pixelArt: true, roundPixels: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], input: { keyboard: false, touch: { capture: false }, mouse: { preventDefaultWheel: false } }, audio: { noAudio: true },
  });
  return { game, scene };
}
