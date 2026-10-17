import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RHYTHM_IDS, rhythmBeats, nearestBeat, timingScore } from './arcade-rhythm.ts';
import { ARCADE_GAMES, ARCADE_IDS, parseArcadeAction } from './arcade.ts';
import { getRoom } from './rooms.ts';
import { randomUUID } from 'node:crypto';
test('eight distinct cabinets map to eight games without overlap and with bounded rhythm rounds', () => {
  assert.equal(ARCADE_IDS.length, 8); const room = getRoom('arcade'); const cabinets = room.furniture.filter((f) => f.kind === 'arcade'); assert.equal(cabinets.length, 8);
  for (const id of ARCADE_IDS) { const g = ARCADE_GAMES[id]; assert.equal(cabinets.filter((f) => f.x === g.x && f.y === g.y).length, 1); }
  for (const game of RHYTHM_IDS) {
    const beats = rhythmBeats(game, 1000, () => .99); assert.equal(new Set(beats.map((b) => b.id)).size, beats.length);
    assert.ok(beats.at(-1)!.at + beats.at(-1)!.span + 1800 - 1000 <= 40_000);
    assert.ok(beats.every((b, i) => !i || b.at > beats[i - 1].at));
    if (game === 'echo') assert.ok(beats.every((b) => b.at - b.cueAt === 2600));
  }
});
test('timing tolerances and nearest-note selection have stable boundaries', () => {
  assert.equal(timingScore(150), 30); assert.equal(timingScore(-150), 30); assert.equal(timingScore(151), 15); assert.equal(timingScore(-340), 15); assert.equal(timingScore(341), 0);
  assert.equal(nearestBeat([], 0), undefined); const beats = rhythmBeats('clap', 0, () => 0); assert.equal(nearestBeat(beats, 4430)?.id, 1);
});
test('rhythm wire actions require bounded note ids and keys and never accept client timestamps or scores', () => {
  const base = { type: 'arcade-action', game: 'toast', command: 'toast-release', actionId: randomUUID(), roundId: randomUUID(), beatId: 0, value: 0, score: 9999, at: 0 };
  const parsed = parseArcadeAction(base)!; assert.ok(parsed); assert.equal('score' in parsed, false); assert.equal('at' in parsed, false);
  for (const patch of [{ beatId: 64 }, { beatId: -1 }, { beatId: .5 }, { beatId: '1' }, { value: 3 }, { value: -1 }, { value: '0' }]) assert.equal(parseArcadeAction({ ...base, ...patch }), undefined);
});
