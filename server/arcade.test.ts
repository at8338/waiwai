import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ArcadeRoom } from './arcade.ts';
import { fourWinner, parseArcadeAction } from '../src/game/arcade.ts';
import type { ArcadeCommand, ArcadeGame } from '../src/game/arcade.ts';
const a = { id: 'a', name: 'Alice' }, b = { id: 'b', name: 'Bob' }, c = { id: 'c', name: 'Cat' };
function fixture(game: ArcadeGame = 'four') {
  const room = new ArcadeRoom(() => 0); let now = 1000;
  const table = () => room.snapshot(now).tables.find((t) => t.game === game)!;
  const act = (who: typeof a, command: ArcadeCommand, value?: number, roundId = table().roundId, beatId?: number) => room.apply({ type: 'arcade-action', game, command, value, roundId, beatId, actionId: randomUUID() }, who, now);
  const advance = (ms: number) => { now += ms; return room.tick(now); };
  const start = () => { assert.equal(act(a, 'join'), undefined); assert.equal(act(b, 'join'), undefined); assert.equal(act(a, 'start'), undefined); };
  return { room, table, act, advance, start, now: () => now };
}
test('arcade parser rejects unknown games, malformed identities and invalid per-game inputs', () => {
  const base = { type: 'arcade-action', game: 'four', command: 'drop', value: 2, roundId: randomUUID(), actionId: randomUUID() };
  assert.ok(parseArcadeAction(base));
  for (const patch of [{ game: '__proto__' }, { command: 'win' }, { value: -1 }, { value: 7 }, { value: 1.5 }, { value: '2' }, { actionId: 'x' }, { roundId: '' }, { command: 'tap', value: 0 }, { command: 'fire', value: 3 }]) assert.equal(parseArcadeAction({ ...base, ...patch }), undefined);
});
test('four-in-a-row detects all directions without wrapping board edges', () => {
  for (const cells of [[35, 36, 37, 38], [0, 7, 14, 21], [0, 8, 16, 24], [6, 12, 18, 24]]) { const board = Array<number>(42).fill(0); cells.forEach((i) => { board[i] = 1; }); assert.equal(fourWinner(board, cells[2]), true); }
  const board = Array<number>(42).fill(0); [5, 6, 7, 8].forEach((i) => { board[i] = 1; }); assert.equal(fourWinner(board, 6), false); assert.equal(fourWinner(board, 0), false);
});
test('four game validates membership, turn, full columns, stale rounds, wins and rematches', () => {
  const f = fixture(); assert.ok(f.act(a, 'start')); f.start();
  assert.ok(f.act(c, 'drop', 1)); assert.ok(f.act(b, 'drop', 1)); assert.ok(f.act(a, 'fire', 1));
  for (let i = 0; i < 3; i++) { assert.equal(f.act(a, 'drop', 0), undefined); assert.equal(f.act(b, 'drop', 0), undefined); }
  assert.ok(f.act(a, 'drop', 0)); assert.equal(f.table().turn, 0);
  for (const col of [1, 2, 3]) { f.act(a, 'drop', col); if (col !== 3) f.act(b, 'drop', 6); }
  assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /Alice/);
  const old = f.table().roundId; f.act(b, 'start'); assert.equal(f.table().phase, 'playing'); assert.ok(f.act(a, 'drop', 0, old)); assert.equal(f.table().board.filter(Boolean).length, 0);
  const snapshot = f.table(); snapshot.members[0].name = 'tampered'; snapshot.board[0] = 2; assert.equal(f.table().members[0].name, 'Alice'); assert.equal(f.table().board[0], 0);
});
test('membership is limited to one station, with capacity and waiting/finished seat expiry', () => {
  const f = fixture(); f.act(a, 'join'); assert.ok(f.act(a, 'join')); f.act(b, 'join'); assert.ok(f.act(c, 'join'));
  const other = f.room.snapshot(0).tables.find((t) => t.game === 'meteor')!;
  assert.ok(f.room.apply({ type: 'arcade-action', game: 'meteor', command: 'join', roundId: other.roundId, actionId: randomUUID() }, a, 1000));
  const old = f.table().roundId; f.advance(120_000); assert.equal(f.table().members.length, 0); assert.notEqual(f.table().roundId, old);
  f.start(); f.advance(90_000); assert.equal(f.table().phase, 'done'); assert.ok(f.act(a, 'drop', 0)); f.advance(60_000); assert.equal(f.table().phase, 'lobby'); assert.equal(f.table().members.length, 0);
});
test('leaving ends a competitive game, resets empty tables, and permits coop to continue', () => {
  const f = fixture(); f.start(); assert.equal(f.room.leave(a.id, 1000), true); assert.equal(f.table().phase, 'done'); assert.equal(f.table().members[0].id, 'b'); f.room.leave('b', 1000); assert.equal(f.table().phase, 'lobby'); assert.equal(f.room.leave('nobody', 1000), false);
  const coop = fixture('meteor'); coop.start(); coop.room.leave('a', 1000); assert.equal(coop.table().phase, 'playing'); assert.equal(coop.table().members.length, 1);
});
test('reaction game hides cue time, penalizes early taps and rejects duplicate round taps', () => {
  const f = fixture('reflex'); f.start(); assert.equal(f.table().light, 'wait'); assert.equal('cueAt' in f.table(), false);
  f.act(a, 'tap', 1); assert.equal(f.table().members[1].score, 1); assert.ok(f.act(a, 'tap', 1));
  f.advance(1600); assert.equal(f.table().round, 2); assert.ok(f.act(a, 'tap', 1)); f.advance(1800); assert.equal(f.table().light, 'go');
  f.act(a, 'tap', 2); assert.equal(f.table().members[0].score, 1);
  for (let round = 3; round <= 5; round++) { f.advance(1600); f.advance(1800); f.act(a, 'tap', round); }
  assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /Alice/); assert.equal(f.table().members[0].score, 4);
});
test('reaction no-input rounds and deadlines always finish', () => {
  const f = fixture('reflex'); f.start(); for (let i = 0; i < 5; i++) { f.advance(1800); f.advance(4500); if (i < 4) f.advance(1600); } assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /引き分け/);
  f.act(a, 'start'); f.advance(60_000); assert.equal(f.table().phase, 'done');
});
test('coop enforces capacity, lane hits, cooldown, health loss, success and failure', () => {
  const f = fixture('meteor'); f.act(a, 'join'); f.act(b, 'join'); f.act(c, 'join'); f.act({ id: 'd', name: 'Dog' }, 'join'); assert.ok(f.act({ id: 'e', name: 'E' }, 'join')); f.act(a, 'start'); assert.ok(f.act({ id: 'e', name: 'E' }, 'join'));
  f.advance(1000); assert.equal(f.table().meteors.length, 1); f.act(a, 'fire', 0); assert.equal(f.table().saved, 1); assert.ok(f.act(a, 'fire', 0)); f.advance(450); assert.equal(f.act(a, 'fire', 1), undefined); assert.equal(f.table().saved, 1);
  for (let i = 0; i < 59; i++) { f.advance(1000); f.act(a, 'fire', 0); }
  assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /守りきった/);
  const fail = fixture('meteor'); fail.start(); for (let i = 0; i < 80 && fail.table().phase === 'playing'; i++) fail.advance(500); assert.equal(fail.table().phase, 'done'); assert.equal(fail.table().health, 0); assert.match(fail.table().message, /再挑戦/);
});

