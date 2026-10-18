import { ChatService } from './chat.ts';
import { WorldPolicyStore, PolicyError } from './world-policy.ts';
import { allowedRooms, allowedDailyEvent, policyAllows } from '../src/game/world-policy.ts';
import { persistentIdentity } from '../src/game/identity.ts';
import { playerIdentity, userIdentity } from '../src/game/identity.ts';
import { lostItemsSnapshot, lostItemPeriod } from '../src/game/lost-items.ts';
import { BirthdayStore, BirthdayError } from './birthdays.ts';
import { birthdayDay } from '../src/game/birthdays.ts';
import { ArcadeRoom } from './arcade.ts';
import { RobotSimulation } from './robot.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
import { WorldTestControls, allowDevWorld } from './dev-world.ts';
import { isPokemonKind } from '../src/game/pokemon.ts';
import { SPELLS } from '../src/game/spells.ts';
import type { SpellKind } from '../src/game/spells.ts';
import { callDestinations, fireDestination } from './spells.ts';
import { MagicArena, IceShields } from './arena.ts';
import { DASH_TILES, DASH_MS, DASH_COOLDOWN_MS } from '../src/game/dash.ts';
import { AnnouncementStore, AnnouncementError } from './announcements.ts';
import { vendingInReach } from '../src/game/amenities.ts';
import { VehicleFleet } from './vehicles.ts';
import { movementStep } from '../src/game/transport.ts';
import { RoomPets, resetBuddy, advanceBuddy } from './companions.ts';
import { PET_STEP_MS } from '../src/game/buddies.ts';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import WebSocket, { WebSocketServer } from 'ws';
import { COLS, ROWS } from '../src/game/world.ts';
import { MAX_PLAYERS, POSITION_FRAME_MS, directions, parseClientMessage } from '../src/network/protocol.ts';
import type { Player, Position, ServerMessage } from '../src/network/protocol.ts';
import { VoiceRoom, readIceProvider } from './voice.ts';
import type { OfficeAuthService } from './auth.ts';
import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { getRoom, ROOMS } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
import { placementProblem, walkableWithObjects } from '../src/game/objects.ts';
import { ObjectStore } from './objects.ts';
import { MemberStore } from './members.ts';
import { directoryPeople } from '../src/game/directory.ts';
import { adjacentTile } from './warp.ts';
import { LinkStore } from './links.ts';
import { MAX_FAVORITES, objectTargets } from '../src/game/object-links.ts';
import { REACTION_COOLDOWN_MS } from '../src/game/reactions.ts';

class EditError extends Error {}

