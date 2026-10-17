import { directedIncidentStage } from './incident-staging.ts';
import type { IncidentPlacement } from './incident-staging.ts';
import { eventVisitorPixels } from './event-visitors.ts';
import type { DailyEpisode, EventTheme } from './daily-event-catalog.ts';
import type { RoomId } from './rooms.ts';
import { getRoom } from './rooms.ts';
import { objectSize, walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { avatarPixels, DEFAULT_APPEARANCE } from './avatar.ts';
import { tableauStage, STAGING } from './event-tableaux.ts';
import { eventPropPixels } from './event-props.ts';

export type StagePixel = { x: number; y: number; w: number; h: number; color: number; alpha: number };
export type DamageShape = { kind: 'ellipse' | 'rect'; x: number; y: number; w: number; h: number };
export type EventStage = { floor: StagePixel[]; scenery: StagePixel[]; effects: StagePixel[]; damage: DamageShape[]; inspectAreas?: DamageShape[]; hero: { x: number; y: number; scale: number }; caption: string; placements?: IncidentPlacement[] };
const descriptions: Record<EventTheme, string> = {
  meteor: '部屋の半分がクレーターに。天井と壁を突き破った巨大隕石が、まだ熱を持っています。',
  thief: '泥棒がオフィスに侵入。開いた金庫、散らばった書類、忍び足の跡。風呂敷を抱えた本人も、まだどこかにいます。',
  flood: '壁の配管が破裂し、部屋全体が水没。机の天板がいかだになって流れています。',
  santa: 'サンタがソリでやって来て、部屋いっぱいにプレゼントを配っています。灯りとリボンで、オフィスがクリスマス会場に。',
  ghost: '普段のオフィスにお化けが大発生。ゴーストバスターズの隊員が、部屋のあちこちで捕獲に奮闘しています。',
  waldo: '普段のオフィスが大混雑。よく似た服や赤い小物の中に、いつもの大きさのウォーリーが紛れています。',
  delorean: 'デロリアンが壁を突き破って激突。二本の炎のタイヤ跡が、部屋の端まで続いています。',
  terminator: 'ターミネーターがマシンガンを掃射。壁も机も蜂の巣で、床には薬きょうが山積みです。',
  momotaro: '大きな桃がオフィスに届き、桃太郎たちが集まっています。机の間で、思いがけない昔話の一幕です。',
  urashima: '竜宮城から水と魚が迷い込み、オフィスが海辺に。送迎係の亀が、しれっと待機しています。',
  kaguya: '光る竹が伸び、月の来客を迎える竹林に。かぐや姫が、その間に立っています。',
  alice: '大きくなるお菓子のせいで、ティーカップだけが巨大化。本人たちも困っています。',
  oz: '室内に竜巻が発生し、書類と小物が大回転。ドロシーたちも、やれやれという顔です。',
  pirate: '海賊船の船首が壁から突入。折れた梁と水しぶきの中で、帆だけが堂々とはためいています。',
  ninja: '壁に巨大な手裏剣が刺さり、床までひび割れ。巻物と瓦が部屋中に飛び散っています。',
  dragon: 'ドラゴンの大きな足跡が部屋を横断。翼を広げる場所に、本人もちょっと苦労しています。',
  slime: 'スライムたちがぷるぷると大集合。キングの日には、王冠をつけた大きな個体もやって来ます。',
  robot: 'ロボットたちが部屋で整備中。部品やケーブルが散らばり、小さな作業隊が忙しく動いています。',
  space: '円盤が天井を突き抜けて不時着。壁一面の光る亀裂から、星空がのぞいています。',
  dinosaur: '三本指の足跡が部屋を横断。オフィスはちょっとした恐竜探検の現場です。',
  magic: '床一面に光る魔法陣が現れ、本や小物が宙に浮いています。術者本人は小さく、事態だけが大ごとです。',
  food: '食べものがオフィスに迷い込み、おいしそうな騒動に。ソースやお菓子のかけらが部屋中に散らばっています。',
  festival: 'いつもの部屋に屋台と提灯が現れ、突然のお祭り。飾りと紙吹雪が部屋に広がっています。',
  detective: '現場の一角に規制線。書類や証拠品が散らばり、名探偵が小さな手掛かりを追いかけています。',
  comic: '漫画の登場人物がオフィスにやって来ました。普段の大きさで、部屋にコマ割りや集中線を持ち込んでいます。',
  kaiju: '巨大な来客が屋根と壁を押し破る大騒動。見上げるほどの体と、部屋いっぱいの破壊跡が残っています。',
};
export function eventStageDescription(event: DailyEpisode): string {
  if (!event.direction.approved) return event.discovery;
  if (!event.scene.special) return STAGING[event.scene.layout];
  if (event.scene.special === 'aquarium') return '水槽から魚ごと水があふれ、机の間が水族館に。水面を泳ぐ魚と空っぽの水槽が見えます。';
  return descriptions[event.scene.special as EventTheme];
}
export function damageContains(shape: DamageShape, x: number, y: number): boolean {
  return shape.kind === 'rect' ? x >= shape.x && x <= shape.x + shape.w && y >= shape.y && y <= shape.y + shape.h : ((x - shape.x) / (shape.w / 2)) ** 2 + ((y - shape.y) / (shape.h / 2)) ** 2 <= 1;
}

// Room-sized scenery is deterministic for every episode. Only this small effects
// layer changes over time; no debris physics, permanent edits or new colliders.
export function roomEventStage(event: DailyEpisode, roomId: RoomId = event.direction.room, objects: readonly RoomObject[] = [], frame = 0): EventStage {
  if (!event.direction.approved || event.id === 'delorean-13') return directedIncidentStage(event, roomId, objects, frame);
  if (!event.scene.special) return tableauStage(event, frame);
  // Only the explicitly selected single episode receives a legacy bespoke stage.
  // Its historical category never causes the other thirteen scenes to repeat it.
  const aquarium = event.scene.special === 'aquarium';
  const original = event;
  event = { ...event, theme: (aquarium ? 'flood' : event.scene.special) as EventTheme, variant: aquarium ? 1 : 0 };
  const stage: EventStage = { floor: [], scenery: [], effects: [], damage: [], hero: { x: 190, y: 173, scale: .75 }, caption: eventStageDescription(event) };
  let target = stage.floor;
  const p = (color: number, x: number, y: number, w: number, h: number, alpha = 1) => {
    const left = Math.max(0, Math.round(x * 2) / 2), top = Math.max(0, Math.round(y * 2) / 2);
    const right = Math.min(480, Math.round((x + w) * 2) / 2), bottom = Math.min(320, Math.round((y + h) * 2) / 2);
    if (right > left && bottom > top) target.push({ color, x: left, y: top, w: right - left, h: bottom - top, alpha });
  };
  const ellipse = (color: number, x: number, y: number, w: number, h: number, alpha = 1) => {
    for (let dy = -h / 2; dy < h / 2; dy += .5) {
      const half = Math.sqrt(Math.max(0, 1 - ((dy + .25) / (h / 2)) ** 2)) * w / 2;
      p(color, x - half, y + dy, half * 2, .5, alpha);
    }
  };
  const line = (color: number, x1: number, y1: number, x2: number, y2: number, width = 2, alpha = 1) => {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / Math.max(.5, width / 2)));
    for (let i = 0; i <= steps; i++) p(color, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, width, width, alpha);
  };
  const prop = (kind: Parameters<typeof eventPropPixels>[0], x: number, y: number, w: number, h = w, alpha = 1) => {
    for (const px of eventPropPixels(kind)) p(px.color, x + px.x * w / 8, y + px.y * h / 8, px.w * w / 8, px.h * h / 8, alpha);
  };
  const ink = 0x303443, concrete = 0x9f9a8b, cream = 0xe1d8bd, ember = 0xe6a365, v = event.variant;
  let seed = (v + 1) * 7919 + Object.keys(descriptions).indexOf(event.theme) * 3571;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const visitorTiles: { x: number; y: number }[] = [];
  for (let y = 3; y < 17; y++) for (let x = 2; x < 28; x++) if (walkableWithObjects(x, y, roomId, objects)) visitorTiles.push({ x, y });
  const visitorAt = (i: number) => { const tile = visitorTiles[(v * 31 + i * 17) % visitorTiles.length] ?? { x: 6, y: 15 }; return { x: tile.x * 16 - 2, y: tile.y * 16 - 20 }; };
  const cx = 232 + (v % 3 - 1) * 12, cy = 140 + (v % 2) * 8;
  const breach = (width = 192, color = 0x334c64) => {
    stage.damage.push({ kind: 'rect', x: cx - width / 2, y: 0, w: width, h: 58 });
    p(concrete, cx - width / 2 - 9, 0, width + 18, 66); p(ink, cx - width / 2, 0, width, 58); p(color, cx - width / 2 + 8, 0, width - 16, 45);
    for (let i = 0; i < 10; i++) { const x = cx - width / 2 + i * width / 10; p(ink, x, 17 + i % 3 * 4, 13, 31); p(0xd4bf82, x + 3, 22 + i % 3 * 4, 3, 2); p(cream, x - 5, 51 + i % 3 * 3, 13, 8); }
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) p(i % 2 ? cream : concrete, cx + side * (width / 2 - 4) + (i % 2 ? -5 : 1), i * 9, 13, 8);
    for (const dx of [-1, 1]) line(ink, cx + dx * (width / 2 + 8), 32, cx + dx * (width / 2 + 48), 80, 3);
  };
  const crater = (w = 328, h = 208, rim = 0x827665, core = 0x454650) => {
    stage.damage.push({ kind: 'ellipse', x: cx, y: cy, w, h });
    ellipse(rim, cx, cy, w + 12, h + 10); ellipse(0xb1a18a, cx, cy - 1, w, h); ellipse(core, cx, cy + 3, w - 24, h - 18); ellipse(0x343945, cx + 4, cy + 14, w - 85, h - 72);
    for (let i = 0; i < 14; i++) { const angle = i / 14 * Math.PI * 2, x = cx + Math.cos(angle) * w * .48, y = cy + Math.sin(angle) * h * .48; line(ink, x, y, x + Math.cos(angle) * 42, y + Math.sin(angle) * 24, 3); p(cream, x, y, 12, 5); }
    for (let i = 0; i < 42; i++) { const angle = random() * Math.PI * 2; p(i % 3 ? concrete : cream, cx + Math.cos(angle) * w * (.35 + random() * .14), cy + Math.sin(angle) * h * (.35 + random() * .14), 5 + random() * 12, 3 + random() * 6); }
  };
  const wreckage = () => {
    for (let i = 0; i < 50; i++) { const x = 35 + random() * 408, y = 56 + random() * 192; p(i % 4 ? concrete : 0x8c664d, x, y, 4 + random() * 13, 3 + random() * 7); if (i % 3 === 0) p(cream, x, y, 6, 2); }
  };
  const water = (color: number) => {
    p(color, 16, 16, 448, 288, .65);
    for (let y = 35; y < 300; y += 17) for (let x = 24 + y % 40; x < 450; x += 52) { p(0xc5edf0, x, y, 30, 2, .7); p(0x7bb5c9, x + 9, y + 4, 26, 2, .7); }
    if (!aquarium) for (let i = 0; i < 8; i++) { const x = 48 + i * 49, y = 76 + (i * 43) % 155; p(0x5d787d, x, y + 9, 37, 5, .5); p(0xc6a77d, x, y, 35, 9); p(0x8c684a, x + 8, y, 2, 9); }
  };
  if (event.theme === 'meteor') { breach(); crater(356, 224); wreckage(); stage.hero = { x: 166, y: 68, scale: 3.2 }; }
  else if (event.theme === 'kaiju' && [0, 10, 14].includes(v)) { breach(); crater(304, 192); wreckage(); }
  else if (event.theme === 'space') { breach(172); crater(248, 136); wreckage(); }
  else if (event.theme === 'delorean') {
    stage.damage.push({ kind: 'rect', x: 0, y: 77, w: 60, h: 139 });
    p(concrete, 0, 67, 67, 158); p(ink, 0, 78, 51, 137); p(0x49657a, 0, 88, 42, 117);
    for (let y = 70; y < 226; y += 13) { p(cream, 43 + y % 3 * 3, y, 18, 8); p(concrete, 58 + y % 4 * 3, y + 5, 10, 7); }
    for (let i = 0; i < 25; i++) p(i % 2 ? concrete : cream, 34 + random() * 85, 90 + random() * 141, 4 + random() * 12, 3 + random() * 6);
  }
  else if (['flood', 'urashima'].includes(event.theme)) water(0x438eaa);
  else if (event.theme === 'pirate') { breach(194, 0x5798ad); water(0x438eaa); wreckage(); }
  else if (event.theme === 'slime') { water(0x79a269); stage.hero = { x: 175, y: 133, scale: v === 3 ? 2.4 : 1.4 }; }
  else if (event.theme === 'dinosaur' || event.theme === 'dragon') {
    for (let i = 0; i < 6; i++) { const x = 66 + i * 62, y = 75 + i % 2 * 100; ellipse(0x82786d, x, y, 36, 23, .65); for (let j = 0; j < 3; j++) p(0x82786d, x - 16 + j * 13, y - 18, 8, 12, .65); }
    stage.hero = { x: 182, y: 123, scale: .75 };
  } else if (event.theme === 'food') stage.hero = { x: 168, y: 80, scale: v === 0 ? 3 : 1.7 };
  // Furniture within the impact is visibly broken in place; its original footprint
  // remains legible while existing movement and links keep their normal rules.
  for (const item of [...getRoom(roomId).furniture, ...objects.filter(o => o.roomId === roomId).map(o => ({ ...o, ...objectSize(o.kind, o.rotation) }))]) {
    const x = item.x * 16, y = item.y * 16, w = item.w * 16, h = item.h * 16;
    if (item.kind === 'calendar' || !stage.damage.some(shape => damageContains(shape, x + w / 2, y + h / 2))) continue;
    p(0x70665b, x + 2, y + 5, Math.max(8, w * .25), 6); p(0xa18d70, x, y + 3, w * .4, 4); p(cream, x + w * .65, y + h - 8, w * .35, 4); line(ink, x + w / 2, y + 3, x + w / 2 - 8, y + h - 4, 3);
  }
  target = stage.scenery;
  if (event.theme === 'delorean') {
    stage.hero = { x: 15, y: 101, scale: 0 };
    // A horizontal silver car, nose embedded in the west wall, with gull-wing doors.
    for (const x of [23, 143]) { p(ink, x, 112, 22, 12); p(ink, x, 185, 22, 13); }
    p(0x53636d, 1, 124, 179, 61); p(0xa1afb5, 8, 120, 163, 65); p(0xd2dad5, 17, 125, 144, 52); p(0x82949f, 173, 130, 17, 43);
    p(0x607a87, 59, 128, 55, 45); p(0x99c0c5, 64, 131, 41, 36); p(0xb3bfbe, 80, 130, 17, 39);
    p(0xcdd5ce, 109, 86, 9, 46); p(0xcdd5ce, 110, 81, 58, 10); p(0x6f858c, 118, 91, 48, 5);
    p(0xe4bd77, 3, 132, 10, 12); p(0xe4bd77, 3, 160, 10, 12); p(0xb96459, 176, 135, 7, 10); p(0xb96459, 176, 161, 7, 10);
    for (let i = 0; i < 7; i++) p(0x4c6571, 123 + i * 7, 137, 3, 26);
    for (const wx of [23,143]) for (const wy of [112,185]) {
      p(0x859394, wx + 3, wy + 3, 16, 5); p(0xd6d9cd, wx + 7, wy + 4, 8, 3);
      for (let dx = 2; dx < 21; dx += 3) p(0x43525c, wx + dx, wy + 1, .5, 10);
    }
    for (const y of [125.5,176.5]) p(0xf1eee0, 18, y, 140, .5);
    line(0x556c78, 39, 129, 50, 151, .5); line(0x556c78, 50, 151, 39, 173, .5);
    p(0x526b77, 114, 126, .5, 51); p(0x526b77, 58, 129, .5, 43);
    p(0xdce3d8, 68, 132, 24, .5); line(0xdce3d8,65,134,72,143,.5);
    p(0x364f5f, 103, 135, 3, 26); p(0x94b1b7, 104, 137, .5, 21);
    p(0xe6ce9b, 93, 147, 3, 7); p(0x334c5b, 122, 169, 32, .5);
    p(0xc4cecc, 110, 83, 55, .5); p(0x415866, 117, 91, 47, .5);
    for (let i=0;i<6;i++) p(0xd8e1da,125+i*7,138,1,24);
    p(0x42576a, 159,143,9,17); p(0xc99c69,162,146,3,9);
    for (const y of [120, 192]) for (let x = 185; x < 458; x += 9) { p(0x443e40, x, y, 9, 8); p(0xcf704b, x, y + 2, 6, 4); p(0xedc275, x, y + 3, 4, 2); }
    for (let i = 0; i < 8; i++) line(0x74c6dc, 190 + i * 27, 143 + i % 2 * 20, 203 + i * 27, 153 + i % 2 * 20, 2);
  } else if (event.theme === 'kaiju' && [0, 10, 14].includes(v)) {
    // A leg descending through the roof and a huge three-clawed foot.
    p(0x293d3c, cx - 60, 0, 124, 119); p(0x48675b, cx - 52, 0, 104, 128);
    for (let y = 7; y < 117; y += 16) for (let x = -45; x < 45; x += 23) { p(0x587567, cx + x, y, 15, 8); p(0x344c47, cx + x + 6, y + 8, 18, 5); }
    ellipse(0x293d3c, cx, 157, 240, 102); ellipse(0x48675b, cx, 145, 220, 93);
    for (const dx of [-74, -2, 68]) { p(0x344f49, cx + dx - 19, 160, 53, 45); p(0x587567, cx + dx - 15, 157, 43, 35); p(0xb9b594, cx + dx - 9, 185, 29, 19); p(0xe0d8b5, cx + dx - 7, 187, 21, 9); p(0x273c38, cx + dx + 20, 194, 3, 9); }
    stage.hero = { x: 380, y: 194, scale: .9 };
  } else if (event.theme === 'terminator') {
    stage.hero = { x: 89, y: 185, scale: .75 };
    p(ink, 112, 206, 33, 5); p(0x8f9b9a, 131, 207, 21, 2); p(ink, 148, 205, 5, 7); p(0x526264, 120, 210, 7, 9);
    for (let i = 0; i < 5; i++) p(0xc7a367, 122 + i * 3, 214 + i % 3 * 2, 2, 4);
    for (let i = 0; i < 120; i++) { const x = 25 + random() * 428, y = i < 75 ? 3 + random() * 42 : 65 + random() * 182; p(0xc3ae8f, x - 2, y - 2, 7, 6); p(0x282b32, x, y, 3, 3); p(0x736558, x + 1, y + 3, 2, 2); }
    for (let i = 0; i < 64; i++) p(0xc5a367, 80 + random() * 105, 218 + random() * 35, 3, 1);
  } else if (event.theme === 'pirate') {
    p(0x503f38, 107, 101, 265, 64); p(0x886044, 121, 100, 233, 56); p(0xbc9664, 125, 106, 225, 6);
    for (let y = 120; y < 157; y += 12) p(0x503f38, 121, y, 233, 2);
    p(0x6a4e3a, 240, 20, 8, 120); p(cream, 252, 28, 90, 65); p(0xc8bea4, 252, 89, 90, 4); p(ink, 280, 46, 32, 22); p(cream, 287, 51, 5, 5); p(cream, 300, 51, 5, 5);
    stage.hero = { x: 56, y: 158, scale: .75 };
  } else if (event.theme === 'space') {
    ellipse(0x344755, cx, 128, 255, 82); ellipse(0x9daeb5, cx, 115, 246, 72); ellipse(0x5d8ea4, cx, 86, 128, 80); ellipse(0xa4d8d4, cx - 11, 74, 76, 35);
    for (let i = 0; i < 8; i++) p(i % 2 ? 0xdfb970 : 0x7acdc5, cx - 97 + i * 28, 126, 11, 5);
    stage.hero = { x: 305, y: 166, scale: .75 };
  } else if (event.theme === 'santa') {
    prop('sleigh', 94, 178, 78, 41);
    for (let i = 0; i < 35; i++) { const x = 24 + random() * 420, y = 45 + random() * 210; prop('gift', x, y, 15, 15); }
    for (let i = 0; i < 28; i++) { p(0x607b5b, 22 + i * 16, 22 + i % 3 * 3, 16, 2); p(i % 2 ? 0xe3bd70 : 0xc97567, 26 + i * 16, 26 + i % 3 * 3, 3, 4); }
    stage.hero = { x: 155, y: 170, scale: .75 };
  } else if (event.theme === 'kaguya') {
    for (let i = 0; i < 18; i++) { const x = 44 + i * 23, y = 36 + i % 4 * 21; p(0x486955, x, y, 10, 151); for (let j = 0; j < 6; j++) { p(0x9ab37d, x, y + j * 25, 10, 3); p(0x6c925f, x - 14, y + j * 25 + 7, 24, 3); } }
    stage.hero = { x: 168, y: 172, scale: .75 };
  } else if (event.theme === 'ninja') {
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; line(0x4b5b65, cx, 104, cx + Math.cos(a + .4) * 113, 104 + Math.sin(a + .4) * 83, 14); line(0xa9b8b9, cx, 101, cx + Math.cos(a + .4) * 107, 101 + Math.sin(a + .4) * 78, 6); }
    ellipse(ink, cx, 104, 36, 28); stage.hero = { x: 300, y: 167, scale: .75 };
  } else if (event.theme === 'alice') {
    p(0xe9dcc8, 134, 107, 177, 72); p(0xd1b897, 144, 166, 157, 17); p(0xe9dcc8, 301, 112, 36, 57); p(0x4f516d, 311, 123, 15, 34); ellipse(cream, 223, 104, 179, 30); ellipse(0x8b6550, 223, 103, 148, 18);
    stage.hero = { x: 327, y: 157, scale: .75 };
  } else if (event.theme === 'momotaro') {
    ellipse(0x805765, cx, 170, 76, 50); ellipse(0xd89196, cx - 13, 165, 49, 48); ellipse(0xedb2a7, cx + 12, 165, 48, 48); line(0x995b72, cx, 142, cx - 3, 183, 2); p(0x719365, cx - 6, 138, 20, 6);
    stage.hero = { x: 327, y: 157, scale: .75 };
  } else if (event.theme === 'festival') {
    for (const x of [35, 350]) { p(0x8e6049, x, 177, 84, 28); p(0xb75352, x, 150, 84, 11); for (let i = 0; i < 7; i++) p(i % 2 ? cream : 0xb75352, x + i * 12, 150, 10, 11); p(0x8e6049, x + 2, 155, 3, 39); p(0x8e6049, x + 77, 155, 3, 39); }
    for (let i = 0; i < 20; i++) { p(0x7b684f, 20 + i * 22, 27 + i % 3, 22, 1); prop('lantern',27 + i * 22,31 + i % 3,12,17); }
    stage.hero = { x: 173, y: 164, scale: .75 };
  } else if (event.theme === 'oz') {
    for (let i = 0; i < 16; i++) { const y = 24 + i * 12, w = 210 - i * 9; p(i % 2 ? 0xa6a5a2 : 0x7b8287, cx - w / 2 + Math.sin(i) * 13, y, w, 9, .9); }
    stage.hero = { x: 332, y: 175, scale: .75 };
  } else if (event.theme === 'magic') {
    for (let i = 0; i < 20; i++) { const angle = i / 20 * Math.PI * 2, next = (i + 7) / 20 * Math.PI * 2; line(0xc1a4cf, cx + Math.cos(angle) * 140, cy + Math.sin(angle) * 75, cx + Math.cos(next) * 140, cy + Math.sin(next) * 75, 2, .65); }
    stage.hero = { x: 176, y: 170, scale: .75 };
  }
  if (['thief', 'detective'].includes(event.theme)) {
    for (let i = 0; i < 33; i++) { const x = 42 + random() * 393, y = 47 + random() * 199; prop('paper',x,y,14,18); }
    if (event.theme === 'detective') for (let i = 0; i < 18; i++) { p(0xd9be70, 80 + i * 16, 238, 15, 5); p(ink, 82 + i * 16, 238, 5, 5); }
  }
  if (stage.hero.scale > 0 && stage.hero.scale <= 1 && event.theme !== 'terminator') { const at = visitorAt(7); stage.hero = { x: at.x - 8, y: at.y - 7, scale: .75 }; }
  if (event.theme === 'thief') {
    p(0x647176, 348, 114, 37, 38); p(0x343f45, 352, 119, 27, 29); p(0x9ba6a2, 382, 116, 6, 38); p(0xc1d0a4, 357, 139, 15, 5); p(0xe1ca88, 362, 131, 10, 5);
    for (let i = 0; i < 17; i++) { const x = 44 + i * 18, y = 230 - i * 5 + i % 2 * 8; ellipse(0x5d5b55, x, y, 4, 7, .6); }
  }
  if (event.theme === 'waldo' || event.theme === 'robot') {
    for (let i = 0; i < (event.theme === 'waldo' ? 38 : 7); i++) {
      const at = visitorAt(i + 14);
      if (event.theme === 'waldo') {
        for (const pixel of avatarPixels({ ...DEFAULT_APPEARANCE, color: i % 3, hair: i % 4, skin: i % 4 })) p(pixel.color, at.x + pixel.x, at.y + pixel.y, pixel.w, pixel.h);
        if (i % 4 === 0) { p(cream, at.x + 4, at.y + 12, 12, 3); p(0xb9605f, at.x + 4, at.y + 17, 12, 2); }
      } else {
        p(0x536c79, at.x + 3, at.y + 6, 14, 11); p(0xaec2c2, at.x + 5, at.y + 8, 10, 5); p(0x5e9b8a, at.x + 5, at.y + 18, 10, 6); p(ink, at.x + 4, at.y + 24, 4, 3); p(ink, at.x + 12, at.y + 24, 4, 3); p(0xdec584, at.x + 8, at.y + 4, 3, 3);
      }
    }
  }
  if (event.theme === 'ghost') {
    for (let i = 0; i < 3; i++) {
      const at = visitorAt(i + 2);
      for (const px of eventVisitorPixels('ghost')) p(px.color,at.x+px.x*.6,at.y+px.y*.6,px.w*.6,px.h*.6);
      line(0xd69c78, at.x + 28, at.y + 18, at.x + 49, at.y - 2, 1, .65);
    }
  }
  if (event.theme === 'comic') for (let i = 0; i < 12; i++) { const angle = i * Math.PI / 6; line(0x8c7f70, 240 + Math.cos(angle) * 190, 150 + Math.sin(angle) * 110, 240 + Math.cos(angle) * 142, 150 + Math.sin(angle) * 82, 1, .5); }
  if (event.theme === 'flood' && !aquarium) for (const x of [70, 219, 378]) {
    p(0x647d84, x, 6, 10, 32); p(0xb3c4c1, x + 2, 6, 4, 32); p(ink, x - 2, 26, 14, 4); p(0x74b9d1, x, 31, 9, 44, .8); p(0xc7eeeb, x + 3, 34, 2, 35, .85); line(0x7cc5dc, x + 4, 34, x + 23, 71, 2, .7); line(0x7cc5dc, x + 4, 34, x - 15, 74, 2, .7);
  }
  if (event.theme === 'flood' && !aquarium) for (const x of [70,219,378]) {
    for (const y of [9,23]) { p(0xd4ddd0,x-1,y,12,1); p(0x526b73,x-1,y+1,12,.5); }
    for (let i=0;i<7;i++) { const yy=41+i*4; p(0xe2f6e7,x+2+i%2,yy,.5,2); }
    for (const dx of [-18,-9,10,19]) { p(0xb4e6e1,x+dx,72+dx%3,2,.5); p(0xe9f5dc,x+dx,70+dx%3,.5,.5); }
  }
  target = stage.effects;
  if (aquarium) {
    stage.hero.scale = 0;
    // Empty aquarium and small fish, distinct from the pipe jets and floating
    // furniture of the other (and only other) flooded room.
    target = stage.scenery;
    p(0x697d86, 328, 39, 97, 73); p(0xb4d7da, 332, 43, 89, 63, .4); p(0x697d86, 331, 109, 5, 20); p(0x697d86, 415, 109, 5, 20);
    target = stage.effects;
    for (let i = 0; i < 16; i++) for (const pixel of eventPropPixels('fish')) p(i % 2 || pixel.color !== 0x6ba7bb ? pixel.color : 0xd6a46a, 35 + i * 69 % 400 + pixel.x * 2 + (frame < 0 ? 0 : frame % 3), 64 + i * 47 % 173 + pixel.y * 2, pixel.w * 2, pixel.h * 2);
    stage.caption = eventStageDescription(original);
  }
  if (event.theme === 'ghost') for (let i = 0; i < 15 + v % 5; i++) {
    const x = 34 + (i * 79 + v * 11) % 404, y = 40 + (i * 47) % 195 + (frame < 0 ? 0 : frame % 3 - 1), color = i % 3 === 0 ? 0x99bc93 : i % 3 === 1 ? 0xece7d8 : 0xb7a7d0;
    for (const pixel of eventPropPixels('ghost')) p(pixel.color === 0xe8dcc1 ? color : pixel.color, x + pixel.x * 2.5, y + pixel.y * 2.5, pixel.w * 2.5, pixel.h * 2.5, .85);
  }
  if (event.theme === 'terminator') {
    const paths = [[437, 63], [419, 120], [445, 199], [369, 43]];
    if (frame >= 0) { const [x, y] = paths[frame % paths.length]; line(0xf4d79c, 152, 208, x, y, 1, .65); p(ember, 152, 205, 8, 6, .8); p(0xf9e7bd, 152, 207, 5, 2, .9); p(cream, x - 4, y - 3, 10, 2, .8); }
  } else if (['flood', 'urashima', 'pirate'].includes(event.theme)) {
    for (let i = 0; i < 20; i++) p(0xe0f4eb, 20 + i * 22, 70 + (i * 37 + Math.max(0, frame) * 3) % 178, 18, 2, .55);
  } else {
    for (let i = 0; i < 12; i++) { const x = cx - 140 + i * 26, y = 80 + (i * 31 + Math.max(0, frame) * 2) % 147; p(event.theme === 'magic' ? 0xe1b8ea : cream, x, y, 3, 3, .5); }
  }
  return stage;
}
