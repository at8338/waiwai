import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import type { Point } from './world.ts';
export function vendingInReach(player: Point & { roomId: RoomId }): string | undefined {
  const machine = getRoom(player.roomId).furniture.find((f) => f.kind === 'vending' &&
    Math.max(f.x - player.x, 0, player.x - (f.x + f.w - 1)) + Math.max(f.y - player.y, 0, player.y - (f.y + f.h - 1)) <= 1);
  return machine ? `vending:${player.roomId}:${machine.x}:${machine.y}` : undefined;
}
