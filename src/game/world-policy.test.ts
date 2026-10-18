import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { defaultWorldPolicy, allowedDailyEvent, policyAllows, parsePolicyAction } from './world-policy.ts';
import { dailyEventAt } from './daily-events.ts';
import { pokemonRoster } from './pokemon-spawns.ts';
import { DAILY_EPISODES, episodeById } from './daily-event-catalog.ts';
import { ROOMS } from './rooms.ts';
test('policy actions reject unknown groups, nonexistent IDs, invalid revisions and spoofed fields', () => {
  const base = { type: 'policy-set', actionId: randomUUID(), revision: 0, group: 'pokemon', id: 'mew', allowed: false };
  assert.deepEqual(parsePolicyAction({ ...base, administrator: true, email: 'tt-asahara@kddi.com' }), base);
  for (const delta of [{ group: '__proto__' }, { id: 'unknown' }, { revision: -1 }, { revision: Infinity }, { allowed: 'false' }, { actionId: 'x' }, { group: 'rooms', id: '*' }]) assert.equal(parsePolicyAction({ ...base, ...delta }), undefined);
  assert.ok(parsePolicyAction({ ...base, id: '*' }));
});
test('incident replacement respects authored rooms, can stop all incidents and never selects closed floors', () => {
  const original = dailyEventAt(Date.now()), policy = defaultWorldPolicy();
  assert.deepEqual(allowedDailyEvent(original, policy), original);
  policy.blocked.incidents.push(original.episodeId); policy.blocked.rooms.push(original.roomId);
  const replacement = allowedDailyEvent(original, policy)!;
  assert.notEqual(replacement.episodeId, original.episodeId); assert.notEqual(replacement.roomId, original.roomId);
  assert.equal(replacement.roomId, episodeById(replacement.episodeId)!.direction.room); assert.equal(replacement.day, original.day);
  policy.blocked.incidents.push('*'); assert.equal(allowedDailyEvent(original, policy), undefined);
  policy.blocked.incidents = DAILY_EPISODES.map(e => e.id); assert.equal(allowedDailyEvent(original, policy), undefined);
  policy.blocked.incidents = []; policy.blocked.rooms = ROOMS.filter(r => r.id !== 'arena').map(r => r.id);
  const onlyArena = allowedDailyEvent(original, policy); assert.ok(!onlyArena || onlyArena.roomId === 'arena');
});
test('Pokemon draw excludes banned species and floors, works in one floor, and an entire category can be stopped', () => {
  const policy = defaultWorldPolicy(); policy.blocked.rooms = ROOMS.filter(r => r.id !== 'office').map(r => r.id); policy.blocked.pokemon = ['mew'];
  const filters = { room: (id: string) => policyAllows(policy, 'rooms', id), kind: (id: string) => policyAllows(policy, 'pokemon', id) };
  const roster = pokemonRoster(Date.now(), 0, undefined, undefined, filters);
  assert.equal(roster.length, 7); assert.ok(roster.every(p => p.roomId === 'office' && p.kind !== 'mew'));
  assert.deepEqual(pokemonRoster(Date.now(), 0, ['mew'], 'office', filters), []);
  assert.deepEqual(pokemonRoster(Date.now(), 0, ['pikachu'], 'cafe', filters), []);
  policy.blocked.pokemon.push('*'); assert.deepEqual(pokemonRoster(Date.now(), 0, undefined, undefined, filters), []);
});
