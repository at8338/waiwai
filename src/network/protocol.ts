import { parsePolicyAction } from '../game/world-policy.ts';
import type { PolicyAction, PolicySnapshot } from '../game/world-policy.ts';
import { parseChatAction } from '../game/chat.ts';
import type { ChatAction, ChatEvent } from '../game/chat.ts';
import type { LostItemsSnapshot } from '../game/lost-items.ts';
import { parseSpellAction } from '../game/spells.ts';
import type { SpellAction, SpellEffect, SpellKind } from '../game/spells.ts';
import type { ArenaAction, ArenaState, IceSnapshot } from '../game/arena.ts';
import { parseDevWorldAction } from '../game/dev-world.ts';
import type { DevWorldAction, DevWorldSnapshot } from '../game/dev-world.ts';
import { parseBirthdayAction } from '../game/birthdays.ts';
import type { BirthdayAction, BirthdaySnapshot, BirthdayThread } from '../game/birthdays.ts';
import { parseArcadeAction } from '../game/arcade.ts';
import type { ArcadeAction, ArcadeSnapshot } from '../game/arcade.ts';
import { isRobotAction } from '../game/robot.ts';
import type { RobotAction, RobotSnapshot } from '../game/robot.ts';
import type { DailyEventSnapshot } from '../game/daily-events.ts';
import { parseAnnouncementAction, validAnnouncementId } from '../game/announcements.ts';
import type { AnnouncementAction, AnnouncementSnapshot } from '../game/announcements.ts';
import { isVehicleKind, isVehicleId } from '../game/transport.ts';
import type { Riding, VehicleAction, VehicleUnit } from '../game/transport.ts';
import { isBuddyKind } from '../game/buddies.ts';
import type { BuddyKind, BuddyPosition, RoomPet } from '../game/buddies.ts';
import { parseAppearance } from '../game/avatar.ts';
import type { Appearance } from '../game/avatar.ts';
import { isRoomId } from '../game/rooms.ts';
import type { RoomId } from '../game/rooms.ts';
import type { Person } from '../game/directory.ts';
import { parseFavorite, MAX_OBJECT_LINKS, validObjectId, validLinkId } from '../game/object-links.ts';
import type { Favorite, LinkBinding, LinkEdit } from '../game/object-links.ts';
import { isObjectKind } from '../game/objects.ts';
import type { ObjectKind, RoomObject } from '../game/objects.ts';
import type { Direction } from '../game/world.ts';
import type { VoicePayload, VoiceSignal, VoiceSnapshot } from '../audio/protocol.ts';
import { parseVoicePayload } from '../audio/protocol.ts';
import type { SlackIdentity } from '../slack/dm.ts';
import { parseSlackIdentity } from '../slack/dm.ts';
import { isReactionKind } from '../game/reactions.ts';
import type { ReactionKind } from '../game/reactions.ts';

export type Profile = { name: string; outfit: number; appearance?: Appearance; buddy?: BuddyKind | null; slack?: SlackIdentity | null };
export type Player = Profile & { id: string; slot: number; roomId: RoomId; x: number; y: number; facing: Direction; slackVerified?: boolean; accountId?: string; buddyPosition?: BuddyPosition; riding?: Riding; resting?: boolean };
// Profiles travel only on join/edit; movement is coalesced into one frame per 50ms.
// Small numeric slot maps to a UUID in the welcome/join profile. Bits 0–1 are
// direction; bit 2 means snap/reset. UUIDs and identities stay out of frames.
export type Position = [slot: number, x: number, y: number, flags: number, buddyX?: number, buddyY?: number, buddyFacing?: number];
export const MAX_PLAYERS = 150;
export const POSITION_FRAME_MS = 50;
export type ClientMessage =
  | PolicyAction
  | ChatAction
  | ArenaAction
  | SpellAction
  | DevWorldAction
  | BirthdayAction
  | ArcadeAction
  | { type: 'robot-action'; action: RobotAction; actionId: string }
  | AnnouncementAction
  | (VehicleAction & { actionId: string })
  | LinkEdit
  | { type: 'reaction'; kind: ReactionKind }
  | { type: 'rest'; resting: boolean }
  | { type: 'warp-to'; targetId: string; requestId: number }
  | { type: 'change-room'; roomId: RoomId; requestId: number }
  | { type: 'object-place'; kind: ObjectKind; x: number; y: number; rotation: number; editId: string }
  | { type: 'object-move'; id: string; x: number; y: number; rotation: number; editId: string }
  | { type: 'object-remove'; id: string; editId: string }
  | { type: 'voice-state'; listening: boolean; microphone: boolean }
  | { type: 'voice-signal'; to: string; session: string; payload: VoicePayload }
  | ({ type: 'profile' } & Profile)
  | { type: 'move'; direction: Direction; requestId: number }
  | { type: 'dash'; direction: Direction; requestId: number }
  | { type: 'reset'; requestId: number };
