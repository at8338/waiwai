import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PokemonJournal, readPokemonDiscoveries, isPokemonKind, POKEMON_JOURNAL_KEY } from './pokemon-journal.ts';

test('the journal restores only known Pokemon, rooms and usable timestamps from damaged storage', () => {
  for (const raw of ['{', '{}', 'null']) assert.deepEqual(readPokemonDiscoveries(raw), []);
  const valid = { kind: 'pikachu', roomId: 'arcade', foundAt: 1000 };
  const raw = JSON.stringify([valid, { ...valid, foundAt: 2000, roomId: 'office' },
    { ...valid, kind: 'cat' }, { ...valid, kind: '__proto__' }, { ...valid, roomId: 'nowhere' },
    ...[null, -1, 0, 1.1, 9e15, '1000'].map((foundAt) => ({ ...valid, kind: 'eevee', foundAt })), null]);
  assert.deepEqual(readPokemonDiscoveries(raw), [valid]);
  assert.equal(isPokemonKind('vacuum'), false); assert.equal(isPokemonKind('snorlax'), true);
});

test('discoveries survive reloads and repeated encounters keep the original room and time', () => {
  const data = new Map<string, string>(), storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const journal = new PokemonJournal(storage);
  assert.equal(journal.discover('pikachu', 'arcade', 1000), true);
  assert.equal(journal.discover('pikachu', 'office', 500), false);
  assert.deepEqual(new PokemonJournal(storage).entries(), [{ kind: 'pikachu', roomId: 'arcade', foundAt: 1000 }]);
  const otherTab = new PokemonJournal(storage);
  otherTab.discover('eevee', 'garden', 2000);
  journal.discover('snorlax', 'wellness', 3000);
  assert.equal(new PokemonJournal(storage).entries().length, 3);
  otherTab.merge(data.get(POKEMON_JOURNAL_KEY)!); assert.equal(otherTab.entries().length, 3);
  const snapshot = otherTab.entries(); snapshot[0].roomId = 'office'; assert.equal(otherTab.entries()[0].roomId, 'arcade');
});

test('storage denial keeps discoveries usable in memory', () => {
  const journal = new PokemonJournal({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } });
  assert.equal(journal.discover('eevee', 'garden', 1000), true);
  assert.equal(journal.stored, false); assert.equal(journal.entries().length, 1);
  assert.equal(journal.discover('eevee', 'office', 2000), false); assert.equal(journal.entries()[0].roomId, 'garden');
});
