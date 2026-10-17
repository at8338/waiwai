import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lightingAt, roomLightingAt, roomLights, roomWindowColumns, WINDOW_COLUMNS } from './lighting.ts';
import { ROOMS } from './rooms.ts';
import type { RoomObject } from './objects.ts';
const at = (clock: string) => lightingAt(Date.parse(`2026-10-18T${clock}:00+09:00`), 'clear');

test('whiteboards have clear wall space without window glass or a sconce over the writing surface', () => {
  for (const id of ['office', 'meeting', 'workshop'] as const) {
    const board = ROOMS.find((room) => room.id === id)!.furniture.find((item) => item.kind === 'board')!;
    assert.ok(roomWindowColumns(id).every((x) => x < board.x || x >= board.x + board.w));
    assert.ok(roomLights(id, []).filter((light) => light.y === 20).every((light) => light.x < board.x * 16 || light.x >= (board.x + board.w) * 16));
  }
  assert.deepEqual(roomWindowColumns('focus'), WINDOW_COLUMNS);
  assert.deepEqual(roomWindowColumns('ops'), []);
});

test('lighting follows the four JST periods including midnight and exact boundaries', () => {
  for (const [clock, phase] of [['00:00', 'night'], ['05:59', 'night'], ['06:00', 'morning'], ['09:59', 'morning'],
    ['10:00', 'day'], ['15:59', 'day'], ['16:00', 'evening'], ['18:59', 'evening'], ['19:00', 'night'], ['23:59', 'night']]) {
    assert.equal(at(clock).phase, phase, clock); assert.equal(at(clock).time, clock);
  }
  assert.equal(lightingAt(Date.parse('2026-10-17T21:00:00Z')).phase, 'morning');
  assert.equal(lightingAt(Date.parse('2026-10-17T14:00:00-07:00')).time, '06:00');
  assert.equal(lightingAt(Date.parse('2026-12-31T15:00:00Z')).time, '00:00');
});

test('light fades during the last twenty minutes and stays within readable limits all day', () => {
  assert.equal(at('05:39').palette.lamps, 1);
  assert.ok(at('05:50').palette.lamps < at('05:40').palette.lamps);
  assert.ok(at('18:50').palette.lamps > at('18:40').palette.lamps);
  assert.equal(at('12:00').palette.shade, 0);
  for (const boundary of ['06:00', '10:00', '16:00', '19:00']) {
    const now = Date.parse(`2026-10-18T${boundary}:00+09:00`);
    const before = lightingAt(now - 60_000, 'clear').palette, after = lightingAt(now, 'clear').palette;
    assert.ok(Math.abs(before.shade - after.shade) < 0.03);
    assert.ok(Math.abs(before.lamps - after.lamps) < 0.06);
    for (const channel of [16, 8, 0]) assert.ok(Math.abs(((before.tint >> channel) & 255) - ((after.tint >> channel) & 255)) < 13);
  }
  for (let minute = 0; minute < 1440; minute++) {
    const { palette } = lightingAt(Date.parse('2026-10-18T00:00:00+09:00') + minute * 60_000);
    assert.ok(palette.shade >= 0 && palette.shade <= 0.58);
    assert.ok(palette.lamps >= 0 && palette.lamps <= 1);
    for (const color of [palette.tint, palette.sunColor, palette.glass]) assert.ok(Number.isInteger(color) && color >= 0 && color <= 0xffffff);
  }
});

test('room lights use outdoor lanterns and include only current-room lamps and screens', () => {
  for (const room of ROOMS) for (const light of roomLights(room.id, [])) {
    assert.ok(light.x > 0 && light.x < 480 && light.y > 0 && light.y < 320 && light.radius > 0);
  }
  assert.ok(roomLights('garden', []).every((l) => l.kind === 'lantern'));
  assert.ok(roomLights('ops', []).some((l) => l.kind === 'screen'));
  const lamp: RoomObject = { id: 'lamp', owner: 'test', roomId: 'office', kind: 'lamp', x: 5, y: 13, rotation: 0 };
  const other: RoomObject = { ...lamp, id: 'other', roomId: 'cafe' };
  assert.equal(roomLights('office', [lamp, other]).filter((l) => l.kind === 'lamp').length, 1);
  const moved = roomLights('office', [{ ...lamp, x: 7 }]).find((l) => l.kind === 'lamp')!;
  assert.equal(moved.x, 7.5 * 16);
  const turned = roomLights('office', [{ ...lamp, rotation: 1 }]).find((l) => l.kind === 'lamp')!;
  assert.equal(turned.x, 5.5 * 16 + 5); assert.equal(turned.y, 13.5 * 16);
  assert.equal(roomLights('office', []).some((l) => l.kind === 'lamp'), false);
});


test('rain and storms reduce sunlight and turn on indoor lamps during the day', () => {
  const now = Date.parse('2026-10-18T12:00:00+09:00');
  const clear = lightingAt(now, 'clear').palette, rain = lightingAt(now, 'rain').palette, storm = lightingAt(now, 'storm').palette;
  assert.ok(rain.sun < clear.sun && storm.sun < rain.sun);
  assert.ok(rain.shade > clear.shade && storm.shade > rain.shade);
  assert.ok(rain.lamps > clear.lamps && storm.lamps > rain.lamps);
});


test('control rooms have no sunlight or weather-dependent lighting; the garden is open air', () => {
  assert.equal(ROOMS.find((r) => r.id === 'ops')!.outlook, 'none');
  assert.equal(ROOMS.find((r) => r.id === 'garden')!.outlook, 'open');
  for (const hour of ['08', '12', '17', '22']) {
    const now = Date.parse(`2026-10-18T${hour}:00:00+09:00`);
    const clear = roomLightingAt('ops', now, 'clear').palette;
    assert.equal(clear.sun, 0); assert.ok(clear.lamps >= 0.7 && clear.shade <= 0.28);
    assert.deepEqual(roomLightingAt('ops', now, 'rain').palette, clear);
    assert.deepEqual(roomLightingAt('ops', now, 'storm').palette, clear);
  }
});
