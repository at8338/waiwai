export const TILE = 16;
export const COLS = 30;
export const ROWS = 20;
export const SPAWN = { x: 15, y: 12 };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Point = { x: number; y: number };
export type Furniture = Point & {
  kind: 'desk' | 'table' | 'sofa' | 'plant' | 'shelf';
  w: number;
  h: number;
};

export const furniture: Furniture[] = [
  { kind: 'desk', x: 2, y: 3, w: 3, h: 2 },
  { kind: 'desk', x: 6, y: 3, w: 3, h: 2 },
  { kind: 'desk', x: 2, y: 7, w: 3, h: 2 },
  { kind: 'desk', x: 6, y: 7, w: 3, h: 2 },
  { kind: 'table', x: 13, y: 4, w: 4, h: 3 },
  { kind: 'plant', x: 18, y: 2, w: 1, h: 1 },
  { kind: 'shelf', x: 11, y: 1, w: 2, h: 1 },
  { kind: 'sofa', x: 23, y: 3, w: 4, h: 2 },
  { kind: 'table', x: 24, y: 6, w: 2, h: 1 },
  { kind: 'plant', x: 27, y: 8, w: 1, h: 1 },
  { kind: 'shelf', x: 21, y: 1, w: 2, h: 1 },
  { kind: 'plant', x: 2, y: 12, w: 1, h: 1 },
  { kind: 'plant', x: 27, y: 12, w: 1, h: 1 },
  { kind: 'desk', x: 4, y: 14, w: 3, h: 2 },
  { kind: 'desk', x: 8, y: 14, w: 3, h: 2 },
  { kind: 'shelf', x: 1, y: 17, w: 3, h: 1 },
  { kind: 'sofa', x: 20, y: 15, w: 4, h: 2 },
  { kind: 'plant', x: 26, y: 17, w: 1, h: 1 },
];

export function isWall(x: number, y: number): boolean {
  if (x === 0 || x === COLS - 1 || y === 0 || y === ROWS - 1) return true;
  if ((x === 10 || x === 20) && y < 10) return true;
  return y === 10 && ![5, 6, 14, 15, 24, 25].includes(x);
}

export function canWalk(x: number, y: number): boolean {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
  if (x < 0 || y < 0 || x >= COLS || y >= ROWS || isWall(x, y)) return false;
  return !furniture.some((item) =>
    x >= item.x && x < item.x + item.w && y >= item.y && y < item.y + item.h);
}

export function areaAt({ x, y }: Point): string {
  if (y < 10) return x < 10 ? 'ワークエリア' : x < 20 ? 'ミーティングルーム' : 'ラウンジ';
  return y < 13 ? 'エントランス' : 'フリースペース';
}

export const STEP_MS = 145;
const vectors: Record<Direction, Point> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

// Tile coordinates stay authoritative; interpolation only controls the visual position.
export class Walker {
  tile: Point = { ...SPAWN };
  facing: Direction = 'down';
  private from: Point = { ...SPAWN };
  private elapsed = STEP_MS;

  get moving(): boolean { return this.elapsed < STEP_MS; }

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

  update(delta: number): void { this.elapsed = Math.min(STEP_MS, this.elapsed + Math.max(0, delta)); }

  position(): Point {
    const progress = this.elapsed / STEP_MS;
    return {
      x: (this.from.x + (this.tile.x - this.from.x) * progress + 0.5) * TILE,
      y: (this.from.y + (this.tile.y - this.from.y) * progress + 0.5) * TILE,
    };
  }

  reset(): void {
    this.tile = { ...SPAWN };
    this.from = { ...SPAWN };
    this.elapsed = STEP_MS;
    this.facing = 'down';
  }
}
