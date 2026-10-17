import type { Point } from '../game/world.ts';

export const VOICE_RADIUS = 5;
export const MAX_VOICE_MEMBERS = 30;
export const MAX_VOICE_PEERS = 4;

export function voiceZone({ x, y, roomId }: Point & { roomId?: string }): string {
  if (roomId && roomId !== 'office') return roomId;
  if (y >= 10) return 'common';
  return x < 10 ? 'work' : x < 20 ? 'meeting' : 'lounge';
}

export function proximityGain(a: Point & { roomId?: string }, b: Point & { roomId?: string }): number {
  if ((a.roomId ?? 'office') !== (b.roomId ?? 'office')) return 0;
  if (voiceZone(a) !== voiceZone(b)) return 0;
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  if (distance >= VOICE_RADIUS) return 0;
  return Math.min(1, (VOICE_RADIUS - distance) / (VOICE_RADIUS - 1.5));
}
