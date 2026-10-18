import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { objectSize, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { TILE } from './world.ts';
import type { Point, Direction } from './world.ts';
export type SeatSpot = { id: string; name: string; approach: Point; anchor: Point; facing: Direction; depth: number };

// Seats use existing walkable approach tiles: collision, voice and networking retain their tile coordinates.
export function seatSpots(roomId: RoomId, objects: readonly RoomObject[]): Map<string, SeatSpot> {
  const seats = new Map<string, SeatSpot>();
  const add = (seat: SeatSpot) => {
    const key = `${seat.approach.x},${seat.approach.y}`;
    if (!seats.has(key) && walkableWithObjects(seat.approach.x, seat.approach.y, roomId, objects)) seats.set(key, seat);
  };
  for (const item of objects.filter((o) => o.roomId === roomId && (o.kind === 'chair' || o.kind === 'desk'))) {
    const base = objectSize(item.kind), size = objectSize(item.kind, item.rotation);
    const rotate = (x: number, y: number): Point => {
      for (let r = 0; r < item.rotation; r++) [x, y] = [-y, x];
      return { x: (item.x + size.w / 2) * TILE + x, y: (item.y + size.h / 2) * TILE + y };
    };
    const approach = rotate(0, (base.h / 2 + 0.5) * TILE);
    const anchor = rotate(0, base.h / 2 * TILE - (item.kind === 'chair' ? 2 : 0));
    const facing: Direction[] = item.kind === 'chair' ? ['down', 'left', 'up', 'right'] : ['up', 'right', 'down', 'left'];
    add({ id: `placed:${item.id}`, name: item.kind === 'chair' ? '椅子' : 'デスク',
      approach: { x: Math.floor(approach.x / TILE), y: Math.floor(approach.y / TILE) }, anchor,
      facing: facing[item.rotation], depth: Math.max(anchor.y + 7, (item.y + size.h) * TILE + 1) });
  }
  for (const item of getRoom(roomId).furniture) {
    const id = `fixed:${roomId}:${item.kind}:${item.x}:${item.y}`;
    if (item.kind === 'pilot') {
      add({ id, name: 'パイロット席', approach: { x: item.x + 1, y: item.y + item.h }, anchor: { x: (item.x + 1) * TILE, y: (item.y + item.h) * TILE - 4 }, facing: 'up', depth: (item.y + item.h) * TILE + 7 });
    } else if (item.kind === 'desk' || item.kind === 'workbench') {
      add({ id, name: item.kind === 'desk' ? 'デスク' : '作業台', approach: { x: item.x + 1, y: item.y + item.h },
        anchor: { x: (item.x + 1.5) * TILE, y: (item.y + item.h) * TILE }, facing: 'up', depth: (item.y + item.h) * TILE + 7 });
    } else if (item.kind === 'sofa') {
      for (let i = 0; i < item.w; i++) {
        const y = (item.y + item.h) * TILE;
        add({ id: `${id}:${i}`, name: 'ソファ', approach: { x: item.x + i, y: item.y + item.h },
          anchor: { x: (item.x + i + 0.5) * TILE, y: y - 7 }, facing: 'down', depth: y + 7 });
      }
    } else if (item.kind === 'table' && item.h > 1) {
      for (let i = 5; i < item.w * TILE - 4; i += 18) for (const side of ['top', 'bottom'] as const) {
        const x = item.x * TILE + i + 6, bottom = side === 'bottom';
        const y = (item.y + (bottom ? item.h : 0)) * TILE;
        add({ id: `${id}:${side}:${i}`, name: 'テーブル', approach: { x: Math.floor(x / TILE), y: item.y + (bottom ? item.h : -1) },
          // The back chair is above the tabletop. Pulling the avatar into the
          // table hides its torso because the table correctly draws in front.
          anchor: { x, y: y + (bottom ? 1 : -5) }, facing: bottom ? 'up' : 'down', depth: y + 7 });
      }
    }
  }
  return seats;
}
export function restingSeat(seats: ReadonlyMap<string, SeatSpot>, point: Point, moving: boolean, riding: boolean, reacting: boolean): SeatSpot | undefined {
  return !moving && !riding && !reacting ? seats.get(`${point.x},${point.y}`) : undefined;
}
