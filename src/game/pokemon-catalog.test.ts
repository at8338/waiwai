import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POKEMON, POKEMON_KINDS, pokemonMatches } from './pokemon.ts';
import { readPokemonDiscoveries } from './pokemon-journal.ts';
test('the catalog contains exactly national species 001–300 with unique Japanese names and valid rarities', () => {
  assert.equal(POKEMON_KINDS.length, 300);
  assert.deepEqual(POKEMON_KINDS.map(kind => POKEMON[kind].id), Array.from({ length: 300 }, (_, i) => i + 1));
  assert.equal(new Set(POKEMON_KINDS.map(kind => POKEMON[kind].name)).size, 300);
  assert.equal(POKEMON.skitty.name, 'エネコ'); assert.equal(POKEMON.lugia.name, 'ルギア'); assert.equal(POKEMON['ho-oh'].name, 'ホウオウ');
  for (const kind of POKEMON_KINDS) { const entry = POKEMON[kind]; assert.ok(entry.description.includes(entry.name) || ['pikachu', 'eevee', 'snorlax', 'bulbasaur', 'charmander', 'squirtle', 'jigglypuff', 'psyduck', 'gengar', 'mew'].includes(kind)); assert.ok(entry.weight > 0 && entry.weight <= 10); }
  assert.equal(POKEMON.pikachu.weight, 10); assert.equal(POKEMON.mew.weight, .5);
});
test('search supports Japanese scripts and full-width numbers without revealing undiscovered names', () => {
  assert.equal(pokemonMatches('pikachu', 'ぴかちゅう'), true); assert.equal(pokemonMatches('pikachu', 'ﾋﾟｶﾁｭｳ'), true);
  assert.equal(pokemonMatches('skitty', '３００'), true); assert.equal(pokemonMatches('mewtwo', 'ミュウ'), true);
  assert.equal(pokemonMatches('mewtwo', 'ミュウ', false), false); assert.equal(pokemonMatches('mewtwo', '150', false), true);
});
test('all 300 discoveries restore and old species keep their first-found records', () => {
  const records = POKEMON_KINDS.map((kind, i) => ({ kind, roomId: 'office', foundAt: 1000 + i }));
  const restored = readPokemonDiscoveries(JSON.stringify([...records, { kind: 'pikachu', roomId: 'garden', foundAt: 9999 }]));
  assert.equal(restored.length, 300); assert.deepEqual(restored.find(e => e.kind === 'pikachu'), records.find(e => e.kind === 'pikachu'));
});
