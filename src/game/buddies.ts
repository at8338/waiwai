import { extraBuddyPixels } from './extra-buddy-art.ts';
import { catalogPokemonPixels } from './pokemon-sprites.ts';
import { POKEMON } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
import type { Pixel } from './avatar.ts';
import type { Direction, Point } from './world.ts';
import type { RoomId } from './rooms.ts';

export const BUDDIES = {
  ...POKEMON,
  vacuum: { name: 'ロボット掃除機', icon: '🧹', description: '丸いボディで、今日も静かにオフィスを巡回中。', floating: false },
  robot: { name: 'こつこつロボ', icon: '🤖', description: '小さなアンテナで、今日もあなたのお供。', floating: false },
  dog: { name: 'しばいぬ', icon: '🐕', description: 'とことこ歩く、頼もしい相棒。', floating: false },
  cat: { name: 'きまぐれねこ', icon: '🐈', description: '気まぐれだけど、あなたの後ろが好き。', floating: false },
  ufo: { name: '迷子のUFO', icon: '🛸', description: '宇宙より、あなたのとなりが気になる。', floating: true },
  slime: { name: 'ぷるぷるスライム', icon: '🫧', description: 'うれしいと、ついぷるぷる。', floating: false },
  ghost: { name: 'おひるのおばけ', icon: '👻', description: 'こわがらせるより、一緒に散歩したい。', floating: true },
  sprout: { name: 'あるく植木鉢', icon: '🌱', description: '日なたを探して、ちょこちょこ歩く。', floating: false },
  toast: { name: 'トースト隊長', icon: '🍞', description: 'こんがり元気な、朝の冒険仲間。', floating: false },
} as const;
export type BuddyKind = keyof typeof BUDDIES;
export const BUDDY_KINDS = Object.keys(BUDDIES) as BuddyKind[];
export const isBuddyKind = (value: unknown): value is BuddyKind => typeof value === 'string' && Object.hasOwn(BUDDIES, value);
export type BuddyPosition = Point & { facing: Direction };
export type RoomPet = BuddyPosition & { id: string; roomId: RoomId; kind: RoamingKind };
export const ROAMING_RESIDENTS = [
  { kind: 'dog', roomId: 'office', x: 7, y: 15 },
  { kind: 'cat', roomId: 'library', x: 23, y: 16 },
  { kind: 'vacuum', roomId: 'cafe', x: 18, y: 15 },
] as const satisfies readonly { kind: BuddyKind; roomId: RoomId; x: number; y: number }[];
export type RoamingKind = typeof ROAMING_RESIDENTS[number]['kind'] | PokemonKind;
export const PET_STEP_MS = 650;
export const BUDDY_WIDTH = 20, BUDDY_HEIGHT = 22;

export function facingBetween(from: Point, to: Point, fallback: Direction): Direction {
  if (to.x !== from.x) return to.x > from.x ? 'right' : 'left';
  if (to.y !== from.y) return to.y > from.y ? 'down' : 'up';
  return fallback;
}

