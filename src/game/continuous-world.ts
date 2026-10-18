import { ROOM_IDS } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { COLS, ROWS, canWalk } from './world.ts';
import type { Direction, Point } from './world.ts';

// Stable geography: hiding an area closes its passages; it never rearranges the building.
export const WORLD_COLUMNS = 4;
export const WORLD_ROWS = Math.ceil(ROOM_IDS.length / WORLD_COLUMNS);
export type WorldTile = Point & { roomId: RoomId };
export function roomOrigin(roomId: RoomId): Point {
  const index = ROOM_IDS.indexOf(roomId);
  return { x: index % WORLD_COLUMNS * COLS, y: Math.floor(index / WORLD_COLUMNS) * ROWS };
}
export function worldPoint(point: WorldTile): Point {
  const origin = roomOrigin(point.roomId);
  return { x: origin.x + point.x, y: origin.y + point.y };
}
export function worldTile(x: number, y: number): WorldTile | undefined {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= WORLD_COLUMNS * COLS || y >= WORLD_ROWS * ROWS) return;
  const roomId = ROOM_IDS[Math.floor(y / ROWS) * WORLD_COLUMNS + Math.floor(x / COLS)];
  return roomId ? { roomId, x: x % COLS, y: y % ROWS } : undefined;
}
export function neighbor(roomId: RoomId, direction: Direction): RoomId | undefined {
  const origin = roomOrigin(roomId);
  const delta = { left: [-COLS, 0], right: [COLS, 0], up: [0, -ROWS], down: [0, ROWS] }[direction];
  return worldTile(origin.x + delta[0], origin.y + delta[1])?.roomId;
}
// Doorways span the free parts of each shared wall. Furniture and interior walls
// are preserved, and both sides must have an unobstructed approach.
export function passage(roomId: RoomId, x: number, y: number, allowed: (id: RoomId) => boolean = () => true): boolean {
  if (!allowed(roomId) || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
  const direction = x === 0 ? 'left' : x === COLS - 1 ? 'right' : y === 0 ? 'up' : y === ROWS - 1 ? 'down' : undefined;
  if (!direction || (x === 0 || x === COLS - 1) && (y === 0 || y === ROWS - 1)) return false;
  const other = neighbor(roomId, direction);
  if (!other || !allowed(other)) return false;
  return direction === 'left' ? canWalk(1, y, roomId) && canWalk(COLS - 2, y, other)
    : direction === 'right' ? canWalk(COLS - 2, y, roomId) && canWalk(1, y, other)
    : direction === 'up' ? canWalk(x, 1, roomId) && canWalk(x, ROWS - 2, other)
    : canWalk(x, ROWS - 2, roomId) && canWalk(x, 1, other);
}
export function continuousWalkable(point: WorldTile, allowed: (id: RoomId) => boolean = () => true): boolean {
  return allowed(point.roomId) && (canWalk(point.x, point.y, point.roomId) || passage(point.roomId, point.x, point.y, allowed));
}
export function worldStep(point: WorldTile, direction: Direction): WorldTile | undefined {
  const p = worldPoint(point), delta = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[direction];
  return worldTile(p.x + delta[0], p.y + delta[1]);
}