export type ServerMessage =
  | ({ type: 'world-policy' } & PolicySnapshot)
  | { type: 'policy-result'; actionId: string; error?: string }
  | ChatEvent
  | ({ type: 'birthday-thread' } & BirthdayThread)
  | ({ type: 'ice-state' } & IceSnapshot)
  | { type: 'arena-state'; state: ArenaState; serverNow: number }
  | { type: 'arena-result'; actionId: string; error?: string }
  | ({ type: 'spell-effect' } & SpellEffect)
  | { type: 'spell-result'; actionId: string; spell: SpellKind; error?: string }
  | ({ type: 'dev-world-state' } & DevWorldSnapshot)
  | { type: 'dev-world-result'; actionId: string; error?: string }
  | ({ type: 'birthdays' } & BirthdaySnapshot)
  | { type: 'birthday-result'; actionId: string; error?: string }
  | ({ type: 'lost-items' } & LostItemsSnapshot)
  | ({ type: 'arcade-state' } & ArcadeSnapshot)
  | { type: 'arcade-result'; actionId: string; error?: string }
  | ({ type: 'robot-state' } & RobotSnapshot)
  | { type: 'robot-result'; actionId: string; error?: string }
  | ({ type: 'daily-event' } & DailyEventSnapshot)
  | ({ type: 'announcements'; warning?: string } & AnnouncementSnapshot)
  | { type: 'announcement-result'; actionId: string; error?: string }
  | { type: 'vehicles'; units: VehicleUnit[] }
  | { type: 'vehicle-result'; actionId: string; error?: string }
  | { type: 'pets'; roomId: RoomId; pets: RoomPet[] }
  | VoiceSnapshot
  | VoiceSignal
  | { type: 'reaction'; playerId: string; roomId: RoomId; kind: ReactionKind }
  | { type: 'rest-result'; error?: string }
  | { type: 'object-links'; roomId: RoomId; favorites: Favorite[]; bindings: LinkBinding[] }
  | { type: 'link-result'; editId: string; error?: string; favoriteId?: string }
  | { type: 'directory'; people: Person[]; warning?: string }
  | { type: 'travel-error'; requestId: number; error: string }
  | { type: 'welcome'; id: string; players: Player[] }
  | { type: 'objects'; roomId: RoomId; objects: RoomObject[] }
  | { type: 'object-result'; editId: string; error?: string }
  | { type: 'positions'; positions: Position[] }
  | { type: 'player'; player: Player; reason: 'join' | 'profile' | 'move' | 'dash' | 'reset' | 'room' | 'warp' | 'spell' | 'vehicle' | 'vending' | 'rest' | 'policy'; requestId?: number }
  | { type: 'left'; id: string };

export const directions = ['up', 'down', 'left', 'right'] as const;
export function normalizeName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 12) || 'ゲスト';
}

