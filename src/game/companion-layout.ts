import { buddyMapSize } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
import { TILE, COLS, ROWS } from './world.ts';
import type { Point } from './world.ts';
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
/** Keep the complete sprite inside the outer walls, including floating and bobbing. */
export function companionLayout(kind: BuddyKind, point: Point, lift = 0) {
  const { width, height } = buddyMapSize(kind);
  const x = clamp(point.x, TILE + width / 2, (COLS - 1) * TILE - width / 2);
  const floor = clamp(point.y + 6, TILE + height + 4.5, (ROWS - 1) * TILE);
  return { x, y: floor - lift, floor, depth: floor - 5.9, shadowWidth: width * .55, shadowHeight: Math.max(4, width * .12) };
}
