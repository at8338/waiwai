import { POKEMON, POKEMON_KINDS, MAX_DAILY_POKEMON } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
import { ROOM_IDS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { spawnHash, weightedDraw } from './spawn-random.ts';
export const pokemonDay = (now: number): string => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);
export function dailyPokemonKinds(now: number, salt = 0): PokemonKind[] {
  return weightedDraw(POKEMON_KINDS, MAX_DAILY_POKEMON, `pokemon-v1:${pokemonDay(now)}:${salt}`, (kind) => POKEMON[kind].weight);
}
export function pokemonRoster(now: number, salt = 0, forced?: readonly PokemonKind[], room?: RoomId) {
  const kinds = forced ?? dailyPokemonKinds(now, salt);
  const rooms = [...ROOM_IDS].sort((a, b) => spawnHash(`${pokemonDay(now)}:${salt}:${a}`) - spawnHash(`${pokemonDay(now)}:${salt}:${b}`));
  return [...new Set(kinds)].slice(0, MAX_DAILY_POKEMON).map((kind, index) => {
    const roomId = room ?? rooms[index], origin = getRoom(roomId).spawn;
    return { kind, roomId, x: origin.x - 5 + index % 4 * 3, y: origin.y - 3 - Math.floor(index / 4) * 2 };
  });
}
