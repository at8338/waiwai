import { weatherAt } from './weather.ts';
import type { WeatherKind } from './weather.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { objectSize } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { TILE } from './world.ts';

export const WINDOW_COLUMNS = [3, 4, 7, 8, 14, 15, 24, 25];
// North-wall whiteboards occupy this wall space, including their raised face.
export function roomWindowColumns(roomId: RoomId): number[] {
  const room = getRoom(roomId);
  return room.outlook !== 'window' ? [] : WINDOW_COLUMNS.filter((x) => !room.furniture.some((item) =>
    item.kind === 'board' && item.y <= 1 && x >= item.x && x < item.x + item.w));
}
export const LIGHTING_PHASES = ['morning', 'day', 'evening', 'night'] as const;
export type LightingPhase = typeof LIGHTING_PHASES[number];
export const LIGHTING_LABELS: Record<LightingPhase, string> = { morning: '朝の光', day: '昼の光', evening: '夕暮れ', night: '夜のあかり' };
export type LightPalette = { tint: number; shade: number; sunColor: number; sun: number; slant: number; lamps: number; glass: number };
const PALETTES: Record<LightingPhase, LightPalette> = {
  morning: { tint: 0xffd79b, shade: 0.07, sunColor: 0xffd98c, sun: 0.19, slant: 45, lamps: 0.06, glass: 0xdce8ca },
  day: { tint: 0xffffe4, shade: 0, sunColor: 0xfff4d0, sun: 0.07, slant: 12, lamps: 0, glass: 0xb9dfd6 },
  evening: { tint: 0x9a4c45, shade: 0.21, sunColor: 0xffb76b, sun: 0.28, slant: -65, lamps: 0.48, glass: 0xe1a18b },
  night: { tint: 0x172b50, shade: 0.5, sunColor: 0xb9d6ff, sun: 0, slant: -65, lamps: 1, glass: 0x344b74 },
};
const STARTS: Record<LightingPhase, number> = { morning: 6 * 60, day: 10 * 60, evening: 16 * 60, night: 19 * 60 };
const mixColor = (a: number, b: number, amount: number) => {
  let result = 0;
  for (const shift of [16, 8, 0]) result |= Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount) << shift;
  return result;
};
export function lightingAt(timestamp: number, weather: WeatherKind = weatherAt(timestamp)): { phase: LightingPhase; time: string; weather: WeatherKind; palette: LightPalette } {
  // UTC getters plus a fixed offset keep JST independent of the device's timezone/DST.
  const jst = new Date(timestamp + 9 * 60 * 60 * 1000);
  const minute = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  const phase: LightingPhase = minute < 360 || minute >= 1140 ? 'night' : minute < 600 ? 'morning' : minute < 960 ? 'day' : 'evening';
  const next = LIGHTING_PHASES[(LIGHTING_PHASES.indexOf(phase) + 1) % LIGHTING_PHASES.length];
  const untilNext = (STARTS[next] - minute + 1440) % 1440;
  const amount = untilNext < 20 ? (20 - untilNext) / 20 : 0;
  const from = PALETTES[phase], to = PALETTES[next];
  const palette = { ...from };
  for (const key of ['shade', 'sun', 'slant', 'lamps'] as const) palette[key] = from[key] * (1 - amount) + to[key] * amount;
  for (const key of ['tint', 'sunColor', 'glass'] as const) palette[key] = mixColor(from[key], to[key], amount);
  if (weather !== 'clear') {
    palette.sun *= weather === 'rain' ? 0.22 : 0.07;
    palette.shade = Math.min(0.58, palette.shade + (weather === 'rain' ? 0.07 : 0.12));
    palette.tint = mixColor(palette.tint, 0x53697d, 0.35);
    palette.glass = mixColor(palette.glass, 0x677f91, 0.55);
    palette.lamps = Math.max(palette.lamps, weather === 'rain' ? 0.22 : 0.4);
  }
  return { phase, weather, time: `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`, palette };
}
export function roomLightingAt(roomId: RoomId, timestamp: number, weather?: WeatherKind): ReturnType<typeof lightingAt> {
  const state = lightingAt(timestamp, weather);
  if (getRoom(roomId).outlook !== 'none') return state;
  // Windowless control rooms use steady indoor lights, unaffected by outside weather.
  const base = lightingAt(timestamp, 'clear').palette;
  return { ...state, palette: { ...base, tint: 0x273e52, shade: 0.12 + base.shade * 0.32, sun: 0, lamps: 0.7 + base.lamps * 0.3 } };
}
export type RoomLight = { x: number; y: number; radius: number; color: number; kind: 'sconce' | 'lantern' | 'lamp' | 'screen' };
export function roomLights(roomId: RoomId, objects: readonly RoomObject[]): RoomLight[] {
  const room = getRoom(roomId);
  const color = roomId === 'ops' || roomId === 'arcade' || roomId === 'cockpit' ? 0xc6e7eb : 0xffcd86;
  const lights: RoomLight[] = roomId === 'garden'
    ? [[6, 4], [24, 4], [8, 15], [21, 15]].map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE, radius: 55, color, kind: 'lantern' }))
    : [5, 15, 25].filter((x) => !room.furniture.some((item) => item.kind === 'board' && item.y <= 1 && x >= item.x && x < item.x + item.w))
      .map((x) => ({ x: (x + 0.5) * TILE, y: 20, radius: 83, color, kind: 'sconce' }));
  if (room.sections) for (const section of room.sections) lights.push({ x: (section.x < 14 ? 13.5 : 16.5) * TILE, y: (section.y + 3) * TILE, radius: 91, color, kind: 'sconce' });
  if (roomId === 'office') for (const x of [8, 22]) lights.push({ x: (x + 0.5) * TILE, y: 10 * TILE + 7, radius: 90, color, kind: 'sconce' });
  else if (roomId !== 'garden') for (const x of [1, 28]) lights.push({ x: (x + 0.5) * TILE, y: 13 * TILE, radius: 95, color, kind: 'sconce' });
  for (const item of [...room.furniture, ...objects.filter((o) => o.roomId === roomId)]) {
    if (item.kind !== 'lamp' && item.kind !== 'monitor' && item.kind !== 'arcade' && item.kind !== 'viewport' && item.kind !== 'reactor' && item.kind !== 'console') continue;
    const size = 'rotation' in item ? objectSize(item.kind, item.rotation) : item;
    const rotation = 'rotation' in item ? item.rotation : 0;
    const lampOffset = item.kind === 'lamp' ? [[0, -5], [5, 0], [0, 5], [-5, 0]][rotation] : [0, 0];
    lights.push({ x: (item.x + size.w / 2) * TILE + lampOffset[0], y: (item.y + size.h / 2) * TILE + lampOffset[1],
      radius: item.kind === 'lamp' ? 54 : Math.max(25, size.w * TILE * 0.7), color: item.kind === 'lamp' ? 0xffcd86 : 0xa5dce3,
      kind: item.kind === 'lamp' ? 'lamp' : 'screen' });
  }
  return lights;
}
