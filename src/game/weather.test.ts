import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weatherAt, WEATHER_KINDS, WEATHER_PERIOD_MS } from './weather.ts';

test('decorative weather is shared and stable throughout each JST half hour', () => {
  const start = Date.parse('2026-10-18T08:00:00+09:00');
  assert.equal(start % WEATHER_PERIOD_MS, 0);
  for (let slot = 0; slot < 48 * 7; slot++) {
    const now = start + slot * WEATHER_PERIOD_MS;
    assert.ok(WEATHER_KINDS.includes(weatherAt(now)));
    assert.equal(weatherAt(now), weatherAt(now + WEATHER_PERIOD_MS - 1));
    assert.equal(weatherAt(now), weatherAt(Date.parse(new Date(now).toISOString())));
  }
  const samples = Array.from({ length: 48 * 30 }, (_, slot) => weatherAt(start + slot * WEATHER_PERIOD_MS));
  for (const kind of WEATHER_KINDS) assert.ok(samples.includes(kind));
  assert.ok(samples.filter((weather) => weather === 'clear').length > samples.length / 2);
  assert.ok(samples.some((weather, i) => i > 0 && weather !== samples[i - 1]));
});

test('Tokyo Bay panorama stays inside the window canvas in daylight and at night', async () => {
  const { tokyoBayPixels } = await import('./tokyo-bay.ts');
  for (const night of [false, true]) for (const overcast of [false, true]) for (const elevated of [false, true]) {
    const pixels = tokyoBayPixels(night, overcast, elevated);
    for (const p of pixels) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= 480 && p.y + p.h <= (elevated ? 80 : 56) && p.w > 0 && p.h > 0, JSON.stringify(p));
  }
  assert.notDeepEqual(tokyoBayPixels(false, false), tokyoBayPixels(true, false));
});
