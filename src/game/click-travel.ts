import { COLS, ROWS } from './world.ts';
import type { Point, Direction } from './world.ts';
const steps = [{ direction: 'up', x: 0, y: -1 }, { direction: 'right', x: 1, y: 0 }, { direction: 'down', x: 0, y: 1 }, { direction: 'left', x: -1, y: 0 }] as const;
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
export function clickPath(from: Point, to: Point, walkable: (x: number, y: number) => boolean, bounds = { width: COLS, height: ROWS }): Direction[] | undefined {
  if (!Number.isInteger(to.x) || !Number.isInteger(to.y) || !walkable(to.x, to.y)) return;
  const queue = [{ ...from, path: [] as Direction[] }], visited = new Set([`${from.x},${from.y}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]; if (same(current, to)) return current.path;
    for (const step of steps) {
      const x = current.x + step.x, y = current.y + step.y, key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height || visited.has(key) || !walkable(x, y)) continue;
      visited.add(key); queue.push({ x, y, path: [...current.path, step.direction] });
    }
  }
}
export function clickDashDirection(from: Point, to: Point): Direction | undefined {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!dx && !dy) return;
  return Math.abs(dx) >= Math.abs(dy) ? dx > 0 ? 'right' : 'left' : dy > 0 ? 'down' : 'up';
}
export class ClickTravel {
  private bounds: { width: number; height: number };
  constructor(bounds = { width: COLS, height: ROWS }) { this.bounds = bounds; }
  goal?: Point;
  lastStop?: 'arrived' | 'blocked';
  private attempted?: Point;
  private dash?: Direction;
  clear(): void { this.goal = undefined; this.attempted = undefined; this.dash = undefined; this.lastStop = undefined; }
  set(from: Point, to: Point, walkable: (x: number, y: number) => boolean, dash = false): boolean {
    this.clear();
    if (dash) { this.dash = clickDashDirection(from, to); return !!this.dash; }
    if (!clickPath(from, to, walkable, this.bounds)) return false;
    this.goal = { ...to }; return true;
  }
  next(from: Point, walkable: (x: number, y: number) => boolean): { direction: Direction; dash: boolean } | undefined {
    if (this.dash) { const direction = this.dash; this.clear(); return { direction, dash: true }; }
    if (!this.goal) return;
    // A rejected server step must stop the route rather than resend forever.
    if (this.attempted && same(from, this.attempted)) { this.clear(); this.lastStop = 'blocked'; return; }
    const path = clickPath(from, this.goal, walkable, this.bounds);
    if (!path?.length) { const arrived = same(from, this.goal); this.clear(); this.lastStop = arrived ? 'arrived' : 'blocked'; return; }
    this.attempted = { ...from }; return { direction: path[0], dash: false };
  }
}
