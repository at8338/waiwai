import { validAnnouncementId } from './announcements.ts';
import { episodeById } from './daily-event-catalog.ts';
import type { DailyEvent } from './daily-events.ts';
import { isPokemonKind, MAX_DAILY_POKEMON } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
import { isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { isLostItemKind } from './lost-items.ts';
import type { LostItem, LostItemKind } from './lost-items.ts';
export type DevWorldAction = { type: 'dev-world'; actionId: string } & (
  | { command: 'event'; episodeId: string; roomId?: RoomId }
  | { command: 'event-step'; step: -1 | 1 }
  | { command: 'event-random' }
  | { command: 'pokemon'; kinds?: PokemonKind[]; roomId?: RoomId }
  | { command: 'lost'; kind?: LostItemKind; roomId?: RoomId }
  | { command: 'reset' });
export type DevWorldSnapshot = { event: DailyEvent; preview: boolean; pokemon: { kind: PokemonKind; roomId: RoomId }[]; lost: LostItem[] };
export function parseDevWorldAction(data: Record<string, unknown>): DevWorldAction | undefined {
  if (data.type !== 'dev-world' || !validAnnouncementId(data.actionId)) return;
  const base = { type: 'dev-world' as const, actionId: data.actionId };
  const roomId = data.roomId;
  if (roomId !== undefined && !isRoomId(roomId)) return;
  const room = roomId === undefined ? {} : { roomId: roomId as RoomId };
  if (data.command === 'reset' || data.command === 'event-random') return { ...base, command: data.command };
  if (data.command === 'event-step' && (data.step === -1 || data.step === 1)) return { ...base, command: data.command, step: data.step };
  if (data.command === 'event' && typeof data.episodeId === 'string' && episodeById(data.episodeId)) return { ...base, command: data.command, episodeId: data.episodeId, ...room };
  if (data.command === 'lost' && (data.kind === undefined || isLostItemKind(data.kind))) return { ...base, command: data.command, ...(data.kind === undefined ? {} : { kind: data.kind as LostItemKind }), ...room };
  if (data.command === 'pokemon' && (data.kinds === undefined || Array.isArray(data.kinds) && data.kinds.length <= MAX_DAILY_POKEMON && data.kinds.every(isPokemonKind) && new Set(data.kinds).size === data.kinds.length))
    return { ...base, command: data.command, ...(data.kinds === undefined ? {} : { kinds: data.kinds as PokemonKind[] }), ...room };
}