export function buddyPixels(kind: BuddyKind, direction: Direction = 'down', frame = 0): Pixel[] {
  const extra = extraBuddyPixels(kind, direction, frame); if (extra) return extra;
  const pokemon = catalogPokemonPixels(kind, direction, frame); if (pokemon) return pokemon;
  const pixels: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const foot = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const eyes = (y: number, color = 0x283f43) => {
    if (direction === 'up') return;
    if (direction === 'down') { p(color, 6, y, 2, 2); p(color, 12, y, 2, 2); }
    else p(color, direction === 'left' ? 5 : 13, y, 2, 2);
  };
  if (kind === 'dog' || kind === 'cat') {
    const fur = kind === 'dog' ? 0xc79257 : 0xb8aaa0;
    const dark = kind === 'dog' ? 0x8c613f : 0x736d72;
    p(dark, 5, 17 + foot, 3, 3); p(dark, 12, 17 - foot, 3, 3);
    p(fur, 5, 10, 10, 8); p(0xeee0bf, 7, 12, 6, 6);
    p(fur, 3, 5, 14, 9);
    if (kind === 'cat') {
      p(dark, 3, 1, 4, 7); p(dark, 13, 1, 4, 7); p(0xd9aaa2, 4, 3, 2, 3); p(0xd9aaa2, 14, 3, 2, 3);
      p(dark, frame === 1 ? 17 : 16, 10, 2, 7); p(dark, 16, 16, 2, 2);
      p(dark, 1, 11, 4, 1); p(dark, 15, 11, 4, 1);
    } else {
      p(dark, 2, 4, 4, 7); p(dark, 14, 4, 4, 7); p(fur, 16, 11 - foot, 3, 3);
      p(0xf5e5c6, 6, 10, 8, 4); p(dark, 9, 10, 2, 2);
    }
    eyes(7);
    if (direction === 'up') p(dark, 8, 5, 4, 5);
    else p(0xc78e87, 9, 12, 2, 1);
  } else if (kind === 'robot') {
    p(0x4a6369, 5, 18 + foot, 3, 3); p(0x4a6369, 12, 18 - foot, 3, 3);
    p(0x648c8b, 5, 12, 10, 7); p(0xc8d3b9, 7, 13, 6, 4); p(0xd4ae64, 9, 14, 2, 2);
    p(0x6f8f92, 3, 4, 14, 9); p(0xc8ddc7, 4, 5, 12, 6); p(0x6f8f92, 9, 1, 2, 4); p(0xe9bd70, 8, 0, 4, 2);
    p(0x648c8b, 2, 13 - foot, 3, 5); p(0x648c8b, 15, 13 + foot, 3, 5); eyes(7);
  } else if (kind === 'ufo') {
    p(0x7699aa, 6, 3, 8, 3); p(0xa5c7c4, 4, 6, 12, 5); p(0xc7e0cc, 6, 5, 5, 3);
    p(0x8c7da0, 2, 10, 16, 5); p(0xb0a1bd, 0, 12, 20, 3); p(0x5d627e, 4, 15, 12, 2);
    for (const x of [3, 9, 15]) p(x === 9 + foot ? 0xf6e1a0 : 0xe8bc78, x, 13, 2, 1);
    p(0xb4c6ab, 7, 18, 6, 2); eyes(8);
  } else if (kind === 'slime') {
    const squash = frame === 1 ? 1 : 0;
    p(0x6c9e82, 3 - squash, 10 + squash, 14 + squash * 2, 8 - squash); p(0x8fbc9b, 5, 6 + squash, 10, 11 - squash);
    p(0x8fbc9b, 8, 4 + squash, 4, 4); p(0xd4e2b5, 6, 8 + squash, 3, 2);
    eyes(11 + squash); p(0x407d6b, 8, 16, 4, 1);
  } else if (kind === 'ghost') {
    p(0xdfded0, 5, 3, 10, 4); p(0xf3f0dc, 3, 7, 14, 10); p(0xf3f0dc, 5, 16, 3, 4 - (frame === 1 ? 1 : 0));
    p(0xf3f0dc, 9, 16, 3, 3); p(0xf3f0dc, 13, 16, 3, 4 - (frame === 2 ? 1 : 0));
    p(0xf3f0dc, 1, 10 - foot, 3, 5); p(0xf3f0dc, 16, 10 + foot, 3, 5); eyes(9);
    if (direction !== 'up') p(0xb2a6a6, 9, 13, 2, 2);
  } else if (kind === 'sprout') {
    p(0x735c43, 5, 18 + foot, 3, 3); p(0x735c43, 12, 18 - foot, 3, 3);
    p(0xb77e58, 5, 11, 10, 8); p(0xdfaa75, 3, 10, 14, 3); p(0x76513b, 5, 10, 10, 1);
    p(0x668b54, 9, 2, 2, 9); p(0x8eb473, 3, 2, 6, 4); p(0x668b54, 11, 0, 6, 5); eyes(14);
  } else {
    p(0x8b6546, 5, 18 + foot, 3, 3); p(0x8b6546, 12, 18 - foot, 3, 3);
    p(0xb77d46, 4, 2, 12, 17); p(0xb77d46, 2, 4, 16, 5); p(0xf3dab0, 5, 4, 10, 13); p(0xf3dab0, 4, 5, 12, 3);
    p(0xe7bd65, 8, 5, 5, 4); p(0xffe4a1, 8, 5, 5, 1); eyes(11);
    if (direction !== 'up') p(0xb87c61, 9, 15, 2, 1);
  }
  return pixels;
}
