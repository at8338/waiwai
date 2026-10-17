import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY_EPISODES, episodeById } from './daily-event-catalog.ts';
import { roomEventStage } from './daily-event-stage.ts';
import { ROOMS } from './rooms.ts';
import { EVENT_PROP_NAMES, eventPropPixels } from './event-props.ts';

test('all 365 room-sized incidents are deterministic, bounded, and leave the underlying office data intact', () => {
  const before = JSON.stringify(ROOMS);
  for (const event of DAILY_EPISODES) {
    const stage = roomEventStage(event);
    assert.deepEqual(roomEventStage(event), stage);
    assert.ok(stage.caption.length >= 4);
    assert.ok(stage.hero.scale >= 0 && stage.hero.x >= 0 && stage.hero.y >= 0 && stage.hero.x + stage.hero.scale * 48 <= 480 && stage.hero.y + stage.hero.scale * 48 <= 320, event.id);
    assert.deepEqual(roomEventStage(event, 'meeting', [], 2).floor, stage.floor);
    for (const p of [...stage.floor, ...stage.scenery, ...stage.effects]) {
      assert.ok([p.x, p.y, p.w, p.h, p.alpha, p.color].every(Number.isFinite), event.id);
      assert.ok(p.x >= 0 && p.y >= 0 && p.w > 0 && p.h > 0 && p.x + p.w <= 480 && p.y + p.h <= 320, `${event.id}: ${JSON.stringify(p)}`);
      assert.ok(p.alpha > 0 && p.alpha <= 1 && p.color >= 0 && p.color <= 0xffffff);
    }
  }
  assert.equal(JSON.stringify(ROOMS), before);
});
test('ordinary visitors never grow giant or create unrelated craters, and only impacts destroy floors', () => {
  const ordinary = new Set(['waldo', 'santa', 'ghost', 'terminator', 'thief', 'detective', 'comic', 'festival', 'momotaro', 'urashima', 'kaguya', 'alice', 'oz', 'ninja', 'magic', 'robot']);
  for (const event of DAILY_EPISODES) if (ordinary.has(event.theme)) {
    const stage = roomEventStage(event); assert.ok(stage.hero.scale <= 1, event.id); assert.equal(stage.damage.length, 0, event.id);
  }
  const meteor = roomEventStage(episodeById('meteor-01')!).damage.find(s => s.kind === 'ellipse')!;
  assert.ok(Math.PI * meteor.w * meteor.h / 4 > 60_000);
  const car = roomEventStage(episodeById('delorean-01')!); assert.ok(car.damage.some(s => s.kind === 'rect' && s.x === 0)); assert.ok(car.damage.every(s => s.kind !== 'ellipse'));
  assert.equal(roomEventStage(episodeById('kaiju-01')!).damage.length, 0);
});
test('365 different scene silhouettes, with only two structural breaches, two floods, and one Santa', () => {
  const stages = DAILY_EPISODES.map(e => roomEventStage(e, 'meeting', [], -1));
  const geometry = stages.map(s => JSON.stringify([[s.hero.x, s.hero.y, s.hero.scale], ...[s.floor, s.scenery, s.effects].map(layer => layer.map(p => [p.x, p.y, p.w, p.h, p.alpha]))]));
  // Ignore colour and text: recolouring or renaming a duplicated scene cannot pass.
  assert.equal(new Set(geometry).size, 365);
  assert.deepEqual(DAILY_EPISODES.filter((_, i) => stages[i].damage.length).map(e => e.id), ['meteor-01', 'delorean-01']);
  assert.deepEqual(DAILY_EPISODES.filter((_, i) => stages[i].floor.some(p => p.x === 16 && p.y === 16 && p.w === 448 && p.h === 288)).map(e => e.id), ['flood-01', 'flood-02']);
  assert.equal(DAILY_EPISODES.filter(e => /サンタ/.test(e.title + e.discovery)).length, 1);
  assert.equal(DAILY_EPISODES.filter(e => e.scene.special === 'santa').length, 1);
  assert.ok(new Set(DAILY_EPISODES.map(e => e.scene.layout)).size >= 75);
  // A story can never silently use an empty or missing prop.
  for (const name of EVENT_PROP_NAMES) {
    const pixels = eventPropPixels(name); assert.ok(pixels.length > 0, name);
    assert.ok(pixels.every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= 8 && p.y + p.h <= 8), name);
  }
});
test('all rooms can show every authored incident without out-of-bounds artwork or changing furniture', () => {
  const before = JSON.stringify(ROOMS);
  for (const room of ROOMS) for (const episode of DAILY_EPISODES) {
    const stage = roomEventStage(episode, room.id);
    assert.ok([...stage.floor, ...stage.scenery, ...stage.effects].every(p => p.x >= 0 && p.y >= 0 && p.x + p.w <= 480 && p.y + p.h <= 320), `${room.id}:${episode.id}`);
    assert.ok((stage.inspectAreas ?? []).every(p => p.w > 0 && p.h > 0));
  }
  assert.equal(JSON.stringify(ROOMS), before);
});
test('floods cover the room without craters; gunfire pauses when reduced motion is requested', () => {
  const flood = roomEventStage(episodeById('flood-01')!); assert.equal(flood.damage.length, 0); assert.ok(flood.floor.some(p => p.x === 16 && p.y === 16 && p.w === 448 && p.h === 288));
  const event = episodeById('terminator-01')!;
  assert.ok(roomEventStage(event, 'meeting', [], 0).effects.length > 0);
  assert.equal(roomEventStage(event, 'meeting', [], -1).effects.length, 0);
  assert.deepEqual(roomEventStage(event, 'meeting', [], -1).scenery, roomEventStage(event, 'meeting', [], 0).scenery);
});
