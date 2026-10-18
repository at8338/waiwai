import { POKEMON, POKEMON_KINDS } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
// National-number ranges agree with the pinned pokemon_species.csv generation_id.
// New announced species keep their unannounced national numbers as null.
export const POKEMON_GENERATIONS = [
  { id: 'generation:1', name: '第1世代 · 赤・緑', first: 1, last: 151 },
  { id: 'generation:2', name: '第2世代 · 金・銀', first: 152, last: 251 },
  { id: 'generation:3', name: '第3世代 · ルビー・サファイア', first: 252, last: 386 },
  { id: 'generation:4', name: '第4世代 · ダイヤモンド・パール', first: 387, last: 493 },
  { id: 'generation:5', name: '第5世代 · ブラック・ホワイト', first: 494, last: 649 },
  { id: 'generation:6', name: '第6世代 · X・Y', first: 650, last: 721 },
  { id: 'generation:7', name: '第7世代 · サン・ムーン', first: 722, last: 809 },
  { id: 'generation:8', name: '第8世代 · ソード・シールド', first: 810, last: 905 },
  { id: 'generation:9', name: '第9世代 · スカーレット・バイオレット', first: 906, last: 1025 },
  { id: 'generation:announced', name: '発表済み・番号未公表', first: null, last: null },
] as const;
export type PokemonGenerationId = typeof POKEMON_GENERATIONS[number]['id'];
export function pokemonGeneration(kind: PokemonKind): typeof POKEMON_GENERATIONS[number] {
  const number = POKEMON[kind].id;
  return POKEMON_GENERATIONS.find(g => number === null ? g.first === null : g.first !== null && number >= g.first && number <= g.last)!;
}
export const isPokemonGenerationId = (id: unknown): id is PokemonGenerationId => typeof id === 'string' && POKEMON_GENERATIONS.some(g => g.id === id);
const members = new Map(POKEMON_GENERATIONS.map(g => [g.id, POKEMON_KINDS.filter(kind => pokemonGeneration(kind).id === g.id)]));
export const pokemonGenerationMembers = (id: PokemonGenerationId): readonly PokemonKind[] => members.get(id)!;
