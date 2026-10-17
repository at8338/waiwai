import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { WorldTestControls, allowDevWorld } from './dev-world.ts';
import { DAILY_EPISODES } from '../src/game/daily-event-catalog.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
const now = Date.parse('2026-10-17T12:00:00+09:00');
test('test controls require both an explicitly enabled server and localhost host/origin', () => {
  const headers = { host: '127.0.0.1:5175', origin: 'http://127.0.0.1:5175' };
  assert.equal(allowDevWorld(true, { headers }), true);
  for (const enabled of [false, undefined]) assert.equal(allowDevWorld(enabled, { headers }), false);
  for (const origin of [undefined, 'https://example.com', 'https://127.0.0.1.example.com']) assert.equal(allowDevWorld(true, { headers: { ...headers, origin } }), false);
  assert.equal(allowDevWorld(true, { headers: { ...headers, host: 'public.example.com' } }), false);
});
test('365 test incidents cycle, and reset/day rollover restore the real daily world', () => {
  const world = new WorldTestControls(now), seen = new Set<string>();
  for (let n = 0; n < 365; n++) { seen.add(world.event(now).episodeId); world.apply({ type: 'dev-world', command: 'event-step', step: 1, actionId: randomUUID() }, now); }
  assert.equal(seen.size, DAILY_EPISODES.length); assert.equal(world.preview, true);
  world.apply({ type: 'dev-world', command: 'pokemon', kinds: ['mew'], roomId: 'office', actionId: randomUUID() }, now); assert.equal(world.roster(now)[0].kind, 'mew');
  world.apply({ type: 'dev-world', command: 'lost', kind: 'box', actionId: randomUUID() }, now); assert.equal(world.lost.kind, 'box');
  assert.equal(world.refresh(Date.parse('2026-10-18T00:00:00+09:00')), true); assert.equal(world.preview, false); assert.equal(world.lost.kind, undefined); assert.equal(world.roster(now).length, 7);
  world.apply({ type: 'dev-world', command: 'reset', actionId: randomUUID() }, now); assert.deepEqual(world.event(now), dailyEventAt(now));
});
test('test actions reject unknown incidents, duplicates, excess Pokemon, invalid rooms and lost kinds', () => {
  const base = { type: 'dev-world', actionId: randomUUID() };
  assert.ok(parseClientMessage(JSON.stringify({ ...base, command: 'pokemon', kinds: ['mew'], roomId: 'office' })));
  for (const command of [ { command: 'event', episodeId: '__proto__' }, { command: 'lost', kind: 'missing' }, { command: 'pokemon', kinds: ['mew', 'mew'] }, { command: 'pokemon', kinds: ['cat'] }, { command: 'pokemon', kinds: [], roomId: 'missing' }, { command: 'event-step', step: 7 } ]) assert.equal(parseClientMessage(JSON.stringify({ ...base, ...command })), undefined);
});
