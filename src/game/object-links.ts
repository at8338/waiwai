import { getRoom, isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { OBJECT_CATALOG, objectSize } from './objects.ts';
import type { RoomObject } from './objects.ts';
import type { Point, Furniture } from './world.ts';

export const MAX_FAVORITES = 100;
export const MAX_OBJECT_LINKS = 10;
export type Favorite = { id: string; title: string; url: string };
export type LinkBinding = { roomId: RoomId; objectId: string; linkIds: string[] };
export type LinkState = { favorites: Favorite[]; bindings: LinkBinding[] };
export type LinkEdit = { type: 'favorite-add'; title: string; url: string; editId: string }
  | { type: 'favorite-update'; favoriteId: string; title: string; url: string; editId: string }
  | { type: 'favorite-delete'; favoriteId: string; editId: string }
  | { type: 'object-links-set'; objectId: string; linkIds: string[]; editId: string };
export type LinkTarget = Point & { id: string; roomId: RoomId; name: string; kind: string; w: number; h: number; owner?: string };
const names: Record<Furniture['kind'], string> = { buffet: '定食カウンター', dishreturn: '食器の返却口', viewport: '正面スクリーン', console: '操縦パネル', pilot: 'パイロット席', reactor: '機体全身図', calendar: '館内カレンダー', desk: 'デスク・モニター', workbench: '作業台', table: 'テーブル', sofa: 'ソファ', plant: '植物', shelf: '本棚', board: 'ホワイトボード', counter: 'カウンター', pond: '池', easel: 'イーゼル', arcade: 'ゲーム機', bed: 'ベッド', telescope: '望遠鏡', monitor: '監視モニター', rack: 'サーバーラック', parking: '乗りもの置き場', vending: '自動販売機' };
export const validLinkId = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
export const validObjectId = (value: unknown): value is string => typeof value === 'string' && /^(fixed:[a-z]+:[a-z]+:\d{1,2}:\d{1,2}|placed:[a-f0-9-]{36})$/.test(value);
export function parseFavorite(value: unknown): { title: string; url: string } | undefined {
  if (!value || typeof value !== 'object') return;
  const { title, url } = value as Record<string, unknown>;
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(title) ||
      typeof url !== 'string' || url.length > 2048 || url !== url.trim() || /[\u0000-\u0020\u007f]/.test(url)) return;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password) return;
    return { title: title.trim(), url: parsed.href };
  } catch { return; }
}
export function objectTargets(roomId: RoomId, objects: readonly RoomObject[]): LinkTarget[] {
  const fixed: LinkTarget[] = getRoom(roomId).furniture.filter((f) => f.kind !== 'parking' && f.kind !== 'vending').map((f) => ({ ...f, id: `fixed:${roomId}:${f.kind}:${f.x}:${f.y}`, roomId, name: f.label ?? names[f.kind] }));
  return [...fixed, ...objects.filter((o) => o.roomId === roomId).map((o) => ({ ...o, ...objectSize(o.kind, o.rotation), id: `placed:${o.id}`, name: OBJECT_CATALOG[o.kind].name }))];
}
export function targetAt(roomId: RoomId, objects: readonly RoomObject[], point: Point): LinkTarget | undefined {
  return objectTargets(roomId, objects).reverse().find((o) => point.x >= o.x && point.x < o.x + o.w && point.y >= o.y && point.y < o.y + o.h);
}
export function boardInFront(roomId: RoomId, point: Point): LinkTarget | undefined {
  return objectTargets(roomId, []).find((o) => o.kind === 'board' && point.y === o.y + o.h && point.x >= o.x && point.x < o.x + o.w);
}
export function validLinkState(value: unknown): value is LinkState {
  if (!value || typeof value !== 'object') return false;
  const state = value as LinkState;
  if (!Array.isArray(state.favorites) || !Array.isArray(state.bindings) || state.favorites.length > MAX_FAVORITES || state.bindings.length > 2000 ||
      !state.favorites.every((f) => f && validLinkId(f.id) && !!parseFavorite(f))) return false;
  const ids = new Set(state.favorites.map((f) => f.id));
  if (ids.size !== state.favorites.length || new Set(state.favorites.map((f) => new URL(f.url).href)).size !== state.favorites.length) return false;
  return state.bindings.every((b) => b && isRoomId(b.roomId) && validObjectId(b.objectId) && (!b.objectId.startsWith('fixed:') || b.objectId.startsWith(`fixed:${b.roomId}:`)) && Array.isArray(b.linkIds) &&
    b.linkIds.length <= MAX_OBJECT_LINKS && new Set(b.linkIds).size === b.linkIds.length && b.linkIds.every((id) => ids.has(id))) &&
    new Set(state.bindings.map((b) => `${b.roomId}:${b.objectId}`)).size === state.bindings.length;
}
