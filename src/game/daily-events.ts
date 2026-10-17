import { DAILY_EPISODES, episodeById } from './daily-event-catalog.ts';
import { ROOMS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { lostItemsAt } from './lost-items.ts';
import { objectContains, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { touchingVehicleDock } from './transport.ts';
import { seatSpots } from './seating.ts';
export const EVENT_DAY_MS = 86_400_000;
const JST = 9 * 3_600_000;
export const EVENT_JOURNAL_START = Date.UTC(2026, 9, 17) - JST;
const EPOCH = EVENT_JOURNAL_START;
export type DailyEvent = { day: string; episodeId: string; roomId: RoomId; startsAt: number; endsAt: number };
export type DailyEventSnapshot = { event: DailyEvent; serverNow: number; preview?: boolean };
export function previewEventAt(now: number, episodeId: string, roomId?: RoomId): DailyEvent {
  const event = dailyEventAt(now), episode = episodeById(episodeId)!;
  const eligible = ROOMS.filter((room) => episode.theme !== 'kaiju' || room.outlook !== 'none');
  const room = roomId && eligible.some((entry) => entry.id === roomId) ? roomId : eligible[eventHash(`${event.day}:${episodeId}:room`) % eligible.length].id;
  return { ...event, episodeId, roomId: room };
}
export function eventHash(text: string): number {
  let value = 2166136261;
  for (const c of text) value = Math.imul(value ^ c.charCodeAt(0), 16777619) >>> 0;
  return value;
}
const decks = new Map<number, readonly string[]>();
function deck(cycle: number): readonly string[] {
  const cached = decks.get(cycle); if (cached) return cached;
  const ids = DAILY_EPISODES.map((event) => event.id);
  let seed = eventHash(`waiwai-365-v1:${cycle}`);
  for (let i = ids.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1); [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  // Welcome guest on launch day; the remaining 364 episodes retain their shuffled order.
  if (cycle === 0) { const first = ids.indexOf('detective-02'); [ids[0], ids[first]] = [ids[first], ids[0]]; }
  if (decks.size >= 2) decks.delete(decks.keys().next().value!);
  decks.set(cycle, ids); return ids;
}
// A shuffled 365-day deck, independent of process restarts and calendar/leap years.
// Version this seed/epoch with care: changing it changes everybody's current incident.
export function dailyEventAt(now: number): DailyEvent {
  const dayIndex = Math.floor((now - EPOCH) / EVENT_DAY_MS), cycle = Math.floor(dayIndex / 365);
  const index = ((dayIndex % 365) + 365) % 365, episodeId = deck(cycle)[index];
  const startsAt = EPOCH + dayIndex * EVENT_DAY_MS;
  const day = new Date(startsAt + JST).toISOString().slice(0, 10);
  const theme = episodeById(episodeId)!.theme;
  // Existing journal entries keep their original rooms. New rooms join the roster
  // from 2026-10-18 JST, rather than rewriting discoveries already made on launch day.
  const expandedRooms = startsAt >= Date.UTC(2026, 9, 18) - JST;
  const eligible = ROOMS.filter((r) => r.id !== 'cockpit' && r.id !== 'arena' && (expandedRooms || (r.id !== 'project' && r.id !== 'canteen'))
    && (theme !== 'kaiju' || r.outlook !== 'none'));
  const roomId = eligible[eventHash(`${day}:${episodeId}:room`) % eligible.length].id;
  return { day, episodeId, roomId, startsAt, endsAt: startsAt + EVENT_DAY_MS };
}
// Events are decorations, never authoritative movement blockers. Prefer an empty 3x3
// patch away from doors, seats, moving furniture and existing lost-item positions.
export function eventSpot(event: DailyEvent, objects: readonly RoomObject[] = []): { x: number; y: number } | undefined {
  const room = getRoom(event.roomId), seats = seatSpots(event.roomId, objects);
  const lost = lostItemsAt(event.roomId, event.startsAt, objects);
  const clear = (x: number, y: number) => walkableWithObjects(x, y, event.roomId, objects)
    && !objects.some((o) => o.roomId === event.roomId && objectContains(o, x, y))
    && !touchingVehicleDock({ roomId: event.roomId, x, y }) && !seats.has(`${x},${y}`)
    && !lost.some((p) => p.x === x && p.y === y)
    && [room.spawn, room.door].every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 3);
  const spacious: { x: number; y: number }[] = [], small: { x: number; y: number }[] = [];
  for (let y = 4; y <= 16; y++) for (let x = 3; x <= 26; x++) {
    if (!clear(x, y)) continue;
    small.push({ x, y });
    if ([-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => clear(x + dx, y + dy)))) spacious.push({ x, y });
  }
  const spots = spacious.length ? spacious : small;
  return spots[eventHash(`${event.day}:${event.episodeId}:spot`) % spots.length];
}

// The journal starts with this feature's release, rather than inventing older incidents.
export function eventHistory(now: number): DailyEvent[] {
  const today = dailyEventAt(now).startsAt;
  const first = Math.max(EVENT_JOURNAL_START, today - 364 * EVENT_DAY_MS);
  const result: DailyEvent[] = [];
  for (let day = today; day >= first; day -= EVENT_DAY_MS) result.push(dailyEventAt(day));
  return result;
}
