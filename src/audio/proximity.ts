import type { Point } from '../game/world.ts';

export const VOICE_RADIUS = 5;
export const MAX_VOICE_MEMBERS = 8;

export function voiceZone({ x, y }: Point): string {
  if (y >= 10) return 'common';
  return x < 10 ? 'work' : x < 20 ? 'meeting' : 'lounge';
}

export function proximityGain(a: Point, b: Point): number {
  if (voiceZone(a) !== voiceZone(b)) return 0;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  if (distance >= VOICE_RADIUS) return 0;
  return Math.min(1, (VOICE_RADIUS - distance) / (VOICE_RADIUS - 1.5));
}
