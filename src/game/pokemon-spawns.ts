import { POKEMON, POKEMON_KINDS, MAX_DAILY_POKEMON } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
import { ROOM_IDS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { spawnHash, weightedDraw } from './spawn-random.ts';
export const pokemonDay = (now: number): string => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
export type SpawnPolicy = { kind?: (kind: PokemonKind) => boolean; room?: (room: RoomId) => boolean };
export function dailyPokemonKinds(now: number, salt = 0, allowed?: SpawnPolicy['kind']): PokemonKind[] {
  return weightedDraw(POKEMON_KINDS.filter(kind => !allowed || allowed(kind)), MAX_DAILY_POKEMON, `pokemon-v1:${pokemonDay(now)}:${salt}`, (kind) => POKEMON[kind].weight);
}
export function pokemonRoster(now: number, salt = 0, forced?: readonly PokemonKind[], room?: RoomId, policy: SpawnPolicy = {}) {
  const kinds = forced ?? dailyPokemonKinds(now, salt, policy.kind);
  const rooms = ROOM_IDS.filter((room) => room !== 'arena' && (!policy.room || policy.room(room))).sort((a, b) => spawnHash(`${pokemonDay(now)}:${salt}:${a}`) - spawnHash(`${pokemonDay(now)}:${salt}:${b}`));
  if (room ? policy.room && !policy.room(room) : !rooms.length) return [];
  return [...new Set(kinds)].filter(kind => !policy.kind || policy.kind(kind)).slice(0, MAX_DAILY_POKEMON).map((kind, index) => {
    const roomId = room ?? rooms[index % rooms.length], origin = getRoom(roomId).spawn;
    return { kind, roomId, x: origin.x - 5 + index % 4 * 3, y: origin.y - 3 - Math.floor(index / 4) * 2 };
  });
}
