import { lostItemsSnapshot, lostItemPeriod } from '../src/game/lost-items.ts';
import { BirthdayStore, BirthdayError } from './birthdays.ts';
import { birthdayDay } from '../src/game/birthdays.ts';
import { ArcadeRoom } from './arcade.ts';
import { RobotSimulation } from './robot.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
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
import type { SlackAuth } from './auth.ts';
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

export function attachOffice(server: Server, auth?: SlackAuth, options: { objectsFile?: string; membersFile?: string; linksFile?: string; announcementsFile?: string; birthdaysFile?: string; birthdayClock?: () => number; eventClock?: () => number; lostClock?: () => number } = {}): () => void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  const players = new Map<WebSocket, Player>();
  const store = new ObjectStore(options.objectsFile);
  const members = new MemberStore(options.membersFile);
  const links = new LinkStore(options.linksFile);
  const announcements = new AnnouncementStore(options.announcementsFile);
  const birthdayClock = options.birthdayClock ?? Date.now;
  const birthdays = new BirthdayStore(options.birthdaysFile, birthdayClock);
  const birthdayOwner = (player: Player) => player.slackVerified && player.slack ? `slack:${player.slack.teamId}:${player.slack.userId}` : `guest:${player.id}`;
  let announcementWarning: string | undefined;
  let directoryDirty = false;
  let directoryWarning: string | undefined;
  const alive = new Set<WebSocket>();
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
  let lostState = lostItemsSnapshot(lostClock(), store.list());
  let lostPeriod = lostItemPeriod(lostState.serverNow);
  const sendLostItems = (ws?: WebSocket): void => {
    const now = lostClock();
    if (ws && lostItemPeriod(now) !== lostPeriod) { sendLostItems(); return; }
    if (!ws) { lostPeriod = lostItemPeriod(now); lostState = lostItemsSnapshot(now, store.list()); }
    const message: ServerMessage = { type: 'lost-items', ...lostState, serverNow: now };
    if (ws) send(ws, message); else broadcast(message);
  };
  const lostTimer = setInterval(() => { if (lostItemPeriod(lostClock()) !== lostPeriod) sendLostItems(); }, 1000); lostTimer.unref();
  const eventClock = options.eventClock ?? Date.now;
  let eventDay = dailyEventAt(eventClock()).day;
  const sendDailyEvent = (ws?: WebSocket) => {
    const serverNow = eventClock(), currentEvent = dailyEventAt(serverNow);
    const message: ServerMessage = { type: 'daily-event', event: currentEvent, serverNow };
    if (ws) send(ws, message); else { eventDay = currentEvent.day; broadcast(message); }
  };
  const dailyEventTimer = setInterval(() => {
    if (dailyEventAt(eventClock()).day !== eventDay) sendDailyEvent();
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
  const sendObjects = (ws: WebSocket, roomId: RoomId) => send(ws, { type: 'objects', roomId, objects: roomObjects(roomId) });
  const pets = new RoomPets();
  const sendPets = (ws: WebSocket, roomId: RoomId) => send(ws, { type: 'pets', roomId, pets: pets.list(roomId) });
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
    const objects = roomObjects(roomId);
    const occupied = new Set([...players].filter(([ws, player]) => ws !== except && player.roomId === roomId).map(([, { x, y }]) => `${x},${y}`));
    const tiles = [];
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (walkableWithObjects(x, y, roomId, objects) && !occupied.has(`${x},${y}`)) tiles.push({ x, y });
    }
    tiles.sort((a, b) => (Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y)) -
      (Math.abs(b.x - origin.x) + Math.abs(b.y - origin.y)));
    return tiles[0] ?? origin;
  };

  const identities = new Map<WebSocket, string>();
  let nextSlot = 0;
  const unsubscribe = auth?.onRevoke((id) => {
    for (const [ws, session] of identities) if (session === id) ws.close(4001, 'Session ended');
  });
  wss.on('connection', (ws, request) => {
    const identity = auth?.identify(request);
    if (identity) identities.set(ws, identity.id);
    const player: Player = { id: randomUUID(), slot: ++nextSlot, name: identity?.user.name ?? 'ゲスト', outfit: 0, appearance: { ...DEFAULT_APPEARANCE }, roomId: 'office',
      slack: identity?.user.slack ?? null, slackVerified: !!identity, ...spawn(), facing: 'down' };
    players.set(ws, player);
    directoryDirty = true;
    if (identity) void members.remember(identity.user).then(() => {
      directoryWarning = undefined; directoryDirty = true;
    }).catch(() => {
      directoryWarning = 'メンバー情報を保存できませんでした。再接続後に表示が残らない場合があります。'; directoryDirty = true;
    });
    alive.add(ws);
    send(ws, { type: 'welcome', id: player.id, players: [...players.values()] });
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
    const vehicleResults = new Map<string, string | undefined>();
    let lastVending: string | undefined;
    const contact = () => {
      if (fleet.touch(player)) { pending.delete(player.id); broadcast({ type: 'player', player, reason: 'vehicle' }); sendFleet(); }
      const machine = vendingInReach(player);
      if (machine && machine !== lastVending && player.appearance?.heldItem !== 2) {
        player.appearance = { ...(player.appearance ?? DEFAULT_APPEARANCE), heldItem: 2 };
        pending.delete(player.id); broadcast({ type: 'player', player, reason: 'vending' });
      }
      lastVending = machine;
    };
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
      if (message.type === 'birthday-save' || message.type === 'birthday-delete' || message.type === 'birthday-cheer') {
        if (now - lastBirthday < 750) { send(ws, { type: 'birthday-result', actionId: message.actionId, error: '少し待ってから操作してください。' }); return; }
        lastBirthday = now;
        void birthdays.apply(message, birthdayOwner(player), player.name, () => players.has(ws) && (!identity || auth?.identify(request)?.id === identity.id)).then(() => {
          sendBirthdays(); send(ws, { type: 'birthday-result', actionId: message.actionId });
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
      if (message.type === 'reaction') {
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
        const owner = identity ? `slack:${identity.user.slack.teamId}:${identity.user.slack.userId}` : `guest:${player.id}`;
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
        if (target.id === player.id) { fail('自分の隣へはワープできません。'); return; }
        const destination = adjacentTile(target, player.id, players.values(), roomObjects(target.roomId));
        if (!destination) { fail('相手の隣に空いているマスがありません。少し待ってから試してください。'); return; }
        if (target.roomId !== player.roomId) leaveArcade(player.id);
        Object.assign(player, destination, { roomId: target.roomId, facing: 'down' });
        resetBuddy(player, roomObjects(player.roomId));
        contact();
        pending.delete(player.id);
        broadcast({ type: 'player', player, reason: 'warp', requestId: message.requestId });
        sendObjects(ws, player.roomId);
        sendPets(ws, player.roomId);
        sendRobot(ws);
        sendArcade(ws);
        sendLinks(ws, player.roomId);
        directoryDirty = true;
        voice.refresh();
        lastMove = now;
        return;
      }
      if (message.type === 'object-place' || message.type === 'object-move' || message.type === 'object-remove') {
        if (now - lastEdit < 350) { send(ws, { type: 'object-result', editId: message.editId, error: '少し待ってから、もう一度操作してください。' }); return; }
        lastEdit = now;
        const roomId = player.roomId;
        const owner = identity ? `slack:${identity.user.slack.teamId}:${identity.user.slack.userId}` : `guest:${player.id}`;
        void store.transact((objects) => {
          if (!players.has(ws) || player.roomId !== roomId || (identity && auth?.identify(request)?.id !== identity.id)) throw new EditError('部屋が変わったため操作を取り消しました。');
          const existing = 'id' in message ? objects.find((o) => o.id === message.id) : undefined;
          if (message.type !== 'object-place' && (!existing || existing.roomId !== roomId || existing.owner !== owner)) throw new EditError('自分が置いた家具・小物だけを編集できます。');
          if (message.type === 'object-remove') { objects.splice(objects.indexOf(existing!), 1); return; }
          const candidate = { id: existing?.id ?? randomUUID(), owner, roomId, kind: message.type === 'object-place' ? message.kind : existing!.kind,
            x: message.x, y: message.y, rotation: message.rotation };
          const error = placementProblem(candidate, objects, [...players.values()]);
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
        if (message.buddy !== undefined && (message.buddy !== player.buddy || (message.buddy && !player.buddyPosition))) { player.buddy = message.buddy; resetBuddy(player, roomObjects(player.roomId)); }
        pending.delete(player.id);
        player.slack = identity?.user.slack ?? message.slack ?? null;
      } else if (message.type === 'change-room') {
        if (message.roomId !== player.roomId) leaveArcade(player.id);
        player.roomId = message.roomId;
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        resetBuddy(player, roomObjects(player.roomId));
        contact();
        pending.delete(player.id);
        broadcast({ type: 'player', player, reason: 'room', requestId: message.requestId });
        sendObjects(ws, player.roomId);
        sendPets(ws, player.roomId);
        sendRobot(ws);
        sendArcade(ws);
        sendLinks(ws, player.roomId);
        directoryDirty = true;
        voice.refresh();
        lastMove = now;
        return;
      } else if (message.type === 'reset') {
        Object.assign(player, spawn(player.roomId, ws), { facing: 'down' });
        resetBuddy(player, roomObjects(player.roomId));
        lastMove = now;
      } else {
        player.facing = message.direction;
        const [dx, dy] = vectors[message.direction];
        if (now - lastMove >= movementStep(player.riding?.kind) && walkableWithObjects(player.x + dx, player.y + dy, player.roomId, roomObjects(player.roomId))) {
          const previous = { x: player.x, y: player.y };
          player.x += dx;
          player.y += dy;
          advanceBuddy(player, previous);
          lastMove = now;
        }
      }
      if (message.type !== 'profile') contact();
      if (message.type === 'profile') { broadcast({ type: 'player', player, reason: 'profile' }); directoryDirty = true; }
      else {
        // Immediate authoritative acknowledgment keeps local movement responsive.
        send(ws, { type: 'player', player, reason: message.type, requestId: message.requestId });
        const position: Position = [player.slot, player.x, player.y, directions.indexOf(player.facing) |
          (message.type === 'reset' || ((pending.get(player.id)?.[3] ?? 0) & 4) ? 4 : 0)];
        if (player.buddyPosition) position.push(player.buddyPosition.x, player.buddyPosition.y, directions.indexOf(player.buddyPosition.facing));
        pending.set(player.id, position);
        voice.markDirty();
      }
    });
    ws.on('close', () => {
      leaveArcade(player.id);
      const hadVehicle = !!player.riding; fleet.forget(player);
      players.delete(ws);
      if (!identity) void birthdays.removeGuest(birthdayOwner(player)).then(() => sendBirthdays()).catch(() => {});
      if (hadVehicle) sendFleet();
      directoryDirty = true;
      identities.delete(ws);
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
  };
}
