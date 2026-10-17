import { eventPropPixels } from './event-props.ts';
import type { EventProp } from './event-props.ts';
import type { DailyEpisode } from './daily-event-catalog.ts';
import type { EventStage, StagePixel } from './daily-event-stage.ts';

export const STAGING = {
  ring: '輪になった騒動', night: '室内の小さな夜空', constellation: '星を結ぶ光の線', launch: '発射準備の現場', pair: 'ふたつの思いがけない組み合わせ',
  floating: '空中に浮いた小物', river: '光や紙でできた流れ', orbit: '小物の周囲を巡る衛星', focus: '中央に現れた大きな変化', aurora: '天井に揺れるオーロラ',
  museum: '突然の展示室', track: '部屋を巡るコース', queue: '思いがけない行列', conveyor: '動き出した作業ライン', flock: '室内を渡る編隊', assembly: '集合した小物たち',
  tree: '枝分かれする不思議', weave: '部屋を横切る織り目', aisle: '中央通路を挟んだ席', garden: '室内に育つ庭', wall: '壁一面の異変', market: '小さな店が開店',
  interview: '奇妙な面談の席', board: '床の上の対局', nest: '意外なものの巣', snowfield: '室内の雪景色', desert: '室内の砂丘', rainbow: '部屋をまたぐ七色の橋',
  shelf: '棚に並ぶ珍しい品物', compass: '方角を巡る騒動', ice: '冷たい結晶の室内', spiral: '渦巻きの中心で起きたこと', clouds: 'ふわふわの雲の広場', studio: '収録が始まった一角',
  handover: '引き継ぎ待ちのふたり', hanging: '天井から下がる異変', steps: '階段状に積もる物語', tower: '床から積み上がる塔', court: '小さな法廷が開廷', trail: '部屋をたどる痕跡',
  picnic: '敷物の上の寄り道', diagonal: '部屋を斜めに横断', nested: '小さな世界の中の世界', shadow: '本体のない影', mirrorwall: '鏡の向こうの別世界', curtain: 'カーテンの向こうの一幕',
  stage: '突然の舞台公演', platform: '室内の乗り場', shogiboard: '床が将棋の盤面に', chessboard: '白黒の盤面に', domino: '連なって並ぶ小さな列', patchwork: '床いっぱいの組み合わせ',
  sugoroku: '部屋を巡るすごろく', claw: '大きな景品クレーン', race: '小さなレースのスタート', parade: '室内の行進', helipad: '卓上のヘリポート', monochrome: '墨色の展覧会',
  ballroom: '小物たちの舞踏会', magnetic: '磁力で集まる小物', gallery: '壁の臨時ギャラリー', lights: '順に灯る光', sumo: '丸い土俵で待ったなし', blossom: '部屋に舞う花びら',
  tightrope: '部屋を渡る一本の綱', vine: '天井へ伸びるつる', laboratory: '小さな実験室', choir: '合唱隊の出番', network: '枝分かれした道筋', mosaic: '床を彩る模様', arc: '空中をつなぐ弧',
  banquet: '長いテーブルの集まり', inverted: '天井に現れる逆さの家具', perspective: '大きさが入れ替わった遠近法', origami: '折り目だらけの紙の部屋', page: '絵本のページがめくれた壁',
  stretch: '縦に長く伸びた小物', accordion: '伸びたり畳まれたりする形', sideways: '横向きに並ぶ重力', mirage: '薄く重なる蜃気楼', runway: '床にできた滑走路', bubbles: '球の中の小さな世界',
  lighthouse: '光が照らす行き先', presentation: '思いがけない発表会', auction: '臨時の競売場', targets: '壁の小さな的', gate: '不思議な入口', gym: '小物のトレーニング',
  sneeze: 'くしゃみの先の出来事', workshop: '実演中の作業場', bridge: '橋の下の小さな席', maze: '床の迷路', power: '発電・充電の実験', portals: 'ふたつの輪の向こう',
  chase: '小さな追いかけっこ', forked: '進路に迷った行列', fireworks: '室内の光の花', rhythm: '拍子を合わせる現場', evidence: '証拠品と規制線', suction: '一方向へ集まる小物', outside: '窓の外の一日限りの景色',
} as const;
export type Staging = keyof typeof STAGING;
export type EpisodeScene = { layout: Staging; props: EventProp[]; special?: string };