export function attachOffice(server: Server, auth?: OfficeAuthService, options: { chat?: ChatService; objectsFile?: string; membersFile?: string; linksFile?: string; announcementsFile?: string; birthdaysFile?: string; policyFile?: string; administratorId?: string; devControls?: boolean; birthdayClock?: () => number; eventClock?: () => number; lostClock?: () => number } = {}): () => void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const players = new Map<WebSocket, Player>();
  const requests = new Map<WebSocket, IncomingMessage>();
  const policies = new WorldPolicyStore(options.policyFile, options.administratorId);
  let policy = policies.snapshot();
  const roomAllowed = (id: RoomId) => policyAllows(policy, 'rooms', id);
  const pokemonAllowed = (id: string) => policyAllows(policy, 'pokemon', id);
  const currentRoster = () => world.roster((options.eventClock ?? Date.now)(), { kind: pokemonAllowed, room: roomAllowed });
  const contacts = new Map<string, () => void>();
  const movementBlocks = new Map<string, number>();
  const summonedAt = new Map<string, number>();
  const store = new ObjectStore(options.objectsFile);
  const arena = new MagicArena(), ice = new IceShields();
  let publishedArena = "";
  const members = new MemberStore(options.membersFile);
  const chat = options.chat ?? new ChatService();
  for (const member of members.list()) chat.store.account(member.id, member.name, true);
  const links = new LinkStore(options.linksFile);
  const announcements = new AnnouncementStore(options.announcementsFile);
  const birthdayClock = options.birthdayClock ?? Date.now;
  const birthdays = new BirthdayStore(options.birthdaysFile, birthdayClock);
  const birthdayOwner = playerIdentity;
  const birthdayThreads = new Map<WebSocket, { id: string; date: string }>();
  const sendBirthdayThreads = () => {
    for (const [client, thread] of birthdayThreads) {
      try { send(client, { type: 'birthday-thread', ...birthdays.thread(thread.id, thread.date) }); }
      catch { birthdayThreads.delete(client); send(client, { type: 'birthday-thread', ...thread, comments: [], serverNow: birthdayClock() }); }
    }
  };
  let announcementWarning: string | undefined;
  let directoryDirty = false;
  let directoryWarning: string | undefined;
  const alive = new Set<WebSocket>();
  const devClients = new Set<WebSocket>();
  const world = new WorldTestControls((options.eventClock ?? Date.now)());
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
  const sendBirthdays = (target?: WebSocket) => {
    for (const [client, player] of players) if (!target || target === client) send(client, { type: 'birthdays', ...birthdays.snapshot(birthdayOwner(player)) });
  };
  let birthdayDate = birthdayDay(birthdayClock());
  const birthdayTimer = setInterval(() => { const date = birthdayDay(birthdayClock()); if (date !== birthdayDate) { birthdayDate = date; sendBirthdays(); } }, 1000); birthdayTimer.unref();
  const arcade = new ArcadeRoom();
  const publishedArcade = new Map<string, string>();
  const sendArcade = (target?: WebSocket) => {
    const snapshot = arcade.snapshot(Date.now());
    if (!target) snapshot.tables = snapshot.tables.filter((table) => {
      const version = `${table.roundId}:${table.revision}`;
      if (publishedArcade.get(table.game) === version) return false;
      publishedArcade.set(table.game, version); return true;
    });
    if (!snapshot.tables.length) return;
    const message: ServerMessage = { type: 'arcade-state', ...snapshot };
    if (target) { if (players.get(target)?.roomId === 'arcade') send(target, message); }
    else {
      const serialized = JSON.stringify(message);
      for (const [client, person] of players) if (person.roomId === 'arcade') sendRaw(client, serialized);
    }
  };
  const leaveArcade = (id: string) => { if (arcade.leave(id, Date.now())) sendArcade(); };
  const arcadeTimer = setInterval(() => { if (arcade.tick(Date.now())) sendArcade(); }, 100); arcadeTimer.unref();
  const robot = new RobotSimulation();
  const sendRobot = (target?: WebSocket) => {
    const message: ServerMessage = { type: 'robot-state', ...robot.snapshot(Date.now()) };
    if (target) { if (players.get(target)?.roomId === 'cockpit') send(target, message); }
    else for (const [client, person] of players) if (person.roomId === 'cockpit') send(client, message);
  };
  const robotTimer = setInterval(() => { if (robot.tick(Date.now())) sendRobot(); }, 250); robotTimer.unref();
  const lostClock = options.lostClock ?? Date.now;
  let lostState = lostItemsSnapshot(lostClock(), store.list(), world.lost);
  let lostPeriod = lostItemPeriod(lostState.serverNow);
  const sendLostItems = (ws?: WebSocket): void => {
    const now = lostClock();
    if (ws && lostItemPeriod(now) !== lostPeriod) { sendLostItems(); return; }
    if (!ws) { lostPeriod = lostItemPeriod(now); lostState = lostItemsSnapshot(now, store.list(), world.lost); }
    const message: ServerMessage = { type: 'lost-items', ...lostState, items: lostState.items.filter(item => roomAllowed(item.roomId)), serverNow: now };
    if (ws) send(ws, message); else { broadcast(message); sendDevWorld(); }
  };
  const lostTimer = setInterval(() => { if (lostItemPeriod(lostClock()) !== lostPeriod) sendLostItems(); }, 1000); lostTimer.unref();
  const eventClock = options.eventClock ?? Date.now;
  let eventDay = dailyEventAt(eventClock()).day;
  const sendDailyEvent = (ws?: WebSocket) => {
    const serverNow = eventClock(), original = world.event(serverNow), currentEvent = allowedDailyEvent(original, policy);
    const message: ServerMessage = { type: 'daily-event', event: currentEvent ?? original, serverNow, disabled: !currentEvent, ...(world.preview ? { preview: true } : {}) };
    if (ws) send(ws, message); else { eventDay = original.day; broadcast(message); }
  };
  const dailyEventTimer = setInterval(() => {
    if (dailyEventAt(eventClock()).day !== eventDay) {
      world.refresh(eventClock()); pets.replacePokemon(currentRoster(), store.list());
      sendDailyEvent(); sendLostItems(); for (const [client, person] of players) sendPets(client, person.roomId); sendDevWorld();
    }
  }, 1000);
  dailyEventTimer.unref();
  const sendAnnouncements = (ws?: WebSocket) => {
    const message: ServerMessage = { type: 'announcements', ...announcements.snapshot(), ...(announcementWarning ? { warning: announcementWarning } : {}) };
    if (ws) send(ws, message); else broadcast(message);
  };
  const announcementTimer = setInterval(() => {
    void announcements.tick().then((changed) => {
      const recovered = !!announcementWarning; announcementWarning = undefined;
      if (changed || recovered) sendAnnouncements();
    }).catch(() => {
      if (!announcementWarning) { announcementWarning = '予定の自動放送を保存できません。復旧後に再開します。'; sendAnnouncements(); }
    });
  }, 5000);
  announcementTimer.unref();
  const voice = new VoiceRoom(players, send, readIceProvider());
  const directory = (): Extract<ServerMessage, { type: 'directory' }> => ({ type: 'directory', people: directoryPeople(members.list(), players.values()), ...(directoryWarning ? { warning: directoryWarning } : {}) });
  const fleet = new VehicleFleet();
  const sendFleet = (ws?: WebSocket) => { const message: ServerMessage = { type: 'vehicles', units: fleet.list() }; if (ws) send(ws, message); else broadcast(message); };
  const pending = new Map<string, Position>();
  const frame = setInterval(() => {
    if (pending.size) {
      broadcast({ type: 'positions', positions: [...pending.values()] });
      pending.clear();
    }
    voice.refreshIfDirty();
    if (directoryDirty) { directoryDirty = false; broadcast(directory()); }
  }, POSITION_FRAME_MS);
  frame.unref();
  const roomObjects = (roomId: RoomId) => store.list().filter((o) => o.roomId === roomId);
  const collisionObjects = (roomId: RoomId) => [...roomObjects(roomId), ...ice.objects(Date.now()).filter((shield) => shield.roomId === roomId)];
  const sendIce = (target?: WebSocket) => { for (const [client, person] of players) if (!target || target === client) send(client, { type: 'ice-state', ...ice.snapshot(person.id, person.roomId, Date.now()) }); };
  const sendArena = (target?: WebSocket) => {
    const state = arena.snapshot();
    for (const [client, person] of players) if (person.roomId === 'arena' && (!target || target === client)) send(client, { type: 'arena-state', state, serverNow: Date.now() });
    if (state.phase === 'finished' && state.roundId && publishedArena !== state.roundId) {
      publishedArena = state.roundId;
      void announcements.publishArena(state.roundId, `${state.result}（${state.fighters.map((fighter) => `${fighter.name} HP${fighter.hp}`).join(' / ')}）`).then(() => sendAnnouncements()).catch(() => { announcementWarning = '対戦結果の放送を保存できませんでした。'; sendAnnouncements(); });
    }
  };
  const leaveArena = (id: string) => { if (arena.leave(id)) sendArena(); };
  const combatTimer = setInterval(() => {
    const now = Date.now(); if (ice.tick(now)) sendIce();
    if (arena.tick(now, players.values(), collisionObjects('arena'))) sendArena();
  }, 50); combatTimer.unref();

  const sendObjects = (ws: WebSocket, roomId: RoomId) => send(ws, { type: 'objects', roomId, objects: roomObjects(roomId) });
  const pets = new RoomPets(Math.random, eventClock());
  pets.configure(policy, store.list()); pets.replacePokemon(currentRoster(), store.list());
  const sendPets = (ws: WebSocket, roomId: RoomId) => send(ws, { type: 'pets', roomId, pets: pets.list(roomId) });
  const sendDevWorld = (target?: WebSocket) => {
    const message: ServerMessage = { type: 'dev-world-state', event: world.event(eventClock()), preview: world.preview, pokemon: ROOMS.flatMap((room) => pets.list(room.id)).filter((pet) => isPokemonKind(pet.kind)).map(({ kind, roomId }) => ({ kind: kind as import('../src/game/pokemon.ts').PokemonKind, roomId })), lost: lostState.items };
    for (const client of devClients) if (!target || target === client) send(client, message);
  };
  const petTimer = setInterval(() => {
    const changed = pets.step(store.list(), players.values());
    for (const [ws, person] of players) if (changed.has(person.roomId)) sendPets(ws, person.roomId);
  }, PET_STEP_MS);
  petTimer.unref();
  const sendLinks = (ws: WebSocket, roomId: RoomId) => {
    const targets = new Set(objectTargets(roomId, store.list()).map((o) => o.id));
    send(ws, { type: 'object-links', roomId, favorites: links.list().favorites,
      bindings: links.list().bindings.filter((b) => b.roomId === roomId && targets.has(b.objectId)) });
  };
  const spawn = (roomId: RoomId = 'office', except?: WebSocket) => {
    const origin = getRoom(roomId).spawn;
    const objects = collisionObjects(roomId);
    const occupied = new Set([...players].filter(([ws, player]) => ws !== except && player.roomId === roomId).map(([, { x, y }]) => `${x},${y}`));
    const tiles = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (walkableWithObjects(x, y, roomId, objects) && !occupied.has(`${x},${y}`)) tiles.push({ x, y });
    }
    tiles.sort((a, b) => (Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y)) -
      (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)));
    return tiles[0] ?? origin;
  };

  const sendPolicy = (target?: WebSocket) => {
    for (const client of players.keys()) if (!target || target === client)
      send(client, { type: 'world-policy', policy, administrator: policies.isAdministrator(auth?.identify(requests.get(client)!)?.user) });
  };
  const applyPolicy = () => {
    policy = policies.snapshot(); sendPolicy();
    pets.configure(policy, store.list()); pets.replacePokemon(currentRoster(), store.list());
    const fallback = allowedRooms(policy)[0];
    for (const [client, person] of players) {
      let changed = false;
      if (person.buddy && isPokemonKind(person.buddy) && !pokemonAllowed(person.buddy)) { person.buddy = null; delete person.buddyPosition; changed = true; }
      if (!roomAllowed(person.roomId)) {
        leaveArena(person.id); leaveArcade(person.id); fleet.release(person);
        Object.assign(person, { roomId: fallback, ...spawn(fallback, client), facing: 'down' });
        resetBuddy(person, collisionObjects(fallback)); pending.delete(person.id); movementBlocks.set(person.id, Date.now() + 300);
        broadcast({ type: 'player', player: person, reason: 'policy' });
        sendObjects(client, fallback); sendRobot(client); sendArcade(client); chat.state(client); sendLinks(client, fallback); sendIce(client); sendArena(client);
      } else if (changed) { pending.delete(person.id); broadcast({ type: 'player', player: person, reason: 'profile' }); }
      sendPets(client, person.roomId);
    }
    directoryDirty = true; voice.refresh(); sendFleet(); sendDailyEvent(); sendLostItems(); sendDevWorld();
  };

  const identities = new Map<WebSocket, string>();
  let nextSlot = 0;
  const unsubscribe = auth?.onRevoke((id) => {
    for (const [ws, session] of identities) if (session === id) ws.close(4001, 'Session ended');
  });
  wss.on('connection', (ws, request) => {
    const identity = auth?.identify(request);
    requests.set(ws, request);
    if (identity) identities.set(ws, identity.id);
    const player: Player = { id: randomUUID(), slot: ++nextSlot, name: identity?.user.name ?? 'ゲスト', outfit: 0, appearance: { ...DEFAULT_APPEARANCE }, roomId: 'office',
      slack: identity?.user.slack ?? null, slackVerified: !!identity?.user.slack, ...(identity ? { accountId: userIdentity(identity.user) } : {}), ...spawn(allowedRooms(policy)[0]), facing: 'down' };
    player.roomId = allowedRooms(policy)[0];
    players.set(ws, player);
    directoryDirty = true;
    if (identity) void members.remember(identity.user).then(() => {
      directoryWarning = undefined; directoryDirty = true;
    }).catch(() => {
      directoryWarning = 'メンバー情報を保存できませんでした。再接続後に表示が残らない場合があります。'; directoryDirty = true;
    });
    alive.add(ws);
    if (allowDevWorld(options.devControls, request)) devClients.add(ws);
    send(ws, { type: 'welcome', id: player.id, players: [...players.values()] });
    sendPolicy(ws);
    chat.join(ws, () => ({ id: playerIdentity(player), name: player.name, persistent: persistentIdentity(playerIdentity(player)), roomId: player.roomId }));
    broadcast({ type: 'player', player, reason: 'join' }, ws);
    sendObjects(ws, player.roomId);
    sendPets(ws, player.roomId);
    send(ws, directory());
    sendLinks(ws, player.roomId);
    sendFleet(ws);
    sendAnnouncements(ws);
    sendBirthdays(ws);
    sendDailyEvent(ws);
    sendLostItems(ws);
    sendIce(ws); sendArena(ws);
    if (devClients.has(ws)) sendDevWorld(ws);
    let lastMove = -Infinity;
    let windowStart = Date.now();
    let messages = 0;
    let signals = 0;
    let lastEdit = -Infinity;
    let lastWarp = -Infinity;
    let lastLinkEdit = -Infinity;
    let lastReaction = -Infinity;
    let lastAnnouncementEdit = -Infinity, lastPublish = -Infinity;
    const arcadeRequests = new Set<string>();
    let lastRobot = -Infinity;
    let lastVehicle = -Infinity;
    let lastBirthday = -Infinity;
    let lastDevWorld = -Infinity;
    let lastDash = -Infinity;
    const arenaRequests = new Map<string, string | undefined>();
    const spellTimes = new Map<SpellKind, number>();
    const spellResults = new Map<string, Extract<ServerMessage, { type: 'spell-result' }>>();
    const vehicleResults = new Map<string, string | undefined>();
    let lastVending: string | undefined;
    const contact = () => {
      if (!player.resting && !arena.active(player.id) && fleet.touch(player)) { pending.delete(player.id); broadcast({ type: 'player', player, reason: 'vehicle' }); sendFleet(); }
      const machine = vendingInReach(player);
      if (machine && machine !== lastVending && player.appearance?.heldItem !== 2) {
        player.appearance = { ...(player.appearance ?? DEFAULT_APPEARANCE), heldItem: 2 };
        pending.delete(player.id); broadcast({ type: 'player', player, reason: 'vending' });
      }
      lastVending = machine;
    };
    contacts.set(player.id, contact);
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
      if (message.type === 'policy-set') {
        const current = auth?.identify(request);
        void policies.apply(message, current?.user, () => players.has(ws) && !!current && auth?.identify(request)?.id === current.id && !!auth?.canJoin(request)).then(() => {
          applyPolicy(); send(ws, { type: 'policy-result', actionId: message.actionId });
        }).catch(error => { sendPolicy(ws); send(ws, { type: 'policy-result', actionId: message.actionId, error: error instanceof PolicyError ? error.message : '設定を保存できませんでした。時間をおいて試してください。' }); });
        return;
      }
      if (message.type === 'chat-history' || message.type === 'chat-send' || message.type === 'chat-read') { chat.action(ws, message); return; }
      if (message.type === 'arena-action') {
        if (arenaRequests.has(message.actionId)) { const error = arenaRequests.get(message.actionId); send(ws, { type: 'arena-result', actionId: message.actionId, ...(error ? { error } : {}) }); return; }
        const error = message.command === 'join' ? arena.join(player, now) : (leaveArena(player.id), undefined);
        arenaRequests.set(message.actionId, error); if (arenaRequests.size > 100) arenaRequests.delete(arenaRequests.keys().next().value!);
        if (!error && message.command === 'join' && arena.snapshot().phase === 'playing') {
          ice.clearArena(); const fighters = arena.snapshot().fighters;
          for (const [index, fighter] of fighters.entries()) {
            const person = [...players.values()].find((person) => person.id === fighter.id)!;
            fleet.release(person); Object.assign(person, { x: index ? 17 : 12, y: 10, facing: index ? 'left' : 'right' }); resetBuddy(person, collisionObjects('arena')); pending.delete(person.id); movementBlocks.set(person.id, now + 300);
            broadcast({ type: 'player', player: person, reason: 'spell' });
          }
          sendFleet(); sendIce(); voice.refresh();
        }
        sendArena(); send(ws, { type: 'arena-result', actionId: message.actionId, ...(error ? { error } : {}) }); return;
      }
      if (message.type === 'spell-cast') {
        const cached = spellResults.get(message.actionId); if (cached) { send(ws, cached); return; }
        const finish = (error?: string) => {
          const result: Extract<ServerMessage, { type: 'spell-result' }> = { type: 'spell-result', actionId: message.actionId, spell: message.spell, ...(error ? { error } : {}) };
          spellResults.set(message.actionId, result); if (spellResults.size > 128) spellResults.delete(spellResults.keys().next().value!); send(ws, result);
        };
        const wait = SPELLS[message.spell].cooldown - (now - (spellTimes.get(message.spell) ?? -Infinity));
        if (wait > 0) { finish(`あと${Math.ceil(wait / 1000)}秒で、もう一度唱えられます。`); return; }
        const origin = { x: player.x, y: player.y };
        if (message.spell === 'blizzard') {
          if (player.roomId === 'arena' && arena.snapshot().phase === 'playing' && !arena.active(player.id)) { finish('対戦中の氷は参加者だけが使えます。'); return; }
          const error = ice.place(player, players.values(), roomObjects(player.roomId), now);
          if (error) { finish(error); return; }
          spellTimes.set('blizzard', now); sendIce(); finish(); return;
        }

        if (message.spell === 'fire') {
          spellTimes.set('fire', now);
          if (arena.active(player.id)) { arena.fire(player, now); sendArena(); finish(); return; }
          const position = pending.get(player.id); if (position) { broadcast({ type: 'positions', positions: [position] }); pending.delete(player.id); }
          const effect: Extract<ServerMessage, { type: 'spell-effect' }> = { type: 'spell-effect', id: randomUUID(), spell: 'fire', casterId: player.id, casterName: player.name, roomId: player.roomId, origin, destinations: [fireDestination(player, collisionObjects(player.roomId))], targetIds: [] };
          for (const [client, person] of players) if (person.roomId === player.roomId) send(client, effect);
          finish(); return;
        }
        if (arena.active(player.id)) { finish('対戦中はコールとルーラを使えません。'); return; }
        const ids = message.spell === 'call' ? message.targetIds : [message.targetId];
        const targets = ids.map((id) => [...players.values()].find((person) => person.id === id));
        if (ids.includes(player.id)) { finish('自分以外の人を選んでください。'); return; }
        if (targets.some((person) => !person)) { finish('選んだ人が退出しました。一覧を確認してください。'); return; }
        const selected = targets as Player[];
        if (selected.some((person) => arena.active(person.id))) { finish('その人は魔法対戦中です。終了後に呼んでください。'); return; }
        if (message.spell === 'call' && selected.some((person) => now - (summonedAt.get(person.id) ?? -Infinity) < SPELLS.call.cooldown)) { finish('その人はコールで移動したばかりです。少し待ってください。'); return; }
        if (message.spell === 'rura' && now - lastWarp < 1000) { finish('少し待ってから移動してください。'); return; }
        const destinationRoom = message.spell === 'call' ? player.roomId : selected[0].roomId;
        if (!roomAllowed(destinationRoom)) { finish('そのフロアは管理者により利用停止中です。'); return; }
        const movers = message.spell === 'call' ? selected : [player];
        const destinations = message.spell === 'call' ? callDestinations(player, selected, players.values(), collisionObjects(destinationRoom)) : callDestinations(selected[0], [player], players.values(), collisionObjects(destinationRoom));
        if (!destinations) { finish('移動先の床を確認できません。相手が少し動いてから試してください。'); return; }
        spellTimes.set(message.spell, now); if (message.spell === 'rura') lastWarp = now;
        for (const [index, mover] of movers.entries()) {
          const client = [...players].find(([, person]) => person.id === mover.id)![0];
          leaveArena(mover.id); leaveArcade(mover.id); Object.assign(mover, destinations[index], { roomId: destinationRoom, facing: 'down' });
          resetBuddy(mover, collisionObjects(destinationRoom)); contacts.get(mover.id)?.(); pending.delete(mover.id);
          movementBlocks.set(mover.id, now + movementStep(mover.riding?.kind)); if (message.spell === 'call') summonedAt.set(mover.id, now);
          broadcast({ type: 'player', player: mover, reason: 'spell' });
          chat.state(client); sendObjects(client, destinationRoom); sendPets(client, destinationRoom); sendRobot(client); sendArcade(client); sendLinks(client, destinationRoom); sendIce(client); sendArena(client);
        }
        directoryDirty = true; voice.refresh();
        const effect: Extract<ServerMessage, { type: 'spell-effect' }> = { type: 'spell-effect', id: randomUUID(), spell: message.spell, casterId: player.id, casterName: player.name, roomId: destinationRoom, origin, destinations, targetIds: movers.map((person) => person.id) };
        for (const [client, person] of players) if (person.roomId === destinationRoom) send(client, effect);
        finish(); return;
      }
      if (message.type === 'dev-world') {
        if (!devClients.has(ws)) { send(ws, { type: 'dev-world-result', actionId: message.actionId, error: 'ローカル開発サーバー専用の操作です。' }); return; }
        if (('roomId' in message && message.roomId && !roomAllowed(message.roomId)) ||
            (message.command === 'event' && !policyAllows(policy, 'incidents', message.episodeId)) ||
            (message.command === 'pokemon' && message.kinds?.some(kind => !pokemonAllowed(kind)))) {
          send(ws, { type: 'dev-world-result', actionId: message.actionId, error: '管理者が禁止している項目は表示できません。' }); return;
        }
        if (now - lastDevWorld < 250) { send(ws, { type: 'dev-world-result', actionId: message.actionId, error: '少し待ってから操作してください。' }); return; }
        lastDevWorld = now; world.apply(message, eventClock());
        if (message.command === 'pokemon' || message.command === 'reset') { pets.replacePokemon(currentRoster(), store.list()); for (const [client, person] of players) sendPets(client, person.roomId); }
        if (message.command === 'lost' || message.command === 'reset') sendLostItems();
        sendDailyEvent(); sendDevWorld(); send(ws, { type: 'dev-world-result', actionId: message.actionId }); return;
      }
      if (message.type === 'birthday-thread') {
        try {
          const thread = birthdays.thread(message.id, message.date); birthdayThreads.set(ws, { id: message.id, date: message.date });
          send(ws, { type: 'birthday-thread', ...thread });
        } catch (error) { send(ws, { type: 'birthday-result', actionId: message.actionId, error: error instanceof BirthdayError ? error.message : 'コメントを読み込めませんでした。' }); }
        return;
      }
      if (message.type === 'birthday-save' || message.type === 'birthday-delete' || message.type === 'birthday-cheer' || message.type === 'birthday-comment') {
        if (now - lastBirthday < 750) { send(ws, { type: 'birthday-result', actionId: message.actionId, error: '少し待ってから操作してください。' }); return; }
        lastBirthday = now;
        void birthdays.apply(message, birthdayOwner(player), player.name, () => players.has(ws) && (!identity || auth?.identify(request)?.id === identity.id)).then(() => {
          if (message.type !== 'birthday-comment') sendBirthdays();
          sendBirthdayThreads(); send(ws, { type: 'birthday-result', actionId: message.actionId });
        }).catch((error: unknown) => send(ws, { type: 'birthday-result', actionId: message.actionId, error: error instanceof BirthdayError ? error.message : '誕生日を保存できませんでした。時間をおいて試してください。' }));
        return;
      }
      if (message.type === 'arcade-action') {
        if (arcadeRequests.has(message.actionId)) return;
        arcadeRequests.add(message.actionId);
        if (arcadeRequests.size > 100) arcadeRequests.delete(arcadeRequests.values().next().value!);
        if (player.roomId === 'arcade' && arcade.tick(now)) sendArcade();
        const error = player.roomId !== 'arcade' ? 'ゲームセンターで遊んでください。' : arcade.apply(message, player, now);
        // Rejected input must not amplify traffic to every spectator.
        if (player.roomId === 'arcade') sendArcade(error ? ws : undefined);
        send(ws, { type: 'arcade-result', actionId: message.actionId, ...(error ? { error } : {}) }); return;
      }
      if (message.type === 'robot-action') {
        const error = player.roomId !== 'cockpit' ? '操縦室で試してください。' : now - lastRobot < 500 ? '少し待ってから操作してください。' : !robot.start(message.action, player.name, now) ? 'ただいま演出中です。終了したら次の操作を試せます。' : undefined;
        lastRobot = now; if (!error) sendRobot();
        send(ws, { type: 'robot-result', actionId: message.actionId, ...(error ? { error } : {}) }); return;
      }
      if (message.type === 'announcement-publish' || message.type === 'announcement-dismiss' || message.type === 'schedule-save' || message.type === 'schedule-delete') {
        if (now - lastAnnouncementEdit < 350 || message.type === 'announcement-publish' && now - lastPublish < 10_000) {
          send(ws, { type: 'announcement-result', actionId: message.actionId, error: '少し待ってから、もう一度設定してください。放送の間隔は10秒です。' }); return;
        }
        lastAnnouncementEdit = now; if (message.type === 'announcement-publish') lastPublish = now;
        void announcements.apply(message, player.name, () => players.has(ws) && (!identity || auth?.identify(request)?.id === identity.id)).then((changed) => {
          if (changed) sendAnnouncements();
          send(ws, { type: 'announcement-result', actionId: message.actionId });
        }).catch((error: unknown) => send(ws, { type: 'announcement-result', actionId: message.actionId, error: error instanceof AnnouncementError ? error.message : '放送・予定を保存できませんでした。時間をおいて試してください。' }));
        return;
      }
      if (message.type === 'vehicle-take' || message.type === 'vehicle-return' || message.type === 'vehicle-drop' || message.type === 'vehicle-pickup') {
        if (player.resting) { send(ws, { type: 'vehicle-result', actionId: message.actionId, error: '起き上がってから、乗りものを使ってください。' }); return; }
        if (arena.active(player.id)) { send(ws, { type: 'vehicle-result', actionId: message.actionId, error: '対戦中は乗りものを使えません。' }); return; }
        if (vehicleResults.has(message.actionId)) {
          const error = vehicleResults.get(message.actionId); send(ws, { type: 'vehicle-result', actionId: message.actionId, ...(error ? { error } : {}) }); return;
        }
        if (now - lastVehicle < 350) { send(ws, { type: 'vehicle-result', actionId: message.actionId, error: '少し待ってから、もう一度操作してください。' }); return; }
        lastVehicle = now;
        const error = message.type === 'vehicle-take' ? fleet.take(player, message.kind)
          : message.type === 'vehicle-pickup' ? fleet.pickup(player, message.unitId)
          : message.type === 'vehicle-drop' ? fleet.drop(player) : fleet.return(player);
        vehicleResults.set(message.actionId, error);
        if (vehicleResults.size > 128) vehicleResults.delete(vehicleResults.keys().next().value!);
        if (!error) { pending.delete(player.id); broadcast({ type: 'player', player, reason: 'vehicle' }); sendFleet(); }
        send(ws, { type: 'vehicle-result', actionId: message.actionId, ...(error ? { error } : {}) });
        return;
      }
      if (message.type === 'rest') {
        if (message.resting && player.riding) { send(ws, { type: 'rest-result', error: '乗りものから降りてから、寝転んでください。' }); return; }
        const changed = !!player.resting !== message.resting;
        player.resting = message.resting;
        // A full state update supersedes any queued step. Rest has no timer and
        // only this explicit action changes it; late arrivals get it in welcome.
        pending.delete(player.id);
        if (changed) broadcast({ type: 'player', player, reason: 'rest' });
        else send(ws, { type: 'player', player, reason: 'rest' });
        send(ws, { type: 'rest-result' }); return;
      }
      if (message.type === 'reaction') {
        if (player.resting) return;
        if (now - lastReaction < REACTION_COOLDOWN_MS) return;
        lastReaction = now;
        // Deliver the actor's last step first so a coalesced movement frame
        // cannot arrive after the gesture and immediately cancel it for peers.
        const position = pending.get(player.id);
        if (position) { broadcast({ type: 'positions', positions: [position] }); pending.delete(player.id); }
        for (const [client, person] of players) if (person.roomId === player.roomId) {
          send(client, { type: 'reaction', playerId: player.id, roomId: player.roomId, kind: message.kind });
        }
        return;
      }
      if (message.type === 'voice-state') { voice.state(ws, message); return; }
      if (message.type === 'voice-signal') { voice.signal(ws, message); return; }
      if (message.type === 'favorite-add' || message.type === 'object-links-set') {
        if (now - lastLinkEdit < 350) { send(ws, { type: 'link-result', editId: message.editId, error: '少し待ってから、もう一度保存してください。' }); return; }
        lastLinkEdit = now;
        const roomId = player.roomId;
        const owner = playerIdentity(player);
        void links.transact((state) => {
          if (!players.has(ws) || player.roomId !== roomId || (identity && auth?.identify(request)?.id !== identity.id)) throw new EditError('接続または部屋が変わったため、操作を取り消しました。');
          // Discard bindings left by removed furniture before applying a new edit.
          const liveTargets = new Set(ROOMS.flatMap((room) => objectTargets(room.id, store.list()).map((o) => `${room.id}:${o.id}`)));
          state.bindings = state.bindings.filter((b) => liveTargets.has(`${b.roomId}:${b.objectId}`));
          if (message.type === 'favorite-add') {
            const existing = state.favorites.find((f) => f.url === message.url);
            if (existing) return existing.id;
            if (state.favorites.length >= MAX_FAVORITES) throw new EditError(`共有のお気に入りは${MAX_FAVORITES}件まで登録できます。`);
            const id = randomUUID(); state.favorites.push({ id, title: message.title, url: message.url }); return id;
          }
          const target = objectTargets(roomId, store.list()).find((o) => o.id === message.objectId);
          if (!target) throw new EditError('そのオブジェクトは見つかりません。');
          if (target.owner && target.owner !== owner) throw new EditError('配置した本人だけが、この家具のリンクを変更できます。');
          if (message.linkIds.some((id) => !state.favorites.some((f) => f.id === id))) throw new EditError('選択したお気に入りが見つかりません。');
          state.bindings = state.bindings.filter((b) => b.roomId !== roomId || b.objectId !== message.objectId);
          if (message.linkIds.length) state.bindings.push({ roomId, objectId: message.objectId, linkIds: [...message.linkIds] });
        }).then((favoriteId) => {
          for (const [client, person] of players) if (message.type === 'favorite-add' || person.roomId === roomId) sendLinks(client, person.roomId);
          send(ws, { type: 'link-result', editId: message.editId, ...(favoriteId ? { favoriteId } : {}) });
        }).catch((error: unknown) => send(ws, { type: 'link-result', editId: message.editId,
          error: error instanceof EditError ? error.message : 'リンクを保存できませんでした。時間をおいて試してください。' }));
        return;
      }
      if (message.type === 'warp-to') {
        const fail = (error: string) => send(ws, { type: 'travel-error', requestId: message.requestId, error });
        if (now - lastWarp < 1000) { fail('少し待ってから、もう一度ワープしてください。'); return; }
        lastWarp = now;
        const target = [...players.values()].find((p) => p.id === message.targetId);
        if (!target) { fail('その人は現在オフラインです。'); return; }
        if (!roomAllowed(target.roomId)) { fail('そのフロアは管理者により利用停止中です。'); return; }
        if (target.id === player.id) { fail('自分の隣へはワープできません。'); return; }
        if (arena.active(player.id) || arena.active(target.id)) { fail('対戦中はワープできません。'); return; }
        leaveArena(player.id);
        const destination = adjacentTile(target, player.id, players.values(), collisionObjects(target.roomId));
        if (!destination) { fail('相手の隣に空いているマスがありません。少し待ってから試してください。'); return; }
        if (target.roomId !== player.roomId) leaveArcade(player.id);
        Object.assign(player, destination, { roomId: target.roomId, facing: 'down' });
        resetBuddy(player, collisionObjects(player.roomId));
        contact();
        pending.delete(player.id);
        broadcast({ type: 'player', player, reason: 'warp', requestId: message.requestId });
        sendObjects(ws, player.roomId);
        sendPets(ws, player.roomId);
        sendRobot(ws);
        sendArcade(ws);
        chat.state(ws); sendLinks(ws, player.roomId); sendIce(ws); sendArena(ws);
        directoryDirty = true;
        voice.refresh();
        lastMove = now;
        return;
      }
      if (message.type === 'object-place' || message.type === 'object-move' || message.type === 'object-remove') {
        if (player.roomId === 'arena') { send(ws, { type: 'object-result', editId: message.editId, error: '闘技場は固定レイアウトです。' }); return; }
        if (now - lastEdit < 350) { send(ws, { type: 'object-result', editId: message.editId, error: '少し待ってから、もう一度操作してください。' }); return; }
        lastEdit = now;
        const roomId = player.roomId;
        const owner = playerIdentity(player);
        void store.transact((objects) => {
          if (!players.has(ws) || player.roomId !== roomId || (identity && auth?.identify(request)?.id !== identity.id)) throw new EditError('部屋が変わったため操作を取り消しました。');
          const existing = 'id' in message ? objects.find((o) => o.id === message.id) : undefined;
          if (message.type !== 'object-place' && (!existing || existing.roomId !== roomId || existing.owner !== owner)) throw new EditError('自分が置いた家具・小物だけを編集できます。');
          if (message.type === 'object-remove') { objects.splice(objects.indexOf(existing!), 1); return; }
          const candidate = { id: existing?.id ?? randomUUID(), owner, roomId, kind: message.type === 'object-place' ? message.kind : existing!.kind,
            x: message.x, y: message.y, rotation: message.rotation };
          const error = placementProblem(candidate, [...objects, ...ice.objects(now)], [...players.values()]);
          if (error) throw new EditError(error);
          if (existing) objects.splice(objects.indexOf(existing), 1, candidate);
          else objects.push(candidate);
        }).then(() => {
          for (const [client, person] of players) if (person.roomId === roomId) sendObjects(client, roomId);
          sendLostItems();
          for (const person of players.values()) if (person.roomId === roomId && person.buddyPosition && !walkableWithObjects(person.buddyPosition.x, person.buddyPosition.y, roomId, roomObjects(roomId))) {
            resetBuddy(person, roomObjects(roomId)); pending.delete(person.id); broadcast({ type: 'player', player: person, reason: 'profile' });
          }
          send(ws, { type: 'object-result', editId: message.editId });
        }).catch((error: unknown) => send(ws, { type: 'object-result', editId: message.editId,
          error: error instanceof EditError ? error.message : '家具・小物を保存できませんでした。時間をおいて試してください。' }));
        return;
      }
      if (message.type === 'profile') {
        player.name = identity?.user.name ?? message.name;
        player.outfit = message.outfit;
        player.appearance = message.appearance;
        const buddy = message.buddy && isPokemonKind(message.buddy) && !pokemonAllowed(message.buddy) ? null : message.buddy;
        if (buddy !== undefined && (buddy !== player.buddy || (buddy && !player.buddyPosition))) { player.buddy = buddy; resetBuddy(player, collisionObjects(player.roomId)); }
        pending.delete(player.id);
        player.slack = identity ? identity.user.slack ?? null : message.slack ?? null;
      } else if (message.type === 'change-room') {
        if (!roomAllowed(message.roomId)) {
          send(ws, { type: 'player', player, reason: 'room', requestId: message.requestId });
          send(ws, { type: 'travel-error', requestId: message.requestId, error: 'そのフロアは管理者により利用停止中です。' }); return;
        }
        leaveArena(player.id);
        if (message.roomId !== player.roomId) leaveArcade(player.id);
        player.roomId = message.roomId;
        chat.state(ws);
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        resetBuddy(player, collisionObjects(player.roomId));
        contact();
        pending.delete(player.id);
        broadcast({ type: 'player', player, reason: 'room', requestId: message.requestId });
        sendObjects(ws, player.roomId);
        sendPets(ws, player.roomId);
        sendRobot(ws);
        sendArcade(ws);
        chat.state(ws); sendLinks(ws, player.roomId); sendIce(ws); sendArena(ws);
        directoryDirty = true;
        voice.refresh();
        lastMove = now;
        return;
      } else if (message.type === 'reset') {
        leaveArena(player.id);
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        resetBuddy(player, collisionObjects(player.roomId));
        lastMove = now;
      } else {
        if (player.resting) { send(ws, { type: 'player', player, reason: message.type, requestId: message.requestId }); return; }
        player.facing = message.direction;
        const [dx, dy] = vectors[message.direction];
        if (now >= (movementBlocks.get(player.id) ?? 0) && now - lastMove >= movementStep(player.riding?.kind) && (message.type !== 'dash' || now - lastDash >= DASH_COOLDOWN_MS)) {
          for (let step = 0; step < (message.type === 'dash' ? DASH_TILES : 1); step++) {
            if (!walkableWithObjects(player.x + dx, player.y + dy, player.roomId, collisionObjects(player.roomId))) break;
            const previous = { x: player.x, y: player.y }; player.x += dx; player.y += dy; advanceBuddy(player, previous);
          }
          lastMove = now;
          if (message.type === 'dash') { lastDash = now; movementBlocks.set(player.id, now + DASH_MS); }
        }
      }
      if (message.type !== 'profile') contact();
      if (message.type === 'profile') { chat.profile(ws); broadcast({ type: 'player', player, reason: 'profile' }); directoryDirty = true; }
      else {
        // Immediate authoritative acknowledgment keeps local movement responsive.
        send(ws, { type: 'player', player, reason: message.type, requestId: message.requestId });
        const position: Position = [player.slot, player.x, player.y, directions.indexOf(player.facing) |
          (message.type === 'reset' || ((pending.get(player.id)?.[3] ?? 0) & 4) ? 4 : 0) | (message.type === 'dash' ? 8 : 0)];
        if (player.buddyPosition) position.push(player.buddyPosition.x, player.buddyPosition.y, directions.indexOf(player.buddyPosition.facing));
        pending.set(player.id, position);
        voice.markDirty();
      }
    });
    ws.on('close', () => {
      leaveArena(player.id);
      leaveArcade(player.id);
      const hadVehicle = !!player.riding; fleet.forget(player);
      players.delete(ws);
      contacts.delete(player.id); movementBlocks.delete(player.id); summonedAt.delete(player.id);
      chat.leave(ws);
      birthdayThreads.delete(ws);
      if (!identity) void birthdays.removeGuest(birthdayOwner(player)).then(() => { sendBirthdays(); sendBirthdayThreads(); }).catch(() => {});
      if (hadVehicle) sendFleet();
      directoryDirty = true;
      identities.delete(ws);
      requests.delete(ws);
      devClients.delete(ws);
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
    clearInterval(lostTimer);
    clearInterval(combatTimer);
    clearInterval(birthdayTimer);
    clearInterval(arcadeTimer);
    clearInterval(robotTimer);
    clearInterval(dailyEventTimer);
    clearInterval(announcementTimer);
    clearInterval(heartbeat);
    clearInterval(frame);
    clearInterval(petTimer);
    unsubscribe?.();
    server.off('upgrade', upgrade);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
    chat.close();
  };
}
