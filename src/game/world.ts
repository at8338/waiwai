import { WALK_STEP_MS } from './transport.ts';
import type { VehicleKind } from './transport.ts';
import { getRoom, officeFurniture } from './rooms.ts';
import type { RoomId } from './rooms.ts';
export const TILE = 16;
export const COLS = 30;
export const ROWS = 20;
export const SPAWN = { x: 15, y: 12 };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Point = { x: number; y: number };
export type Furniture = Point & {
  kind: 'viewport' | 'console' | 'pilot' | 'reactor' | 'calendar' | 'desk' | 'workbench' | 'table' | 'sofa' | 'plant' | 'shelf' | 'board' | 'counter' | 'pond' | 'easel' | 'arcade' | 'bed' | 'telescope' | 'monitor' | 'rack' | 'parking' | 'vending';
  w: number;
  h: number;
  label?: string;
  vehicleKind?: VehicleKind;
};

export const furniture: Furniture[] = officeFurniture;

export function isWall(x: number, y: number, roomId: RoomId = 'office'): boolean {
  if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) return true;
  if (roomId !== 'office') return false;
  if ((x === 10 || x === 20) && y < 10) return true;
  return y === 10 && ![5, 6, 14, 15, 24, 25].includes(x);
}

export function canWalk(x: number, y: number, roomId: RoomId = 'office'): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || isWall(x, y, roomId)) return false;
  return !getRoom(roomId).furniture.some((item) => item.kind !== 'parking' &&
    x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h);
}

export function areaAt({ x, y, roomId }: Point & { roomId?: RoomId }): string {
  if (roomId && roomId !== 'office') return getRoom(roomId).name;
  if (y < 10) return x < 10 ? 'ワークエリア' : x < 20 ? 'ミーティングルーム' : 'ラウンジ';
  return y < 13 ? 'エントランス' : 'フリースペース';
}

export const STEP_MS = WALK_STEP_MS;
const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

// Tile coordinates stay authoritative; interpolation only controls the visual position.
export class Walker {
  tile: Point = { ...SPAWN };
  facing: Direction = 'down';
  private from: Point = { ...SPAWN };
  private elapsed: number;
  private stepMs: number;
  constructor(stepMs = STEP_MS) { this.stepMs = stepMs; this.elapsed = stepMs; }

  setStepMs(stepMs: number): void { this.elapsed = this.elapsed / this.stepMs * stepMs; this.stepMs = stepMs; }

  get moving(): boolean { return this.elapsed < this.stepMs; }

  step(direction: Direction): boolean {
    if (this.moving) return false;
    this.facing = direction;
    const vector = vectors[direction];
    const next = { x: this.tile.x + vector.x, y: this.tile.y + vector.y };
    if (!canWalk(next.x, next.y)) return false;
    this.from = { ...this.tile };
    this.tile = next;
    this.elapsed = 0;
    return true;
  }

  update(delta: number): void { this.elapsed = Math.min(this.stepMs, this.elapsed + Math.max(0, delta)); }

  position(): Point {
    const progress = this.elapsed / this.stepMs;
    return {
      x: (this.from.x + (this.tile.x - this.from.x) * progress + 0.5) * TILE,
      y: (this.from.y + (this.tile.y - this.from.y) * progress + 0.5) * TILE,
    };
  }

  // Network state is authoritative. Only the drawing interpolates between tiles.
  receive(tile: Point, facing: Direction, snap = false): void {
    this.facing = facing;
    if (!snap && tile.x === this.tile.x && tile.y === this.tile.y) return;
    const current = this.position();
    this.from = { x: current.x / TILE - 0.5, y: current.y / TILE - 0.5 };
    this.tile = { ...tile };
    const distance = Math.abs(this.from.x - tile.x) + Math.abs(this.from.y - tile.y);
    this.elapsed = snap || distance > 2 ? this.stepMs : 0;
    if (this.elapsed === this.stepMs) this.from = { ...tile };
  }

  reset(): void {
    this.tile = { ...SPAWN };
    this.from = { ...SPAWN };
    this.elapsed = this.stepMs;
    this.facing = 'down';
  }
}
