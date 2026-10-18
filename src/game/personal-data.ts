import { parseAppearance } from './avatar.ts';
import { isBuddyKind } from './buddies.ts';
import { isPokemonKind, readPokemonDiscoveries } from './pokemon-journal.ts';
import { isRoomId } from './rooms.ts';
export const PERSONAL_KEYS = ['waiwai.appearance.v1', 'waiwai.buddy.v1', 'waiwai:pokemon-discoveries:v1', 'waiwai:incident-discoveries:v1'] as const;
export type PersonalKey = typeof PERSONAL_KEYS[number];
export type PersonalSnapshot = { accountId: string; records: Partial<Record<PersonalKey, { value: unknown; revision: number }>> };
export const personalKey = (key: unknown): key is PersonalKey => typeof key === 'string' && (PERSONAL_KEYS as readonly string[]).includes(key);
export function personalValue(key: PersonalKey, value: unknown): unknown {
  if (key === PERSONAL_KEYS[0]) { const appearance = parseAppearance(value); if (value && appearance) return appearance; }
  if (key === PERSONAL_KEYS[1] && value && typeof value === 'object') {
    const b = value as { selected: unknown; favorites: unknown };
    if ((b.selected === null || isBuddyKind(b.selected)) && Array.isArray(b.favorites) && b.favorites.length <= 2000 && b.favorites.every(isBuddyKind)) return { selected: b.selected, favorites: [...new Set(b.favorites)] };
  }
  if (key === PERSONAL_KEYS[2] && Array.isArray(value) && value.length <= 2000 && value.every(v => v && isPokemonKind(v.kind) && isRoomId(v.roomId) && Number.isSafeInteger(v.foundAt) && v.foundAt > 0 && v.foundAt <= 8.64e15)) return readPokemonDiscoveries(JSON.stringify(value));
  if (key === PERSONAL_KEYS[3] && Array.isArray(value) && value.length <= 10000 && value.every(v => typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v)) return [...new Set(value)].sort();
  throw new Error('保存データの形式を確認してください。');
}
export function personalBundle(value: unknown): Partial<Record<PersonalKey, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !personalKey(k))) throw new Error('Waiwaiの引き継ぎデータを選んでください。');
  return Object.fromEntries(Object.entries(value).map(([key, data]) => [key, personalValue(key as PersonalKey, data)]));
}
export function mergeCollection(key: PersonalKey, previous: unknown, incoming: unknown): unknown {
  if (key === PERSONAL_KEYS[2]) return personalValue(key, readPokemonDiscoveries(JSON.stringify([...(previous as unknown[] ?? []), ...(incoming as unknown[])])));
  if (key === PERSONAL_KEYS[3]) return personalValue(key, [...new Set([...(previous as string[] ?? []), ...(incoming as string[])])]);
  return incoming;
}
