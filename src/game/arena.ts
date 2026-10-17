import type { Point, Direction } from './world.ts';
import type { RoomId } from './rooms.ts';
export const ARENA_HP = 100, FIRE_DAMAGE = 25, ARENA_DURATION = 90_000, ICE_DURATION = 3000;
export type IceShield = Point & { id: string; ownerId: string; roomId: RoomId; expiresAt: number };
export type IceSnapshot = { shields: IceShield[]; activeUntil: number; serverNow: number };
export type ArenaFighter = { id: string; name: string; hp: number };
export type ArenaProjectile = Point & { id: string; ownerId: string; direction: Direction; nextAt: number; remaining: number };
export type ArenaState = { roundId: string; phase: 'waiting' | 'playing' | 'finished'; fighters: ArenaFighter[]; endsAt: number; winnerId?: string; result: string; projectiles: ArenaProjectile[]; revision: number };
export type ArenaAction = { type: 'arena-action'; command: 'join' | 'leave'; actionId: string };
