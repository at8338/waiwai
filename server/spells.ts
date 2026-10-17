import type { Player } from '../src/network/protocol.ts';
import type { Point } from '../src/game/world.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import { getRoom } from '../src/game/rooms.ts';
import { voiceZone } from '../src/audio/proximity.ts';
export function callDestinations(caster: Player, targets: readonly Player[], people: Iterable<Player>, objects: readonly RoomObject[]): Point[] | undefined {
  const moving = new Set(targets.map((person) => person.id));
  const occupied = new Set([...people].filter((person) => person.roomId === caster.roomId && !moving.has(person.id)).map((person) => `${person.x},${person.y}`));
  const room = getRoom(caster.roomId);
  const neighbors = [[-1, 0], [1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: caster.x + dx, y: caster.y + dy }))
    .filter((point) => walkableWithObjects(point.x, point.y, caster.roomId, objects) && !(point.x === room.door.x && point.y === room.door.y) && voiceZone({ ...point, roomId: caster.roomId }) === voiceZone(caster));
  if (!neighbors.length && !walkableWithObjects(caster.x, caster.y, caster.roomId, objects)) return;
  const destinations: Point[] = [];
  for (let index = 0; index < targets.length; index++) {
    // Prefer each free neighbor, then share a valid neighbor. When all four
    // sides are solid, the anchor's floor is the last resort.
    const point = neighbors.find((point) => !occupied.has(`${point.x},${point.y}`)) ?? neighbors[index % neighbors.length] ?? { x: caster.x, y: caster.y };
    destinations.push({ ...point }); occupied.add(`${point.x},${point.y}`);
  }
  return destinations;
}
export function fireDestination(caster: Player, objects: readonly RoomObject[]): Point {
  const [dx, dy] = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[caster.facing];
  let destination = { x: caster.x, y: caster.y };
  for (let step = 1; step <= 5; step++) {
    const point = { x: caster.x + dx * step, y: caster.y + dy * step };
    if (!walkableWithObjects(point.x, point.y, caster.roomId, objects)) break;
    destination = point;
  }
  return destination;
}
