import type { Player } from '../src/network/protocol.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import { voiceZone } from '../src/audio/proximity.ts';
import { getRoom } from '../src/game/rooms.ts';

export function adjacentTile(target: Player, travelerId: string, players: Iterable<Player>, objects: readonly RoomObject[]): { x: number; y: number } | undefined {
  const occupied = new Set([...players].filter((p) => p.id !== travelerId && p.roomId === target.roomId).map((p) => `${p.x},${p.y}`));
  const door = getRoom(target.roomId).door;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [0, -1]]) {
    const point = { x: target.x + dx, y: target.y + dy, roomId: target.roomId };
    if (!(point.x === door.x && point.y === door.y) && !occupied.has(`${point.x},${point.y}`) && walkableWithObjects(point.x, point.y, point.roomId, objects) && voiceZone(point) === voiceZone(target)) {
      return { x: point.x, y: point.y };
    }
  }
}
