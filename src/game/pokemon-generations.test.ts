import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POKEMON_GENERATIONS, pokemonGeneration, pokemonGenerationMembers } from './pokemon-generations.ts';
import { POKEMON, POKEMON_KINDS } from './pokemon.ts';
test('generation groups partition every catalog species exactly once using the pinned national ranges', () => {
  assert.deepEqual(POKEMON_GENERATIONS.map(g=>pokemonGenerationMembers(g.id).length),[151,100,135,107,156,72,88,96,120,3]);
  const all=POKEMON_GENERATIONS.flatMap(g=>pokemonGenerationMembers(g.id));
  assert.equal(all.length,POKEMON_KINDS.length); assert.equal(new Set(all).size,all.length);
  for(const group of POKEMON_GENERATIONS) for(const kind of pokemonGenerationMembers(group.id)) {
    assert.equal(pokemonGeneration(kind).id,group.id);
    const number=POKEMON[kind].id;
    if(group.first===null) assert.equal(number,null); else assert.ok(number!==null && number>=group.first && number<=group.last);
  }
});
test('classic games, later generations, and announced species have the intended group', () => {
  for(const [kind,id] of [['pikachu','generation:1'],['chikorita','generation:2'],['treecko','generation:3'],['turtwig','generation:4'],['victini','generation:5'],['chespin','generation:6'],['rowlet','generation:7'],['grookey','generation:8'],['sprigatito','generation:9'],['browt','generation:announced']] as const) assert.equal(pokemonGeneration(kind).id,id);
});
