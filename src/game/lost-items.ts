import { getRoom, ROOM_IDS } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { objectContains, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { touchingVehicleDock } from './transport.ts';
import { seatSpots } from './seating.ts';
import { EXTRA_LOST_ITEMS } from './lost-items-catalog.ts';
import { lostItemArt } from './lost-item-art.ts';
import type { LostItemArt } from './lost-item-art.ts';
import type { Pixel } from './avatar.ts';
export const LOST_ITEM_PERIOD_MS = 30 * 60 * 1000;
export const MAX_LOST_ITEMS = 3;
export const LOST_ITEMS_EPOCH = Date.UTC(2026, 9, 17);
export const LEGACY_LOST_ITEMS = {
  glove: { art: 'glove', name: '片方だけの宇宙服の手袋', note: 'もう片方は、たぶん月にあります。' },
  stone: { art: 'stone', name: '「あとで読む」と書かれた石', note: '積ん読の重さが、ついに物理になりました。' },
  box: { art: 'box', name: '月曜日のやる気（未開封）', note: '開封予定日は、まだ決まっていません。' },
  duck: { art: 'duck', name: '会議を抜け出したアヒル', note: '「次の会議があります」と言って出てきたそうです。' },
  key: { art: 'key', name: 'エンターキーだけのキーボード', note: '決断だけは、すごく早い。' },
  acorn: { art: 'acorn', name: '「部長」と書かれたどんぐり', note: 'どんぐりにも組織があるのでしょうか。' },
  plane: { art: 'plane', name: 'Wi-Fiを探す紙飛行機', note: '電波のよい席を探して、ここまで飛んできました。' },
  envelope: { art: 'envelope', name: '昨日の正解が入った封筒', note: '昨日届いていれば、助かったのに。' },
  screw: { art: 'screw', name: '有給休暇中のネジ', note: '今日は、何にも締めつけられたくないそうです。' },
  banana: { art: 'banana', name: '「至急」の付箋がついたバナナ', note: '熟れるまで、あと少しお待ちください。' },
} as const;

export type LostItemKind = keyof typeof LEGACY_LOST_ITEMS | `curio-${number}`;
export type LostItemEntry = { art: LostItemArt; name: string; note: string };
export const LOST_ITEM_KINDS: readonly LostItemKind[] = [...Object.keys(LEGACY_LOST_ITEMS) as (keyof typeof LEGACY_LOST_ITEMS)[], ...EXTRA_LOST_ITEMS.map((_, i) => `curio-${i + 1}` as LostItemKind)];
export const LOST_ITEM_CATALOG: Readonly<Record<LostItemKind, LostItemEntry>> = {
  ...LEGACY_LOST_ITEMS,
  ...Object.fromEntries(EXTRA_LOST_ITEMS.map(([art, name, note], i) => [`curio-${i + 1}`, { art, name, note }])),
};
export type LostItem = { id: string; kind: LostItemKind; roomId: RoomId; x: number; y: number };
export type LostItemsSnapshot = { items: LostItem[]; serverNow: number; expiresAt: number };
export const lostItemPeriod = (timestamp: number): number => Math.floor((timestamp - LOST_ITEMS_EPOCH) / LOST_ITEM_PERIOD_MS);
const mix = (value: number): number => { value = Math.imul(value ^ value >>> 16, 0x45d9f3b); value = Math.imul(value ^ value >>> 16, 0x45d9f3b); return (value ^ value >>> 16) >>> 0; };
function shuffle<T>(values: readonly T[], seed: number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { seed = mix(seed + i); const j = seed % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
// The deck deals three distinct kinds per period, without replacement over 125
// periods. Pick the rooms globally before looking at any room-local furniture.
export function lostItemsForOffice(timestamp: number, objects: readonly RoomObject[] = []): LostItem[] {
  if (!Number.isFinite(timestamp)) return [];
  const period = lostItemPeriod(timestamp), ordinal = period * MAX_LOST_ITEMS;
  const cycle = Math.floor(ordinal / LOST_ITEM_KINDS.length), start = ((ordinal % LOST_ITEM_KINDS.length) + LOST_ITEM_KINDS.length) % LOST_ITEM_KINDS.length;
  const deck = shuffle(LOST_ITEM_KINDS, mix(cycle ^ 0x5f3759df));
  const rooms = shuffle(ROOM_IDS, mix(period ^ 0x72b91c3));
  return rooms.slice(0, MAX_LOST_ITEMS).flatMap((roomId, index) => {
    const room = getRoom(roomId), seats = seatSpots(roomId, objects);
    const local = objects.filter((o) => o.roomId === roomId), free: { x: number; y: number; rank: number }[] = [];
    for (let y = 2; y < 18; y++) for (let x = 2; x < 28; x++) {
      if (walkableWithObjects(x, y, roomId, local) && !local.some((o) => objectContains(o, x, y)) && !touchingVehicleDock({ roomId, x, y }) && !seats.has(`${x},${y}`) &&
          [room.spawn, room.door].every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) > 2)) free.push({ x, y, rank: mix(period ^ (index + 1) * 0x7135 ^ x * 1973 ^ y * 9277) });
    }
    free.sort((a, b) => a.rank - b.rank || a.y - b.y || a.x - b.x);
    if (!free.length) return [];
    const { x, y } = free[0], kind = deck[(start + index) % deck.length];
    return [{ x, y, roomId, kind, id: `lost:${period}:${kind}` }];
  });
}
export const lostItemsAt = (roomId: RoomId, timestamp: number, objects: readonly RoomObject[] = []): LostItem[] => lostItemsForOffice(timestamp, objects).filter((item) => item.roomId === roomId);
export function lostItemsSnapshot(timestamp: number, objects: readonly RoomObject[] = []): LostItemsSnapshot {
  return { serverNow: timestamp, expiresAt: LOST_ITEMS_EPOCH + (lostItemPeriod(timestamp) + 1) * LOST_ITEM_PERIOD_MS, items: lostItemsForOffice(timestamp, objects) };
}
export function lostItemPixels(kind: LostItemKind): Pixel[] {
  const entry = LOST_ITEM_CATALOG[kind];
  return entry ? lostItemArt(entry.art, kind.startsWith('curio-') ? Number(kind.slice(6)) : 0) : [];
}
