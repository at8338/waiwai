import type { AuthUser } from '../slack/auth.ts';
import type { Player } from '../network/protocol.ts';
const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
const persistent = new RegExp(`^(slack:[A-Z0-9]{1,40}:[A-Z0-9]{1,40}|entra:${uuid}:${uuid}|gcip:[a-z][a-z0-9-]{4,28}[a-z0-9]:[A-Za-z0-9_-]{1,128})$`);
const guest = new RegExp(`^guest:${uuid}$`);
export const persistentIdentity = (id: unknown): id is string => typeof id === 'string' && persistent.test(id);
export const validIdentity = (id: unknown): id is string => persistentIdentity(id) || typeof id === 'string' && guest.test(id);
export function userIdentity(user: AuthUser): string {
  if (user.accountId && persistentIdentity(user.accountId)) return user.accountId;
  if (user.slack) return `slack:${user.slack.teamId}:${user.slack.userId}`;
  throw new Error('Verified identity required');
}
export const playerIdentity = (player: Player): string => player.accountId ?? (player.slackVerified && player.slack ? `slack:${player.slack.teamId}:${player.slack.userId}` : `guest:${player.id}`);
