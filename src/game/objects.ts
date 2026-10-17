import { canWalk, COLS, ROWS } from './world.ts';
import { getRoom, isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
export const OBJECT_KINDS = ['plant', 'books', 'lamp', 'mug', 'cushion', 'flowers', 'box', 'mat'] as const;
export type ObjectKind = typeof OBJECT_KINDS[number];
export const OBJECT_CATALOG: Record<ObjectKind, { name: string; icon: string; solid: boolean }> = {
  plant: { name: '鉢植え', icon: '♧', solid: true }, books: { name: '本の山', icon: '▤', solid: false },
  lamp: { name: 'フロアランプ', icon: '♙', solid: true }, mug: { name: 'マグカップ', icon: '☕', solid: false },
  cushion: { name: 'クッション', icon: '◇', solid: false }, flowers: { name: '花かご', icon: '✿', solid: true },
  box: { name: '木箱', icon: '▣', solid: true }, mat: { name: 'ミニラグ', icon: '▱', solid: false },
};
export const MAX_ROOM_OBJECTS = 60;
export type RoomObject = { id: string; owner: string; roomId: RoomId; kind: ObjectKind; x: number; y: number; rotation: number };
export function isObjectKind(value: unknown): value is ObjectKind { return typeof value === 'string' && (OBJECT_KINDS as readonly string[]).includes(value); }
export function validObject(value: unknown): value is RoomObject {
  if (!value || typeof value !== 'object') return false;
  const o = value as RoomObject;
  return typeof o.id === 'string' && /^[a-f0-9-]{36}$/.test(o.id) && typeof o.owner === 'string' && o.owner.length <= 100 &&
    isRoomId(o.roomId) && isObjectKind(o.kind) && Number.isInteger(o.x) && Number.isInteger(o.y) &&
    o.x > 0 && o.x < COLS - 1 && o.y > 0 && o.y < ROWS - 1 && Number.isInteger(o.rotation) && o.rotation >= 0 && o.rotation < 4;
}
export function walkableWithObjects(x: number, y: number, roomId: RoomId, objects: readonly RoomObject[]): boolean {
  return canWalk(x, y, roomId) && !objects.some((o) => o.roomId === roomId && o.x === x && o.y === y && OBJECT_CATALOG[o.kind].solid);
}
export function placementProblem(candidate: RoomObject, objects: readonly RoomObject[], occupied: Array<{ roomId?: RoomId; x: number; y: number }> = []): string | undefined {
  const room = getRoom(candidate.roomId);
  const others = objects.filter((o) => o.id !== candidate.id && o.roomId === candidate.roomId);
  if (!canWalk(candidate.x, candidate.y, candidate.roomId)) return '壁や家具の上には置けません。';
  if (others.some((o) => o.x === candidate.x && o.y === candidate.y)) return 'そのマスには小物が置かれています。';
  if (others.length >= MAX_ROOM_OBJECTS) return `この部屋には${MAX_ROOM_OBJECTS}個まで置けます。`;
  if ([room.spawn, room.door].some((p) => Math.abs(p.x - candidate.x) + Math.abs(p.y - candidate.y) <= 1)) return '入口とドアのまわりは空けておきましょう。';
  if (occupied.some((p) => (p.roomId ?? 'office') === candidate.roomId && p.x === candidate.x && p.y === candidate.y)) return 'アバターがいるマスには置けません。';
  if (!OBJECT_CATALOG[candidate.kind].solid) return;
  const combined = [...others, candidate];
  const visited = new Set<string>();
  const queue = [room.spawn];
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i], key = `${p.x},${p.y}`;
    if (visited.has(key) || !walkableWithObjects(p.x, p.y, candidate.roomId, combined)) continue;
    visited.add(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) queue.push({ x: p.x + dx, y: p.y + dy });
  }
  for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
    if (walkableWithObjects(x, y, candidate.roomId, combined) && !visited.has(`${x},${y}`)) return '通り道をふさぐ位置には置けません。';
  }
}
