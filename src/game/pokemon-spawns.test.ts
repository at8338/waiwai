import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyPokemonKinds, pokemonRoster } from './pokemon-spawns.ts';
import { POKEMON, POKEMON_KINDS } from './pokemon.ts';
import { DAY } from './announcements.ts';
const start = Date.parse('2026-10-17T00:00:00+09:00');
test('seven unique daily Pokemon are deterministic across reconnects and switch on JST dates', () => {
  assert.deepEqual(pokemonRoster(start), pokemonRoster(start + DAY - 1));
  assert.notDeepEqual(pokemonRoster(start), pokemonRoster(start + DAY));
  for (let day = 0; day < 365; day++) {
    const roster = pokemonRoster(start + day * DAY);
    assert.equal(roster.length, 7); assert.equal(new Set(roster.map((pet) => pet.kind)).size, 7); assert.equal(new Set(roster.map((pet) => pet.roomId)).size, 7);
  }
});
test('rarity is weighted over daily draws, and developer selections remain unique and capped at seven', () => {
  const counts = Object.fromEntries(POKEMON_KINDS.map((kind) => [kind, 0]));
  for (let day = 0; day < 3000; day++) for (const kind of dailyPokemonKinds(start + day * DAY)) counts[kind]++;
  assert.ok(counts.pikachu > counts.mew * 3); assert.ok(counts.eevee > counts.gengar); assert.ok(POKEMON_KINDS.every((kind) => POKEMON[kind].weight > 0));
  assert.equal(pokemonRoster(start, 2, ['mew', 'mew'], 'office').length, 1);
  assert.ok(pokemonRoster(start, 0, POKEMON_KINDS, 'office').every((pet) => pet.roomId === 'office'));
  assert.equal(pokemonRoster(start, 0, POKEMON_KINDS).length, 7);
});

test('every species can be selected and distributed through the same seven-slot roster', () => {
  const seen = new Set();
  for (let i = 0; i < POKEMON_KINDS.length; i += 7) {
    const selected = POKEMON_KINDS.slice(i, i + 7);
    const roster = pokemonRoster(start, 0, selected);
    assert.deepEqual(roster.map(p => p.kind), selected);
    for (const pet of roster) seen.add(pet.kind);
  }
  assert.equal(seen.size, 1028);
});
