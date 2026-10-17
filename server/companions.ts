import { canWalk } from '../src/game/world.ts';
import type { Direction, Point } from '../src/game/world.ts';
import { getRoom } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
import { facingBetween, ROAMING_RESIDENTS } from '../src/game/buddies.ts';
import type { RoomPet } from '../src/game/buddies.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import type { RoomObject } from '../src/game/objects.ts';
import type { Player } from '../src/network/protocol.ts';
import { pokemonRoster } from '../src/game/pokemon-spawns.ts';
import { isPokemonKind } from '../src/game/pokemon.ts';

const vectors: Record<Direction, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
export function resetBuddy(player: Player, objects: readonly RoomObject[]): void {
  if (!player.buddy) { delete player.buddyPosition; return; }
  const order: Direction[] = [opposite[player.facing], 'left', 'right', player.facing, 'up', 'down'];
  const destination = order.map((d) => ({ x: player.x + vectors[d].x, y: player.y + vectors[d].y }))
    .find((p) => walkableWithObjects(p.x, p.y, player.roomId, objects));
  player.buddyPosition = { ...(destination ?? { x: player.x, y: player.y }), facing: player.facing };
}
export function advanceBuddy(player: Player, previous: Point): void {
  if (!player.buddy) return;
  player.buddyPosition = { ...previous, facing: facingBetween(player.buddyPosition ?? previous, previous, player.facing) };
}

export class RoomPets {
  private pets: RoomPet[];
  private random: () => number;
  constructor(random = Math.random, now = Date.now()) {
    this.random = random;
    this.pets = ROAMING_RESIDENTS.map(({ kind, roomId, x, y }) => ({
      id: `pet:${kind}`, roomId, kind, ...this.floorNear(roomId, { x, y }, []), facing: 'down' as Direction,
    }));
    this.replacePokemon(pokemonRoster(now), []);
  }
  replacePokemon(roster: ReturnType<typeof pokemonRoster>, objects: readonly RoomObject[]): void {
    this.pets = this.pets.filter((pet) => !isPokemonKind(pet.kind));
    for (const { kind, roomId, x, y } of roster) {
      const occupied = this.pets.filter((pet) => pet.roomId === roomId).map((pet) => ({ id: pet.id, owner: 'resident', kind: 'mug' as const, rotation: 0, roomId, x: pet.x, y: pet.y }));
      this.pets.push({ id: `pet:${kind}`, kind, roomId, ...this.floorNear(roomId, { x, y }, [...objects, ...occupied]), facing: 'down' });
    }
  }
  list(roomId: RoomId): RoomPet[] { return this.pets.filter((p) => p.roomId === roomId).map((p) => ({ ...p })); }
  private floorNear(roomId: RoomId, origin: Point, objects: readonly RoomObject[]): Point {
    const room = getRoom(roomId), points: Point[] = [];
    for (let y = 1; y < 19; y++) for (let x = 1; x < 29; x++) {
      if (walkableWithObjects(x, y, roomId, objects) && Math.abs(x - room.door.x) + Math.abs(y - room.door.y) > 1 &&
        Math.abs(x - room.spawn.x) + Math.abs(y - room.spawn.y) > 1) points.push({ x, y });
    }
    points.sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - Math.abs(b.x - origin.x) - Math.abs(b.y - origin.y));
    return points[0] ?? room.spawn;
  }
  step(objects: readonly RoomObject[], players: Iterable<Player>): Set<RoomId> {
    const people = [...players], changed = new Set<RoomId>();
    for (const pet of this.pets) {
      if (!walkableWithObjects(pet.x, pet.y, pet.roomId, objects)) {
        Object.assign(pet, this.floorNear(pet.roomId, pet, objects)); changed.add(pet.roomId); continue;
      }
      if (this.random() < 0.4) continue;
      const order = (Object.keys(vectors) as Direction[]).map((direction) => ({ direction, weight: this.random() - (direction === pet.facing ? 0.4 : 0) })).sort((a, b) => a.weight - b.weight);
      const room = getRoom(pet.roomId);
      for (const { direction } of order) {
        const next = { x: pet.x + vectors[direction].x, y: pet.y + vectors[direction].y };
        if (!canWalk(next.x, next.y, pet.roomId) || !walkableWithObjects(next.x, next.y, pet.roomId, objects) ||
          Math.abs(next.x - room.door.x) + Math.abs(next.y - room.door.y) <= 1 ||
          Math.abs(next.x - room.spawn.x) + Math.abs(next.y - room.spawn.y) <= 1 ||
          people.some((p) => p.roomId === pet.roomId && p.x === next.x && p.y === next.y) ||
          this.pets.some((p) => p !== pet && p.roomId === pet.roomId && p.x === next.x && p.y === next.y)) continue;
        Object.assign(pet, next, { facing: direction }); changed.add(pet.roomId); break;
      }
    }
    return changed;
  }
}
