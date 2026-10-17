import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { objectContains, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { touchingVehicleDock } from './transport.ts';
import { seatSpots } from './seating.ts';
import type { Pixel } from './avatar.ts';
export const LOST_ITEM_PERIOD_MS = 30 * 60 * 1000;
export const LOST_ITEM_CATALOG = {
  glove: { name: '片方だけの宇宙服の手袋', note: 'もう片方は、たぶん月にあります。' },
  stone: { name: '「あとで読む」と書かれた石', note: '積ん読の重さが、ついに物理になりました。' },
  box: { name: '月曜日のやる気（未開封）', note: '開封予定日は、まだ決まっていません。' },
  duck: { name: '会議を抜け出したアヒル', note: '「次の会議があります」と言って出てきたそうです。' },
  key: { name: 'エンターキーだけのキーボード', note: '決断だけは、すごく早い。' },
  acorn: { name: '「部長」と書かれたどんぐり', note: 'どんぐりにも組織があるのでしょうか。' },
  plane: { name: 'Wi-Fiを探す紙飛行機', note: '電波のよい席を探して、ここまで飛んできました。' },
  envelope: { name: '昨日の正解が入った封筒', note: '昨日届いていれば、助かったのに。' },
  screw: { name: '有給休暇中のネジ', note: '今日は、何にも締めつけられたくないそうです。' },
  banana: { name: '「至急」の付箋がついたバナナ', note: '熟れるまで、あと少しお待ちください。' },
} as const;
export type LostItemKind = keyof typeof LOST_ITEM_CATALOG;
export type LostItem = { id: string; kind: LostItemKind; x: number; y: number };
export function lostItemsAt(roomId: RoomId, timestamp: number, objects: readonly RoomObject[] = []): LostItem[] {
  const bucket = Math.floor(timestamp / LOST_ITEM_PERIOD_MS), room = getRoom(roomId);
  let seed = bucket >>> 0;
  for (const c of roomId) seed = Math.imul(seed ^ c.charCodeAt(0), 16777619) >>> 0;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const seats = seatSpots(roomId, objects), free: { x: number; y: number }[] = [];
  for (let y = 2; y < 18; y++) for (let x = 2; x < 28; x++) {
    if (walkableWithObjects(x, y, roomId, objects) && !objects.some((o) => o.roomId === roomId && objectContains(o, x, y)) && !touchingVehicleDock({ roomId, x, y }) && !seats.has(`${x},${y}`) &&
      [room.spawn, room.door].every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 2)) free.push({ x, y });
  }
  const kinds = Object.keys(LOST_ITEM_CATALOG) as LostItemKind[], result: LostItem[] = [];
  for (let i = 0; i < 3 && free.length; i++) {
    const point = free.splice(next() % free.length, 1)[0], kind = kinds.splice(next() % kinds.length, 1)[0];
    result.push({ ...point, kind, id: `lost:${roomId}:${bucket}:${i}` });
  }
  return result;
}
export function lostItemPixels(kind: LostItemKind): Pixel[] {
  const pixels: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  if (kind === 'duck') {
    p(0xdbb85d, 3, 7, 9, 6); p(0xf2d572, 2, 6, 9, 6); p(0xf2d572, 8, 2, 5, 6); p(0xe39454, 12, 5, 3, 2); p(0x3e4845, 11, 4, 1, 1);
  } else if (kind === 'glove') {
    p(0x879ea9, 4, 6, 8, 7); p(0xe8e8d9, 5, 3, 2, 8); p(0xe8e8d9, 8, 2, 2, 9); p(0xe8e8d9, 11, 4, 2, 7); p(0xe8e8d9, 2, 7, 3, 4); p(0x6a858b, 5, 12, 7, 2);
  } else if (kind === 'stone') {
    p(0x778387, 3, 6, 10, 7); p(0xa5b0a7, 5, 4, 6, 7); p(0xe3d9b5, 4, 7, 8, 3); p(0x667970, 5, 8, 6, 1);
  } else if (kind === 'box') {
    p(0xa78358, 3, 5, 10, 9); p(0xd8b679, 3, 4, 10, 3); p(0xf0e3b9, 7, 4, 2, 10); p(0x779c86, 4, 8, 2, 3);
  } else if (kind === 'key') {
    p(0x617478, 3, 5, 10, 8); p(0xdfe3d1, 4, 4, 8, 7); p(0x607e82, 7, 6, 3, 3); p(0xdfe3d1, 7, 6, 2, 2); p(0x607e82, 6, 8, 4, 1);
  } else if (kind === 'acorn') {
    p(0xae794b, 5, 6, 6, 7); p(0xce9c5f, 6, 8, 4, 4); p(0x72563c, 4, 5, 8, 4); p(0x72563c, 8, 2, 2, 4); p(0xe9d9ae, 6, 6, 4, 2);
  } else if (kind === 'plane') {
    for (let i = 0; i < 10; i++) p(i % 2 ? 0xe8e8d4 : 0xc2d4cd, 2 + i, 12 - i, 2, i + 1);
    p(0x7c9d9d, 6, 10, 6, 1);
  } else if (kind === 'envelope') {
    p(0xb8996a, 2, 6, 12, 7); p(0xf0e3b9, 2, 5, 12, 6); p(0xc6b08a, 4, 6, 8, 2); p(0xc6b08a, 6, 8, 4, 2); p(0x83a28d, 11, 6, 2, 2);
  } else if (kind === 'screw') {
    p(0x718a91, 6, 6, 4, 8); p(0xb8c8bd, 4, 3, 8, 5); p(0x61757e, 5, 5, 6, 1); p(0xb8c8bd, 5, 9, 6, 1); p(0xb8c8bd, 5, 12, 6, 1);
  } else {
    p(0xd0a34f, 4, 3, 3, 9); p(0xf0d77d, 6, 7, 6, 6); p(0xe9c667, 9, 5, 4, 7); p(0x8d7250, 11, 3, 2, 3); p(0xe5a08a, 3, 5, 4, 3);
  }
  return pixels;
}
