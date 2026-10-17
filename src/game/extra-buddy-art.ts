import type { Pixel } from './avatar.ts';
import type { Direction } from './world.ts';
// Small code-drawn sprites share the existing companion animation system.
export function extraBuddyPixels(kind: string, direction: Direction, frame: number): Pixel[] | undefined {
  if (!['pikachu', 'eevee', 'snorlax', 'vacuum'].includes(kind)) return;
  const pixels: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const foot = frame === 1 ? 1 : frame === 2 ? -1 : 0, front = direction === 'down', back = direction === 'up';
  if (kind === 'pikachu') {
    const yellow = 0xf1ce48, dark = 0x554738;
    p(0xa8803d, 15, 13, 3, 5); p(yellow, 17, 8, 3, 5); p(yellow, 15, 8, 3, 2); p(yellow, 17, 12, 2, 3);
    p(0xa8803d, 5, 18 + foot, 4, 3); p(0xa8803d, 11, 18 - foot, 4, 3);
    p(yellow, 5, 12, 10, 7); p(yellow, 3, 6, 14, 9);
    p(yellow, 3, 1, 3, 7); p(dark, 3, 0, 3, 3); p(yellow, 13, 1, 3, 7); p(dark, 13, 0, 3, 3);
    p(yellow, 3, 13 - foot, 3, 4); p(yellow, 14, 13 + foot, 3, 4);
    if (back) { p(0x936e38, 7, 13, 6, 2); p(0x936e38, 7, 17, 6, 1); }
    else {
      if (front) { p(dark, 6, 8, 2, 3); p(0xfff4ce, 6, 8, 1, 1); p(0xdd6655, 3, 11, 3, 2); }
      p(dark, 12, 8, 2, 3); p(0xfff4ce, 12, 8, 1, 1); p(0xdd6655, 14, 11, 3, 2); p(dark, 9, 11, 2, 1); p(0x9a7040, 9, 13, 3, 1);
    }
  } else if (kind === 'eevee') {
    const fur = 0xaf7949, dark = 0x5e4535, cream = 0xf1dba9;
    p(fur, 15, 12, 5, 6); p(cream, 17, 11, 3, 4);
    p(dark, 5, 18 + foot, 3, 3); p(dark, 12, 18 - foot, 3, 3); p(fur, 5, 12, 10, 7);
    p(fur, 2, 0, 5, 10); p(dark, 3, 2, 2, 6); p(fur, 13, 0, 5, 10); p(dark, 15, 2, 2, 6);
    p(fur, 3, 7, 14, 7); p(cream, 4, 13, 12, 3); p(cream, 6, 15, 8, 2); p(cream, 8, 17, 4, 1);
    if (!back) {
      if (front) { p(dark, 6, 8, 2, 3); p(0xfff4d7, 6, 8, 1, 1); }
      p(dark, 12, 8, 2, 3); p(0xfff4d7, 12, 8, 1, 1); p(0xd8ad79, 8, 11, 5, 2); p(dark, 10, 11, 1, 1);
    }
  } else if (kind === 'snorlax') {
    const blue = 0x48777b, cream = 0xe8d9b3, dark = 0x3b555b;
    p(dark, 3, 18 + foot, 5, 3); p(dark, 12, 18 - foot, 5, 3);
    p(blue, 2, 10, 16, 9); p(blue, 4, 6, 12, 6); p(blue, 3, 2, 4, 7); p(blue, 13, 2, 4, 7);
    p(blue, 1, 12 - foot, 4, 6); p(blue, 15, 12 + foot, 4, 6);
    if (!back) {
      p(cream, 5, 7, 10, 5); p(cream, 4, 13, 12, 5); p(cream, 6, 12, 8, 2);
      if (front) p(dark, 6, 9, 3, 1); p(dark, 11, 9, 3, 1); p(dark, 8, 11, 4, 1);
      p(cream, 4, 19 + foot, 3, 1); p(cream, 13, 19 - foot, 3, 1);
    }
  } else {
    p(0x44585e, 3, 15, 14, 5); p(0x80969a, 1, 12, 18, 6); p(0xced5c9, 3, 9, 14, 7); p(0xe7e8db, 5, 8, 10, 6);
    p(0x6d858b, 8, 6, 5, 4); p(0xaec1be, 9, 6, 3, 2); p(0x86b6a1, 6, 12, 3, 1); p(0x5d8e9d, 12, 12, 2, 2);
    p(0x40555d, 4, 17, 12, 2); p(0xa7b4a8, frame === 1 ? 0 : 1, 16, 3, 1); p(0xa7b4a8, 17, frame === 2 ? 18 : 17, 3, 1);
    p(0x6d858b, back ? 9 : front ? 9 : 13, back ? 9 : front ? 14 : 11, 2, 1);
  }
  return direction === 'left' ? pixels.map((p) => ({ ...p, x: 20 - p.x - p.w })) : pixels;
}
