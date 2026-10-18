import { playerIdentity } from './identity.ts';
import type { SlackIdentity } from '../slack/dm.ts';
import type { Player } from '../network/protocol.ts';
import type { RoomId } from './rooms.ts';

export type Member = { id: string; name: string; slack?: SlackIdentity };
export type Person = { id: string; name: string; slack: SlackIdentity | null; verified: boolean; online: boolean; playerId?: string; roomId?: RoomId; dummy?: boolean };
export const memberId = (slack: SlackIdentity): string => `slack:${slack.teamId}:${slack.userId}`;

export function directoryPeople(members: readonly Member[], players: Iterable<Player>): Person[] {
  const people = new Map<string, Person>(members.map((m) => [m.id, { ...m, slack: m.slack ?? null, verified: true, online: false }]));
  for (const p of players) {
    const verified = !!p.accountId || !!p.slackVerified && !!p.slack;
    const id = playerIdentity(p);
    // One row per verified Slack account. The most recently connected tab is
    // its destination; a remaining tab keeps the account online after an exit.
    people.set(id, { id, name: p.name, slack: p.slackVerified ? p.slack! : null, verified, online: true, playerId: p.id, roomId: p.roomId, ...(p.dummy ? { dummy: true } : {}) });
  }
  return [...people.values()];
}

export function searchPeople(people: readonly Person[], query: string, filter: 'all' | 'online' | 'offline' = 'all'): Person[] {
  const normalize = (s: string) => s.normalize('NFKC').toLocaleLowerCase('ja');
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return people.filter((p) => (filter === 'all' || p.online === (filter === 'online')) &&
    words.every((word) => normalize(`${p.name} ${p.slack?.userId ?? ''}`).includes(word)))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.name.localeCompare(b.name, 'ja') || a.id.localeCompare(b.id));
}

// An account can have several tabs. Only the tab selected as the directory's
// destination may update its area; movement never changes identity or presence.
export function updateDirectoryArea(people: Person[], playerId: string, roomId: RoomId): Person[] {
  const person = people.find(p => p.playerId === playerId && p.roomId !== roomId);
  return person ? people.map(p => p === person ? { ...p, roomId } : p) : people;
}