// A delayed timer must apply hits that were due before the game ends.
test('coop does not award survival when overdue final hits exhaust the remaining health', () => {
  const f = fixture('meteor'); f.start();
  // Build up seven misses, then keep the remaining meteors from landing.
  while (f.table().health > 1) f.advance(100);
  while (f.table().meteors.length) { f.act(a, 'fire', 0); f.advance(450); }
  // Safely guard most of the round.
  for (let i = 0; i < 25; i++) { f.advance(1100); f.act(a, 'fire', 0); }
  f.advance(1100);
  assert.equal(f.table().phase, 'playing'); assert.equal(f.table().health, 1); assert.ok(f.table().meteors.length);
  f.advance(60_000);
  assert.equal(f.table().phase, 'done'); assert.equal(f.table().health, 0); assert.match(f.table().message, /再挑戦/);
});

test('solo four-in-a-row creates a CPU, takes legal turns, blocks threats and frees the table when the human leaves', () => {
  const f = fixture(); f.act(a, 'join'); assert.equal(f.act(a, 'start'), undefined);
  assert.equal(f.table().members[1].id, 'cpu:four');
  for (let i = 0; i < 3; i++) { assert.equal(f.act(a, 'drop', 0), undefined); f.advance(650); }
  assert.equal(f.table().board[14], 2); // CPU blocks the fourth vertical star.
  assert.equal(f.table().turn, 0); assert.equal(f.table().board.filter(Boolean).length, 6);
  f.room.leave(a.id, f.now()); assert.equal(f.table().members.length, 0); assert.equal(f.table().phase, 'lobby');
});
test('solo reflex supports winning and losing to the CPU; a new human can replace a finished CPU seat', () => {
  const f = fixture('reflex'); f.act(a, 'join'); f.act(a, 'start'); f.advance(1800); f.advance(650);
  assert.equal(f.table().members[1].score, 1); assert.equal(f.table().light, 'result');
  f.advance(1600); f.advance(1800); f.act(a, 'tap', 2); assert.equal(f.table().members[0].score, 1);
  f.advance(60_000); assert.equal(f.table().phase, 'done'); assert.equal(f.act(b, 'join'), undefined); assert.deepEqual(f.table().members.map((m) => m.id), ['a', 'b']);
});
test('solo meteor starts without another member and has a slower spawn cadence', () => {
  const f = fixture('meteor'); f.act(a, 'join'); assert.equal(f.act(a, 'start'), undefined);
  f.advance(1000); assert.equal(f.table().meteors.length, 1); f.advance(1100); assert.equal(f.table().meteors.length, 1); f.advance(700); assert.equal(f.table().meteors.length, 2);
});
for (const game of ['clap', 'echo', 'sort', 'star'] as const) test(`${game} supports solo timing, immutable attempts, combo scoring, bad keys, expiry and rematch`, () => {
  const f = fixture(game); f.act(a, 'join'); assert.equal(f.act(a, 'start'), undefined);
  const beats = f.table().beats; assert.ok(beats.length >= 15); assert.ok(f.table().endsAt - f.table().startedAt < 40_000);
  assert.ok(f.act(a, 'beat', beats[0].key, undefined, beats[0].id)); // Cannot judge a distant future note.
  f.advance(beats[0].at - f.now()); assert.equal(f.act(a, 'beat', beats[0].key, undefined, 0), undefined); assert.equal(f.table().members[0].score, 30);
  assert.ok(f.act(a, 'beat', beats[0].key, undefined, 0)); assert.equal(f.table().members[0].score, 30);
  f.advance(beats[1].at - f.now() + 220); f.act(a, 'beat', beats[1].key, undefined, 1); assert.equal(f.table().members[0].score, 45); assert.equal(f.table().members[0].combo, 2);
  f.advance(beats[2].at - f.now()); f.act(a, 'beat', (beats[2].key + 1) % 3, undefined, 2); assert.equal(f.table().members[0].score, 45); assert.equal(f.table().members[0].combo, 0);
  assert.ok(f.act(a, 'toast-press', 0, undefined, 3));
  f.advance(60_000); assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /45/); const old = f.table().roundId;
  f.act(a, 'start'); assert.equal(f.table().members[0].score, 0); assert.ok(f.act(a, 'beat', 0, old, 0));
});
test('toast measures real hold duration, refuses forged releases and double awards, and clears forgotten bread', () => {
  const f = fixture('toast'); f.act(a, 'join'); f.act(a, 'start'); const beats = f.table().beats;
  f.advance(beats[0].at - f.now()); assert.ok(f.act(a, 'toast-release', 0, undefined, 0));
  f.act(a, 'toast-press', 0, undefined, 0); assert.equal(f.table().holds.length, 1); f.advance(beats[0].span);
  f.act(a, 'toast-release', 0, undefined, 0); assert.equal(f.table().members[0].score, 30); assert.ok(f.act(a, 'toast-release', 0, undefined, 0));
  f.advance(beats[1].at - f.now()); f.act(a, 'toast-press', 0, undefined, 1); f.advance(2000); assert.equal(f.table().holds.length, 0); assert.equal(f.table().members[0].combo, 0);
  assert.ok(f.act(a, 'beat', 0, undefined, 2));
});
test('four people share rhythm prompts while timing and combo scores stay independent; departure allows the others to continue', () => {
  const f = fixture('star'); for (const person of [a, b, c, { id: 'd', name: 'D' }]) f.act(person, 'join');
  assert.ok(f.act({ id: 'e', name: 'E' }, 'join')); f.act(a, 'start'); const beat = f.table().beats[0]; f.advance(beat.at - f.now());
  f.act(a, 'beat', beat.key, undefined, 0); f.act(b, 'beat', beat.key, undefined, 0); assert.deepEqual(f.table().members.map((m) => m.score), [30, 30, 0, 0]);
  f.room.leave(a.id, f.now()); assert.equal(f.table().phase, 'playing'); assert.equal(f.table().members.length, 3);
  f.advance(60_000); assert.equal(f.table().phase, 'done'); assert.match(f.table().message, /Bob/);
});