export function parseClientMessage(raw: string): ClientMessage | undefined {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return; }
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  const policy = parsePolicyAction(data); if (policy) return policy;
  if (data.type === 'arena-action' && (data.command === 'join' || data.command === 'leave') && validAnnouncementId(data.actionId)) return { type: 'arena-action', command: data.command, actionId: data.actionId };
  const chat = parseChatAction(data); if (chat) return chat;
  const spell = parseSpellAction(data); if (spell) return spell;
  const dev = parseDevWorldAction(data); if (dev) return dev;
  const birthday = parseBirthdayAction(data); if (birthday) return birthday;
  if (data.type === 'robot-action' && isRobotAction(data.action) && validAnnouncementId(data.actionId)) return { type: 'robot-action', action: data.action, actionId: data.actionId };
  const arcade = parseArcadeAction(data); if (arcade) return arcade;
  const announcement = parseAnnouncementAction(data); if (announcement) return announcement;
  if (typeof data.actionId === 'string' && /^[a-f0-9-]{36}$/.test(data.actionId)) {
    if (data.type === 'vehicle-take' && isVehicleKind(data.kind)) return { type: 'vehicle-take', kind: data.kind, actionId: data.actionId };
    if (data.type === 'vehicle-return' || data.type === 'vehicle-drop') return { type: data.type, actionId: data.actionId };
    if (data.type === 'vehicle-pickup' && isVehicleId(data.unitId)) return { type: 'vehicle-pickup', unitId: data.unitId, actionId: data.actionId };
  }
  if (data.type === 'reaction' && isReactionKind(data.kind)) return { type: 'reaction', kind: data.kind };
  if (data.type === 'rest' && typeof data.resting === 'boolean') return { type: 'rest', resting: data.resting };
  if (data.type === 'voice-state' && typeof data.listening === 'boolean' && typeof data.microphone === 'boolean') {
    return { type: 'voice-state', listening: data.listening, microphone: data.listening && data.microphone };
  }
  if (data.type === 'voice-signal' && typeof data.to === 'string' && data.to.length <= 64 &&
      typeof data.session === 'string' && data.session.length <= 64) {
    const payload = parseVoicePayload(data.payload);
    if (payload) return { type: 'voice-signal', to: data.to, session: data.session, payload };
    return;
  }
  const validRequest = Number.isSafeInteger(data.requestId) && (data.requestId as number) > 0;
  if (data.type === 'warp-to' && typeof data.targetId === 'string' && /^[a-f0-9-]{36}$/.test(data.targetId) && validRequest) return { type: 'warp-to', targetId: data.targetId, requestId: data.requestId as number };
  if (data.type === 'change-room' && isRoomId(data.roomId) && validRequest) return { type: 'change-room', roomId: data.roomId, requestId: data.requestId as number };
  if (typeof data.editId === 'string' && /^[a-f0-9-]{36}$/.test(data.editId)) {
    if (data.type === 'favorite-add') {
      const favorite = parseFavorite(data);
      if (favorite) return { type: 'favorite-add', ...favorite, editId: data.editId };
      return;
    }
    if (data.type === 'object-links-set' && validObjectId(data.objectId) && Array.isArray(data.linkIds) &&
        data.linkIds.length <= MAX_OBJECT_LINKS && data.linkIds.every(validLinkId) && new Set(data.linkIds).size === data.linkIds.length) {
      return { type: 'object-links-set', objectId: data.objectId, linkIds: data.linkIds, editId: data.editId };
    }
    const id = typeof data.id === 'string' && /^[a-f0-9-]{36}$/.test(data.id) ? data.id : undefined;
    if (data.type === 'object-remove' && id) return { type: 'object-remove', id, editId: data.editId };
    if (Number.isInteger(data.x) && Number.isInteger(data.y) && (data.x as number) > 0 && (data.x as number) < 29 && (data.y as number) > 0 && (data.y as number) < 19 && Number.isInteger(data.rotation) && (data.rotation as number) >= 0 && (data.rotation as number) < 4) {
      const position = { x: data.x as number, y: data.y as number, rotation: data.rotation as number, editId: data.editId };
      if (data.type === 'object-place' && isObjectKind(data.kind)) return { type: 'object-place', kind: data.kind, ...position };
      if (data.type === 'object-move' && id) return { type: 'object-move', id, ...position };
    }
  }
  if (data.type === 'reset' && validRequest) return { type: 'reset', requestId: data.requestId as number };
  if ((data.type === 'move' || data.type === 'dash') && validRequest && directions.includes(data.direction as Direction)) return { type: data.type, direction: data.direction as Direction, requestId: data.requestId as number };
  if (data.type === 'profile' && typeof data.name === 'string' &&
      Number.isInteger(data.outfit) && (data.outfit as number) >= 0 && (data.outfit as number) <= 2) {
    if (data.buddy !== undefined && data.buddy !== null && !isBuddyKind(data.buddy)) return;
    const appearance = parseAppearance(data.appearance, data.outfit as number);
    if (!appearance) return;
    const slack = parseSlackIdentity(data.slack);
    if (slack === undefined) return;
    return { type: 'profile', name: normalizeName(data.name), outfit: data.outfit as number, appearance, slack, ...(data.buddy !== undefined ? { buddy: data.buddy as BuddyKind | null } : {}) };
  }
}
