import { ARCADE_GAMES, ARCADE_IDS } from './arcade.ts';
import { VEHICLE_DOCKS, VEHICLES } from './transport.ts';
import type { Furniture, Point } from './world.ts';
export const ROOM_IDS = ['office', 'focus', 'meeting', 'cafe', 'library', 'garden', 'studio', 'arcade', 'wellness', 'workshop', 'sky', 'ops', 'cockpit'] as const;
export type RoomId = typeof ROOM_IDS[number];
export type Room = {
  id: RoomId; name: string; description: string; icon: string;
  floor: number; grain: number; wall: number; rug: number; style: 'wood' | 'tile' | 'grass' | 'stars' | 'checker' | 'control' | 'mech';
  outlook: 'window' | 'open' | 'none';
  spawn: Point; door: Point; furniture: Furniture[];
};
const f = (kind: Furniture['kind'], x: number, y: number, w = 1, h = 1): Furniture => ({ kind, x, y, w, h });
export const officeFurniture: Furniture[] = [
  ...VEHICLE_DOCKS.map((dock) => ({ ...dock, kind: 'parking' as const, vehicleKind: dock.kind, label: `${VEHICLES[dock.kind].name}置き場` })),
  f('desk', 2, 3, 3, 2), f('desk', 6, 3, 3, 2), f('desk', 2, 7, 3, 2), f('desk', 6, 7, 3, 2),
  f('table', 13, 4, 4, 3), { ...f('board', 14, 1, 4, 1), boardMount: 'wall' }, f('plant', 18, 2), f('shelf', 11, 1, 2), f('sofa', 23, 3, 4, 2),
  f('table', 24, 6, 2), f('plant', 27, 8), f('shelf', 21, 1, 2), f('plant', 2, 12), f('plant', 27, 12),
  f('shelf', 1, 17, 3), f('sofa', 20, 15, 4, 2), f('plant', 26, 17),
];
const common = { spawn: { x: 15, y: 17 }, door: { x: 15, y: 18 } };
const tool = (kind: Furniture['kind'], label: string, x: number, y: number, w: number, h: number): Furniture => ({ ...f(kind, x, y, w, h), label });
export const ROOMS: Room[] = [
  { id: 'office', name: 'ひだまりオフィス', description: '執務エリアと、ゆったりしたロビーのあるいつもの場所。', icon: '▦', floor: 0xead3a5, grain: 0xd8bc8c, wall: 0xede5bf, rug: 0xa6b18c, style: 'wood', outlook: 'window', spawn: { x: 15, y: 12 }, door: { x: 28, y: 18 }, furniture: officeFurniture },
  { id: 'focus', name: 'しずかな集中室', description: '青い絨毯と8台の個別デスク。集中したい時間に。', icon: '✎', floor: 0xc5d4dc, grain: 0xb0c3d1, wall: 0xe3e9e6, rug: 0x879eaf, style: 'tile', outlook: 'window', ...common,
    furniture: [2, 8, 18, 24].flatMap((x) => [f('desk', x, 4, 3, 2), f('desk', x, 10, 3, 2)]).concat([f('shelf', 11, 1, 7), f('plant', 3, 15), f('plant', 26, 15)]) },
  { id: 'meeting', name: 'みんなの作戦室', description: '大きなテーブルと白板。アイデアを持ち寄ろう。', icon: '◇', floor: 0xd9dfc4, grain: 0xc5cdae, wall: 0xf0ecd3, rug: 0x91b0a4, style: 'tile', outlook: 'window', ...common,
    furniture: [f('board', 11, 1, 8, 2), f('table', 10, 6, 10, 5), f('sofa', 2, 5, 4, 2), f('sofa', 24, 5, 4, 2), f('plant', 3, 14), f('plant', 26, 14)] },
  { id: 'cafe', name: '木漏れ日カフェ', description: 'コーヒーと丸いテーブルで、気軽にひと息。', icon: '☕', floor: 0xecd6ba, grain: 0xd9b899, wall: 0xf2e6cf, rug: 0xcc9b79, style: 'tile', outlook: 'window', ...common,
    furniture: [f('counter', 3, 2, 10, 2), ...[5, 14, 23].flatMap((x) => [f('table', x, 7, 2, 2), f('table', x, 12, 2, 2)]), f('plant', 25, 2), f('sofa', 19, 2, 4, 2), tool('vending', 'ドリンク', 27, 2, 2, 3)] },
  { id: 'library', name: '星灯り図書室', description: '手順書・マニュアル・Confluence。棚をクリックして、みんなの知識をひらこう。', icon: '▤', floor: 0xccc0cc, grain: 0xb6a5b9, wall: 0xe5d8d5, rug: 0x9b899f, style: 'wood', outlook: 'window', ...common,
    furniture: [...['手順書', 'マニュアル', 'Confluence', '設計資料', '議事録', 'ナレッジ'].map((label, i) => tool('shelf', label, [3, 11, 20][i % 3], i < 3 ? 3 : 8, 6, 1)), f('table', 4, 13, 6, 2), f('table', 20, 13, 6, 2), f('plant', 2, 16), f('plant', 27, 16)] },
  { id: 'garden', name: '風の屋上ガーデン', description: '芝生と池、緑のベンチ。外の空気を感じて。', icon: '♧', floor: 0xa8bd84, grain: 0x92ab73, wall: 0xd0d8b5, rug: 0xdcd0a1, style: 'grass', outlook: 'open', ...common,
    furniture: [f('pond', 11, 5, 8, 5), f('sofa', 4, 5, 4, 2), f('sofa', 22, 10, 4, 2), ...[3, 7, 22, 26].map((x) => f('plant', x, 2)), f('plant', 4, 13), f('plant', 25, 14)] },
  { id: 'studio', name: 'いろどりアトリエ', description: 'キャンバスと色見本。創作とデザインの相談に。', icon: '✳', floor: 0xe9c4bf, grain: 0xd6ada9, wall: 0xf3dfd0, rug: 0xc59caa, style: 'wood', outlook: 'window', ...common,
    furniture: [f('easel', 4, 3, 3, 3), f('easel', 13, 3, 3, 3), f('easel', 23, 3, 3, 3), f('table', 7, 10, 6, 2), f('table', 18, 10, 5, 2), f('shelf', 2, 14, 4), f('plant', 26, 15)] },
  { id: 'arcade', name: 'ワイワイゲームセンター', description: '8つの小さなゲーム。ひとりでも、みんなでも、リズムにのってひと休み。', icon: '✚', floor: 0x69677d, grain: 0x59596f, wall: 0xc1b7cf, rug: 0xa17ea3, style: 'checker', outlook: 'window', ...common,
    furniture: [...ARCADE_IDS.map((id) => f('arcade', ARCADE_GAMES[id].x, ARCADE_GAMES[id].y, 3, 3)), f('table', 12, 14, 5, 2), f('sofa', 3, 14, 4, 2), f('sofa', 23, 14, 4, 2)] },
  { id: 'wellness', name: 'うたたね休憩室', description: 'やわらかな色のベッドと緑。ゆっくり休もう。', icon: '☾', floor: 0xd8e1d4, grain: 0xc2d0c0, wall: 0xf1e8d7, rug: 0xafc6bf, style: 'tile', outlook: 'window', ...common,
    furniture: [f('bed', 3, 3, 4, 4), f('bed', 12, 3, 4, 4), f('bed', 22, 3, 4, 4), f('sofa', 5, 12, 5, 2), f('sofa', 20, 12, 5, 2), f('plant', 9, 3), f('plant', 18, 3), tool('vending', 'ドリンク', 27, 10, 2, 3)] },
  { id: 'workshop', name: 'ものづくり工房', description: '作業台と道具の棚。試作やペア作業の拠点。', icon: '⚒', floor: 0xd4c2a3, grain: 0xbca584, wall: 0xe9d8bb, rug: 0xb49c72, style: 'checker', outlook: 'window', ...common,
    furniture: [f('board', 12, 1, 6, 2), ...[3, 12, 22].flatMap((x) => [f('workbench', x, 6, 4, 2), f('table', x, 12, 4, 2)]), f('shelf', 2, 1, 6), f('shelf', 22, 1, 6)] },
  { id: 'sky', name: '星空ラウンジ', description: '星模様の床と望遠鏡。少し特別な夜の雑談。', icon: '✦', floor: 0x5b6787, grain: 0x4c5877, wall: 0xc6d0da, rug: 0x9d9ab8, style: 'stars', outlook: 'window', ...common,
    furniture: [f('telescope', 22, 3, 3, 3), f('sofa', 3, 5, 5, 2), f('sofa', 12, 5, 5, 2), f('table', 7, 11, 3, 2), f('sofa', 19, 12, 6, 2), f('plant', 3, 14)] },
  { id: 'ops', name: 'システム管制室', description: 'モニターをクリックして稼働状況・ログ・アラートへ。運用ツールをみんなの手元に。', icon: '▣', floor: 0x566c75, grain: 0x4e626b, wall: 0xd0d6c7, rug: 0x7b9597, style: 'control', outlook: 'none', ...common,
    furniture: [
      tool('monitor', 'CloudWatch', 2, 2, 6, 3), tool('monitor', 'サービス稼働状況', 11, 1, 8, 3), tool('monitor', 'New Relic', 22, 2, 6, 3),
      tool('monitor', 'ログ検索', 3, 8, 5, 2), tool('monitor', 'アラート', 11, 8, 8, 2), tool('monitor', 'デプロイ', 22, 8, 5, 2),
      tool('rack', 'インフラ', 2, 13, 3, 3), tool('table', '障害対応', 10, 13, 9, 2), tool('shelf', '手順書', 23, 14, 4, 1),
    ] },
  { id: 'cockpit', name: 'ワイワイガー操縦室', description: 'このオフィスの正体は巨大ロボ〈ワイワイガー〉。みんなで起動・歩行・パンチを試せる、遊び専用のブリッジ。', icon: '✺', floor: 0x516679, grain: 0x455a6b, wall: 0xa9b9bc, rug: 0x6f8992, style: 'mech', outlook: 'none', ...common,
    furniture: [
      tool('viewport', '正面スクリーン', 9, 1, 12, 5), tool('reactor', '機体全身図', 2, 2, 5, 4), tool('monitor', '航行レーダー', 23, 2, 5, 4),
      tool('console', '左腕コントロール', 2, 8, 6, 2), tool('console', 'メイン操縦パネル', 11, 8, 8, 2), tool('console', '右腕コントロール', 22, 8, 6, 2),
      tool('pilot', 'パイロット席', 14, 11, 2, 2), tool('console', '歩行ペダル', 2, 13, 6, 2), tool('console', 'バリア発生装置', 22, 13, 6, 2),
      tool('sofa', '見学シート', 3, 16, 5, 1), tool('sofa', 'クルーシート', 22, 16, 5, 1),
    ] },
];
// A hanging calendar on the north wall, away from the window panes.
for (const room of ROOMS) room.furniture.push({ kind: 'calendar', x: 27, y: 0, w: 2, h: 1, label: '館内カレンダー' });
export function isRoomId(value: unknown): value is RoomId { return typeof value === 'string' && (ROOM_IDS as readonly string[]).includes(value); }
export function getRoom(id: RoomId = 'office'): Room { return ROOMS.find((room) => room.id === id)!; }
