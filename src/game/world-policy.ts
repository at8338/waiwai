import { ROOMS, isRoomId } from './rooms.ts';
import { ROAMING_RESIDENTS } from './buddies.ts';
import { DAILY_EPISODES, episodeById } from './daily-event-catalog.ts';
import { isPokemonKind } from './pokemon.ts';
import { validAnnouncementId } from './announcements.ts';
import type { DailyEvent } from './daily-events.ts';
import type { RoomId } from './rooms.ts';
export const POLICY_GROUPS = ['rooms', 'residents', 'incidents', 'pokemon'] as const;
export type PolicyGroup = typeof POLICY_GROUPS[number];
export type WorldPolicy = { revision: number; blocked: Record<PolicyGroup, string[]>; updatedAt?: number };
export type PolicyAction = { type: 'policy-set'; actionId: string; revision: number; group: PolicyGroup; id: string; allowed: boolean };
export type PolicySnapshot = { policy: WorldPolicy; administrator: boolean };
export const defaultWorldPolicy = (): WorldPolicy => ({ revision: 0, blocked: { rooms: [], residents: [], incidents: [], pokemon: [] } });
export function policyItem(group: PolicyGroup, id: unknown): id is string {
  return typeof id === 'string' && (id === '*' && group !== 'rooms' || (group === 'rooms' ? isRoomId(id) : group === 'residents' ? ROAMING_RESIDENTS.some(p => p.kind === id) : group === 'incidents' ? !!episodeById(id) : isPokemonKind(id)));
}
export function parsePolicyAction(data: Record<string, unknown>): PolicyAction | undefined {
  if (data.type !== 'policy-set' || !validAnnouncementId(data.actionId) || !Number.isSafeInteger(data.revision) || (data.revision as number) < 0 ||
      !POLICY_GROUPS.includes(data.group as PolicyGroup) || !policyItem(data.group as PolicyGroup, data.id) || typeof data.allowed !== 'boolean') return;
  return { type: 'policy-set', actionId: data.actionId, revision: data.revision as number, group: data.group as PolicyGroup, id: data.id, allowed: data.allowed };
}
export const policyAllows = (policy: WorldPolicy, group: PolicyGroup, id: string): boolean => !policy.blocked[group].includes('*') && !policy.blocked[group].includes(id);
export const allowedRooms = (policy: WorldPolicy): RoomId[] => ROOMS.filter(r => policyAllows(policy, 'rooms', r.id)).map(r => r.id);
export const policyEventAllowed = (policy: WorldPolicy, event: DailyEvent): boolean => policyAllows(policy, 'incidents', event.episodeId) && policyAllows(policy, 'rooms', event.roomId);
export function allowedDailyEvent(event: DailyEvent, policy: WorldPolicy): DailyEvent | undefined {
  if (policyEventAllowed(policy, event)) return event;
  const start = DAILY_EPISODES.findIndex(e => e.id === event.episodeId);
  for (let i = 1; i <= DAILY_EPISODES.length; i++) {
    const episode = DAILY_EPISODES[(start + i) % DAILY_EPISODES.length];
    const next = { ...event, episodeId: episode.id, roomId: episode.direction.room };
    if (policyEventAllowed(policy, next)) return next;
  }
}