export function tableauStage(event: DailyEpisode, frame = 0): EventStage {
  const recipe = event.scene!, { layout, props } = recipe;
  const stage: EventStage = { floor: [], scenery: [], effects: [], damage: [], inspectAreas: [], hero: { x: 344, y: 184, scale: event.theme === 'comic' ? .75 : 0 }, caption: STAGING[layout] };
  let layer: StagePixel[] = stage.floor;
  const p = (color: number, x: number, y: number, w: number, h: number, alpha = 1) => {
    const left = Math.max(0, Math.round(x * 2) / 2), top = Math.max(0, Math.round(y * 2) / 2), right = Math.min(480, Math.round((x + w) * 2) / 2), bottom = Math.min(320, Math.round((y + h) * 2) / 2);
    if (right > left && bottom > top) layer.push({ color, x: left, y: top, w: right - left, h: bottom - top, alpha });
  };
  const line = (c: number, x: number, y: number, xx: number, yy: number, a = 1, width = 2) => {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(xx - x), Math.abs(yy - y)) / Math.max(.5, width / 2)));
    for (let i = 0; i <= n; i++) p(c, x + (xx - x) * i / n, y + (yy - y) * i / n, width, width, a);
  };
  const oval = (c: number, x: number, y: number, w: number, h: number, a = 1) => {
    for (let dy = -h / 2; dy < h / 2; dy += .5) { const dx = Math.sqrt(Math.max(0, 1 - ((dy + .25) / (h / 2)) ** 2)) * w / 2; p(c, x - dx, y + dy, dx * 2, .5, a); }
  };
  const ink = 0x394653, cream = 0xf0e9d5, wood = 0xb49770, green = 0x77976e, blue = 0x87bbcf, pink = 0xc98b9c, gold = 0xd8b56e;
  const spots: { x: number; y: number; size: number; rotation?: number; alpha?: number; prop?: number }[] = [];
  const spot = (x: number, y: number, size = 24, rotation = 0, alpha = 1, prop?: number) => spots.push({ x, y, size, rotation, alpha, prop });
  const many = (n: number, place: (i: number) => void) => { for (let i = 0; i < n; i++) place(i); };
  const table = (x: number, y: number, w: number, h: number) => { p(wood, x, y, w, h); p(cream, x + 3, y + 3, w - 6, h - 6); p(ink, x + 5, y + h, 4, 12); p(ink, x + w - 9, y + h, 4, 12); p(0xfff4da, x + 3, y + 3, w - 6, .5); p(0x8c7358, x + 3, y + h - .5, w - 6, .5); };
  const ellipseLine = (c: number, x: number, y: number, w: number, h: number) => { many(90, i => { const a = i / 90 * Math.PI * 2; p(c, x + Math.cos(a) * w / 2, y + Math.sin(a) * h / 2, 3, 3); }); };
  const frames = () => many(6, i => { const x = 45 + i % 3 * 142, y = 39 + Math.floor(i / 3) * 90; p(wood, x, y, 76, 65); p(cream, x + 4, y + 4, 68, 57); spot(x + 18, y + 12, 40); });

  // Each stage has a spatial premise, rather than a theme-wide disaster overlay.
  switch (layout) {
    case 'night': p(0x34445f, 16, 16, 448, 230, .8); many(38, i => p(cream, 29 + i * 41 % 419, 27 + i * 31 % 175, 2, 2)); spot(185, 46, 78); spot(302, 142, 48); spot(99, 174); break;
    case 'constellation': p(0x34445f, 16, 16, 448, 235, .75); many(13, i => { const x = 45 + i * 31, y = 55 + i * 47 % 132; line(blue, x, y, x + 31, 55 + (i + 1) * 47 % 132, .6); spot(x - 8, y - 8, i % 4 ? 13 : 25); }); break;
    case 'aurora': many(48, i => { p(i % 2 ? 0x8a9cd1 : 0x7dc9b0, 17 + i * 9, 25 + Math.sin(i / 5) * 20, 10, 45 + Math.cos(i / 7) * 22, .6); }); spot(100, 173, 40); spot(226, 162, 32); spot(357, 120, 44); break;
    case 'snowfield': p(0xdde8e7, 16, 23, 448, 268, .85); many(23, i => oval(cream, 25 + i * 37 % 422, 59 + i * 51 % 209, 40, 13)); spot(69, 150, 64); spot(236, 80, 40); spot(362, 198, 32); break;
    case 'desert': p(0xdbbd82, 16, 23, 448, 268, .85); many(6, i => oval(0xcfae73, 40 + i * 72, 106 + i % 2 * 75, 130, 42)); spot(61, 147, 64); spot(260, 183, 38); spot(365, 47, 54); break;
    case 'ice': many(14, i => { const x = 25 + i * 32; p(blue, x, 20, 20, 20 + i % 4 * 15, .8); line(cream, x + 7, 22, x + 9, 40 + i % 4 * 15, .7); }); p(0xbcd8db, 30, 176, 420, 69, .45); many(6, i => spot(52 + i * 66, 92 + i % 2 * 75, 36)); break;
    case 'garden': p(green, 28, 137, 421, 111, .5); many(15, i => { const x = 40 + i * 27; p(0x735941, x, 205 + i % 3 * 7, 20, 10); spot(x - 1, 157 + i % 3 * 11, 36); }); break;
    case 'blossom': many(82, i => p(i % 2 ? 0xeac1c9 : 0xf0d8ce, 19 + i * 47 % 441, 28 + i * 61 % 218, 5, 3, .9)); spot(180, 70, 102); spot(82, 186, 38); spot(330, 151, 48); break;
    case 'clouds': many(6, i => { oval(cream, 63 + i * 71, 125 + i % 2 * 70, 110, 48, .9); spot(40 + i * 71, 85 + i % 2 * 70, 44); }); break;
    case 'rainbow': many(7, i => { const colors = [0xd57b79, 0xd9a26b, gold, green, blue, 0x818fb2, 0xa68bb1]; many(75, j => { const a = Math.PI + j / 74 * Math.PI; p(colors[i], 240 + Math.cos(a) * (205 - i * 7), 190 + Math.sin(a) * (157 - i * 7), 8, 8); }); }); spot(57, 191, 40); spot(216, 172, 40); spot(379, 194, 40); break;
    case 'monochrome': p(0xc8c8bd, 16, 16, 448, 233, .7); frames(); break;
    case 'gallery': frames(); break;
    case 'wall': many(12, i => { const x = 36 + i % 6 * 71, y = 30 + Math.floor(i / 6) * 79; p(wood, x, y, 49, 51); p(cream, x + 3, y + 3, 43, 45); spot(x + 9, y + 8, 32); }); break;
    case 'shelf': many(3, i => { const y = 65 + i * 62; p(wood, 43, y + 29, 393, 7); many(6, j => spot(57 + j * 63, y, 28)); }); break;
    case 'museum': many(4, i => { const x = 49 + i * 103; p(wood, x, 159, 67, 38); p(cream, x - 4, 156, 75, 6); p(cream, x + 9, 209, 50, 10); spot(x + 10, 108, 48); }); break;
    case 'assembly': p(pink, 182, 45, 119, 12); spot(223, 69, 32); many(12, i => spot(48 + i % 6 * 69, 132 + Math.floor(i / 6) * 58, 30)); break;
    case 'queue': line(gold, 55, 205, 354, 205); many(9, i => spot(48 + i * 35, 159 + i % 2 * 7, 28)); table(366, 124, 67, 36); spot(385, 88, 33); break;
    case 'market': many(3, i => { const x = 39 + i * 145; p(wood, x, 96, 112, 92); many(8, j => p(j % 2 ? cream : pink, x + j * 14, 88, 14, 18)); p(cream, x + 4, 161, 104, 23); spot(x + 34, 120, 42); spot(x + 8, 197, 24); }); break;
    case 'interview': table(167, 109, 151, 59); spot(80, 127, 48); spot(346, 127, 48); spot(218, 112, 38); break;
    case 'pair': spot(91, 122, 88); spot(303, 130, 72); line(gold, 195, 169, 283, 169, .6); spot(222, 190, 28); break;
    case 'handover': spot(108, 100, 73); spot(300, 100, 73); spot(223, 158, 32); line(cream, 182, 146, 225, 176); line(cream, 255, 176, 300, 146); break;
    case 'focus': oval(ink, 240, 218, 200, 38, .2); spot(164, 66, 152); spot(90, 194, 32); spot(354, 180, 40); break;
    case 'stretch': spot(196, 22, 72); many(5, i => spot(200, 76 + i * 30, 64)); spot(82, 181, 32); spot(352, 121, 40); break;
    case 'perspective': spot(173, 33, 160); spot(88, 193, 21); spot(352, 224, 12); line(gold, 34, 275, 240, 44, .5); line(gold, 447, 275, 240, 44, .5); break;
    case 'tower': many(10, i => { const row = Math.floor((Math.sqrt(8 * i + 1) - 1) / 2), col = i - row * (row + 1) / 2; spot(217 - row * 27 + col * 54, 45 + row * 46, 48); }); break;
    case 'steps': many(7, i => { p(wood, 40 + i * 56, 213 - i * 23, 57, 40 + i * 23); spot(52 + i * 56, 179 - i * 23, 32); }); break;
    case 'accordion': many(9, i => { p(i % 2 ? gold : cream, 62 + i * 40, 78 + i % 2 * 18, 39, 126 - i % 2 * 36); spot(66 + i * 40, 129, 30); }); break;
    case 'nested': many(4, i => { p(i % 2 ? cream : wood, 70 + i * 32, 45 + i * 23, 336 - i * 64, 203 - i * 46); spot(79 + i * 39, 53 + i * 26, 48 - i * 8); }); spot(220, 139, 36); break;
    case 'ring': case 'ballroom': case 'orbit': case 'magnetic': case 'sumo': {
      const w = layout === 'sumo' ? 253 : 331, h = layout === 'sumo' ? 144 : 178;
      ellipseLine(layout === 'magnetic' ? pink : gold, 240, 151, w, h);
      if (layout === 'sumo') { p(cream, 179, 146, 38, 4); p(cream, 266, 146, 38, 4); spot(130, 104, 66); spot(284, 113, 60); }
      else { many(layout === 'ballroom' ? 8 : 10, i => { const a = i / (layout === 'ballroom' ? 8 : 10) * Math.PI * 2; spot(220 + Math.cos(a) * w / 2, 131 + Math.sin(a) * h / 2, 32); }); spot(215, 125, 50); }
      break;
    }
    case 'spiral': many(65, i => { const a = i / 7, r = 13 + i * 2.9; p(gold, 238 + Math.cos(a) * r, 146 + Math.sin(a) * r * .53, 5, 4); if (i % 9 === 0) spot(226 + Math.cos(a) * r, 134 + Math.sin(a) * r * .53, 29); }); break;
    case 'board': case 'shogiboard': case 'chessboard': case 'sugoroku': case 'patchwork': case 'mosaic': {
      const colors = layout === 'chessboard' ? [cream, ink] : layout === 'mosaic' ? [gold, green, pink, blue] : [0xc5a370, 0xe1c99c];
      many(48, i => { const x = 74 + i % 8 * 42, y = 39 + Math.floor(i / 8) * 32; p(colors[(i + Math.floor(i / 8)) % colors.length], x, y, 41, 31, .85); });
      many(layout === 'patchwork' ? 18 : 8, i => spot(82 + i * 73 % 295, 47 + i * 59 % 160, 27)); break;
    }
    case 'track': case 'race': ellipseLine(ink, 240, 160, 397, 190); ellipseLine(cream, 240, 160, 362, 151); many(9, i => { const a = i / 9 * Math.PI * 2; spot(226 + Math.cos(a) * 188, 146 + Math.sin(a) * 85, 28); }); p(cream, 220, 231, 34, 22); break;
    case 'conveyor': p(ink, 26, 132, 424, 62); many(25, i => p(wood, 30 + i * 17, 137, 8, 52)); many(7, i => spot(39 + i * 59, 140, 42)); spot(197, 66, 41); break;
    case 'domino': many(28, i => { const x = 42 + i % 14 * 29, y = 101 + Math.floor(i / 14) * 85; spot(x, y, 26, i < 4 ? -.5 : 0); }); break;
    case 'parade': case 'trail': case 'chase': case 'flock': case 'diagonal': case 'suction': {
      const count = layout === 'trail' ? 13 : 8;
      many(count, i => { const x = 34 + i * 389 / (count - 1), y = layout === 'diagonal' ? 224 - i * 21 : layout === 'flock' ? 65 + Math.abs(i - 3.5) * 29 : 143 + Math.sin(i * .8) * 55; if (layout !== 'flock') line(gold, x, y + 38, x + 26, y + 38, .5); spot(x, y, layout === 'chase' && i === 0 ? 50 : 29); }); break;
    }
    case 'river': many(19, i => { const x = 14 + i * 24, y = 125 + Math.sin(i / 3) * 40; p(blue, x, y, 27, 61, .35); p(cream, x + 3, y + 11, 15, 3, .5); if (i % 4 === 1) spot(x, y + 4, 28); }); spot(360, 111, 46); break;
    case 'floating': case 'arc': case 'bubbles': many(7, i => { const x = 37 + i * 60, y = 42 + Math.abs(i - 3) * 35; if (layout === 'bubbles') { oval(blue, x + 20, y + 20, 59, 55, .25); ellipseLine(cream, x + 20, y + 20, 58, 55); } spot(x, y, 41); }); break;
    case 'hanging': many(8, i => { const x = 34 + i * 55, y = 54 + i % 3 * 43; line(wood, x + 15, 15, x + 15, y); spot(x, y, 32, i % 2 ? .16 : -.12); }); break;
    case 'inverted': many(6, i => { const x = 56 + i * 64; line(wood, x + 18, 17, x + 18, 45); spot(x, 44, 49, Math.PI); }); spot(167, 175, 34); break;
    case 'sideways': many(8, i => spot(33 + i * 52, 50 + i % 3 * 63, 38, Math.PI / 2)); many(8, i => line(blue, 80 + i * 48, 246, 106 + i * 48, 246, .5)); break;
    case 'shadow': many(9, i => { oval(ink, 55 + i * 43, 132 + i % 3 * 36, 42, 17, .65); spot(40 + i * 43, 89 + i % 3 * 36, 30, 0, .16); }); break;
    case 'mirrorwall': many(4, i => { const x = 37 + i * 108; p(gold, x, 34, 88, 145); p(blue, x + 4, 38, 80, 137, .8); line(cream, x + 8, 151, x + 69, 49, .6); spot(x + 21, 83, 42, 0, .8); }); break;
    case 'curtain': case 'stage': case 'choir': case 'rhythm': {
      p(ink, 75, 31, 330, 175); p(wood, 58, 206, 366, 17); many(6, i => { p(i % 2 ? 0x974f5c : pink, 75 + i * 9, 31, 9, 175); p(i % 2 ? 0x974f5c : pink, 351 + i * 9, 31, 9, 175); });
      many(layout === 'choir' ? 10 : 3, i => spot(140 + i % 5 * 42, 85 + Math.floor(i / 5) * 54, 40)); break;
    }
    case 'studio': table(111, 151, 250, 49); spot(54, 93, 48); spot(177, 94, 46); spot(302, 83, 48); spot(385, 181, 30); line(ink, 82, 141, 73, 225); break;
    case 'presentation': p(ink, 115, 29, 247, 127); p(cream, 121, 35, 235, 115); spot(198, 44, 88); many(6, i => spot(71 + i * 60, 189, 30)); break;
    case 'platform': p(wood, 31, 201, 418, 16); line(cream, 34, 196, 447, 196); spot(56, 111, 76); spot(244, 148, 40); spot(363, 103, 51); break;
    case 'launch': many(12, i => p(i % 2 ? cream : ink, 146 + i * 16, 221, 16, 11)); spot(179, 38, 110); spot(82, 170, 43); spot(346, 188, 32); line(wood, 155, 80, 155, 220); break;
    case 'runway': p(ink, 51, 110, 379, 101, .85); many(13, i => p(cream, 61 + i * 28, 158, 14, 3)); many(7, i => spot(56 + i * 55, 122 + i % 2 * 31, 34)); break;
    case 'helipad': table(115, 104, 247, 120); ellipseLine(cream, 237, 163, 141, 92); p(cream, 209, 137, 5, 49); p(cream, 259, 137, 5, 49); p(cream, 209, 158, 55, 5); spot(187, 97, 83); spot(70, 213, 28); break;
    case 'gate': case 'portals': many(layout === 'portals' ? 2 : 1, i => { const x = layout === 'portals' ? 117 + i * 237 : 241; ellipseLine(gold, x, 125, 113, 155); ellipseLine(blue, x, 125, 105, 147); spot(x - 25, 99, 49); }); spot(221, 208, 30); break;
    case 'lighthouse': p(wood, 66, 86, 53, 140); p(cream, 75, 54, 35, 38); many(40, i => line(gold, 93, 77, 216 + i * 5, 27 + i * 5, .1)); spot(237, 131, 70); spot(367, 175, 39); break;
    case 'claw': p(ink, 105, 29, 280, 15); p(wood, 105, 44, 10, 188); p(wood, 375, 44, 10, 188); line(ink, 241, 45, 241, 96); line(ink, 241, 96, 211, 121); line(ink, 241, 96, 272, 121); table(121, 194, 247, 25); spot(212, 136, 57); spot(145, 166, 29); spot(317, 163, 30); break;
    case 'court': table(156, 70, 170, 41); spot(216, 27, 38); table(52, 166, 132, 36); table(298, 166, 132, 36); spot(88, 118, 44); spot(335, 119, 44); break;
    case 'auction': table(53, 139, 135, 40); spot(95, 75, 59); many(7, i => spot(227 + i % 4 * 53, 97 + Math.floor(i / 4) * 74, 31)); break;
    case 'targets': many(5, i => { ellipseLine(pink, 65 + i * 87, 77, 62, 57); ellipseLine(gold, 65 + i * 87, 77, 32, 29); spot(52 + i * 87, 64, 25); }); spot(204, 173, 45); spot(302, 195, 30); break;
    case 'gym': many(3, i => { const x = 70 + i * 143; p(ink, x, 189, 83, 5); p(ink, x + 6, 175, 10, 32); p(ink, x + 66, 175, 10, 32); spot(x + 19, 109, 45); }); break;
    case 'tightrope': line(wood, 26, 149, 451, 149, 1, 3); spot(183, 100, 48); spot(73, 190, 37); spot(354, 189, 37); break;
    case 'vine': many(42, i => { const x = 242 + Math.sin(i / 3) * 52, y = 231 - i * 5; p(green, x, y, 8, 10); if (i % 6 === 0) spot(x - 23, y, 27); }); spot(118, 189, 47); spot(321, 32, 65); break;
    case 'tree': line(wood, 240, 229, 240, 57, 1, 8); many(6, i => { const x = 57 + i * 63, y = 60 + i % 2 * 59; line(wood, 244, 201 - i * 17, x + 17, y + 17, .9, 3); spot(x, y, 36); }); break;
    case 'laboratory': table(57, 161, 365, 38); many(5, i => spot(81 + i * 70, 112, 43)); spot(209, 37, 64); break;
    case 'network': many(12, i => { const x = 46 + i % 4 * 115, y = 45 + Math.floor(i / 4) * 73; if (i % 4 < 3) line(blue, x + 13, y + 13, x + 128, y + 13); if (i < 8) line(blue, x + 13, y + 13, x + 13, y + 86); spot(x, y, 29); }); break;
    case 'weave': many(14, i => { line(i % 2 ? wood : gold, 34 + i * 31, 48, 34 + i * 31, 232, .85, 3); }); many(8, i => line(cream, 27, 52 + i * 25, 453, 52 + i * 25, .9, 4)); spot(56, 174, 51); spot(208, 91, 53); spot(359, 156, 47); break;
    case 'compass': ellipseLine(gold, 240, 145, 278, 184); many(8, i => { const a = i * Math.PI / 4; line(wood, 240, 145, 240 + Math.cos(a) * 127, 145 + Math.sin(a) * 80); spot(224 + Math.cos(a) * 144, 130 + Math.sin(a) * 98, 30); }); spot(213, 117, 54); break;
    case 'banquet': table(47, 116, 386, 69); many(8, i => spot(65 + i * 48, 127, 33)); many(6, i => spot(84 + i % 3 * 139, 66 + Math.floor(i / 3) * 142, 29)); break;
    case 'aisle': p(pink, 214, 37, 52, 209, .6); many(8, i => spot(88 + i % 2 * 250, 44 + Math.floor(i / 2) * 50, 39)); spot(218, 37, 42); break;
    case 'picnic': p(pink, 83, 91, 313, 141); many(8, i => line(cream, 91 + i * 40, 93, 91 + i * 40, 228, .45, 3)); many(5, i => spot(113 + i * 48, 122 + i % 2 * 43, 38)); break;
    case 'nest': many(18, i => line(wood, 93 + i * 13, 202 + i % 3 * 7, 158 + i * 9, 228 - i % 4 * 5, .9, 4)); spot(151, 130, 58); spot(237, 148, 45); spot(311, 114, 38); break;
    case 'lights': many(10, i => { line(ink, 32 + i * 43, 18, 52 + i * 43, 52 + i % 3 * 17); oval(gold, 53 + i * 43, 78 + i % 3 * 17, 41, 50, .12); spot(36 + i * 43, 51 + i % 3 * 17, 30); }); spot(211, 173, 42); break;
    case 'origami': p(cream, 19, 25, 442, 225, .8); many(8, i => { line(wood, 20 + i * 62, 28, 125 + i * 40, 247, .6); line(wood, 20, 40 + i * 30, 460, 60 + i * 23, .5); }); spot(96, 91, 53); spot(252, 151, 65); spot(365, 83, 40); break;
    case 'page': p(cream, 65, 32, 348, 208, .9); p(wood, 236, 34, 3, 203); many(8, i => line(wood, 83, 59 + i * 18, 216, 59 + i * 18, .6)); spot(264, 75, 100); p(gold, 384, 209, 29, 31); break;
    case 'mirage': many(3, i => spot(82 + i * 112, 90 - i * 13, 92, 0, .25 + i * .25)); spot(351, 198, 28); break;
    case 'bridge': p(wood, 56, 67, 368, 17); p(wood, 66, 84, 13, 155); p(wood, 402, 84, 13, 155); spot(167, 131, 73); spot(282, 169, 43); spot(100, 33, 33); break;
    case 'maze': many(11, i => { const x = 40 + i * 37; p(wood, x, 41 + i % 2 * 51, 5, 153); p(wood, x, i % 2 ? 41 : 189, 42, 5); }); spot(45, 44, 27); spot(404, 202, 31); spot(211, 110, 33); break;
    case 'power': table(165, 151, 163, 49); line(gold, 100, 164, 192, 164); line(gold, 280, 164, 395, 164); spot(53, 105, 67); spot(208, 102, 49); spot(366, 109, 50); break;
    case 'forked': line(gold, 38, 220, 241, 148); line(gold, 241, 148, 423, 53); line(gold, 241, 148, 423, 228); many(8, i => spot(39 + i * 49, 187 - i * 17, 28)); spot(393, 199, 39); break;
    case 'fireworks': many(5, i => { const x = 66 + i * 89, y = 75 + i % 2 * 65; many(10, j => { const a = j * Math.PI / 5; line(i % 2 ? pink : gold, x + Math.cos(a) * 12, y + Math.sin(a) * 12, x + Math.cos(a) * 35, y + Math.sin(a) * 35); }); spot(x - 10, y - 10, 20); }); spot(208, 210, 32); break;
    case 'evidence': many(19, i => p(i % 2 ? ink : gold, 70 + i * 18, 221, 18, 6)); spot(178, 109, 61); spot(289, 175, 34); spot(79, 161, 36); break;
    case 'sneeze': spot(68, 118, 87); many(14, i => spot(170 + i * 20, 65 + i * 29 % 145, 19)); break;
    case 'workshop': table(76, 140, 330, 58); many(5, i => spot(92 + i * 60, 147, 36)); spot(211, 65, 61); break;
    case 'outside': table(174, 180, 132, 28); props.forEach((_, i) => spot(182 + i * 63, 137, 42)); break;
    default: { const missing: never = layout; throw new Error('Missing event staging: ' + missing); }
  }
  layer = stage.scenery;
  // In a procession the subject repeats; a sign or a cup is supporting scenery,
  // not every third member of the crowd. Other stages use the explicitly ordered
  // props for their different roles (the two parties, their desk, their evidence).
  const subjectStages = new Set<Staging>(['queue', 'conveyor', 'flock', 'assembly', 'garden', 'wall', 'shelf', 'ring', 'track', 'race', 'parade', 'trail', 'domino', 'shogiboard', 'chessboard', 'hanging', 'choir', 'lights', 'targets']);
  if (subjectStages.has(layout) && props.length > 1) {
    spot(373, 224, 28, 0, 1, 1);
    if (props.length > 2) spot(414, 224, 25, 0, 1, 2);
  }
  spots.forEach(({ x, y, size, rotation = 0, alpha = 1, prop }, i) => {
    const kind = props[prop ?? (subjectStages.has(layout) ? 0 : i % props.length)], scale = size / 8;
    const source = eventPropPixels(kind);
    const pixels = rotation ? source.flatMap(pixel => Array.from({ length: Math.round(pixel.w * 4) }, (_, j) => ({ ...pixel, x: pixel.x + j / 4, w: .25 }))) : source;
    for (const pixel of pixels) {
      const xx = (pixel.x - 4) * scale, yy = (pixel.y - 4) * scale;
      p(layout === 'monochrome' ? ([0xfff7df,0xe8dcc1,0xb8d9d5].includes(pixel.color) ? cream : ink) : layout === 'shadow' ? ink : pixel.color,
        x + size / 2 + Math.cos(rotation) * xx - Math.sin(rotation) * yy, y + size / 2 + Math.sin(rotation) * xx + Math.cos(rotation) * yy, pixel.w * scale, pixel.h * scale, alpha);
    }
    stage.inspectAreas!.push({ kind: 'rect', x: Math.max(0, x), y: Math.max(0, y), w: Math.min(size + 4, 480 - x), h: Math.min(size + 4, 320 - y) });
  });
  // A tiny travelling marker gives paths life without generating new obstacles or
  // redrawing hundreds of static props every frame. Reduced motion is truly still.
  if (frame >= 0 && ['parade', 'trail', 'track', 'conveyor', 'flock', 'chase', 'orbit', 'race', 'rhythm', 'river', 'network'].includes(layout)) {
    layer = stage.effects;
    const step = frame % 12;
    many(3, i => p(cream, 45 + ((step + i * 4) % 12) * 32, 239, 7, 2, .7));
  }
  return stage;
}
