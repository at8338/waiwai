import type { Pixel } from './avatar.ts';
import type { Direction } from './world.ts';
export function pokemonPixels(kind: string, direction: Direction, frame: number): Pixel[] | undefined {
  if (!['bulbasaur', 'charmander', 'squirtle', 'jigglypuff', 'psyduck', 'gengar', 'mew'].includes(kind)) return;
  const pixels: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const foot = frame === 1 ? 1 : frame === 2 ? -1 : 0, back = direction === 'up', front = direction === 'down';
  const eyes = (color: number, y: number) => { if (back) return; if (front) p(color, 5, y, 2, 3); p(color, 12, y, 2, 3); };
  if (kind === 'bulbasaur') {
    p(0x427764, 3, 17 + foot, 4, 3); p(0x427764, 12, 17 - foot, 4, 3);
    p(0x65a391, 3, 10, 14, 8); p(0x3e795a, 8, 4, 9, 8); p(0x75a957, 10, 1, 5, 7); p(0x8eba64, 7, 4, 10, 4);
    p(0x65a391, 2, 6, 14, 9); p(0x65a391, 2, 4, 4, 4); p(0x65a391, 12, 4, 4, 4);
    p(0x376a63, 4, 7, 2, 2); p(0x376a63, 9, 14, 3, 2); eyes(0x9a514a, 9); if (!back) p(0xe7dfb6, 8, 13, 3, 1);
  } else if (kind === 'charmander') {
    p(0xc58149, 15, 14, 4, 5); p(0xf0bd52, 16, 10, 3, 5); p(0xdc7141, 16, 8, 2, 4); p(0xffe49b, 17, 12, 2, 3);
    p(0xbc7244, 5, 18 + foot, 4, 3); p(0xbc7244, 11, 18 - foot, 4, 3); p(0xdf9554, 5, 10, 10, 9);
    p(0xdf9554, 3, 3, 13, 10); p(0xdf9554, 2, 8, 15, 4); if (!back) p(0xf6d39a, 7, 13, 6, 6);
    p(0xdf9554, 3, 12 - foot, 3, 5); eyes(0x3e6266, 6); if (!back) p(0x805741, 7, 11, 5, 1);
  } else if (kind === 'squirtle') {
    p(0x5a8c9d, 4, 18 + foot, 4, 3); p(0x5a8c9d, 12, 18 - foot, 4, 3);
    p(0x917649, 4, 10, 13, 9); p(0xebd6a0, 5, 11, 10, 8); p(0x70b2bb, 4, 2, 12, 10);
    p(0x70b2bb, 2, 11 - foot, 4, 5); p(0x70b2bb, 14, 11 + foot, 4, 5); p(0x70b2bb, 16, 15, 4, 4); p(0x467c91, 17, 15, 2, 2);
    if (back) { p(0x917649, 5, 11, 10, 7); p(0xc5a26a, 8, 12, 4, 4); } else { p(0xbc9f6d, 5, 15, 10, 1); eyes(0x4e5365, 5); p(0x527e84, 8, 10, 4, 1); }
  } else if (kind === 'jigglypuff') {
    p(0xbe8292, 3, 18 + foot, 5, 3); p(0xbe8292, 12, 18 - foot, 5, 3);
    p(0xe2aab8, 2, 6, 16, 13); p(0xe2aab8, 4, 3, 12, 5); p(0xe2aab8, 2, 1, 5, 6); p(0xe2aab8, 13, 1, 5, 6);
    p(0x896577, 3, 2, 3, 3); p(0x896577, 14, 2, 3, 3); p(0xf4c9d0, 8, 2, 5, 4); p(0xc3899e, 10, 3, 2, 2);
    if (!back) { p(0xf9ecd7, 4, 8, 5, 5); p(0xf9ecd7, 11, 8, 5, 5); p(0x46878c, 6, 8, 3, 4); p(0x46878c, 11, 8, 3, 4); p(0x9a6175, 9, 15, 2, 1); }
  } else if (kind === 'psyduck') {
    p(0xb78f4c, 3, 18 + foot, 5, 3); p(0xb78f4c, 12, 18 - foot, 5, 3); p(0xe3bf63, 4, 10, 12, 9);
    p(0x514c40, 8, 0, 1, 4); p(0x514c40, 10, 0, 1, 3); p(0x514c40, 12, 1, 1, 3); p(0xe3bf63, 3, 3, 14, 10);
    p(0xe3bf63, 1, 8 - foot, 4, 7); p(0xe3bf63, 15, 8 + foot, 4, 7);
    if (!back) { p(0xf7f0cf, 4, 6, 5, 4); p(0xf7f0cf, 11, 6, 5, 4); p(0x504b41, 6, 7, 1, 2); p(0x504b41, 13, 7, 1, 2); p(0xe7d09b, 6, 10, 8, 4); p(0xa68e5d, 8, 11, 1, 1); p(0xa68e5d, 11, 11, 1, 1); }
  } else if (kind === 'gengar') {
    p(0x65527c, 3, 18 + foot, 5, 3); p(0x65527c, 12, 18 - foot, 5, 3); p(0x81669b, 2, 6, 16, 13);
    p(0x81669b, 2, 1, 5, 8); p(0x81669b, 13, 1, 5, 8); p(0x81669b, 8, 3, 3, 4); p(0x81669b, 0, 12 - foot, 3, 4); p(0x81669b, 17, 12 + foot, 3, 4);
    if (!back) { p(0xb85d76, 4, 8, 5, 2); p(0xb85d76, 11, 8, 5, 2); p(0x4a405d, 7, 9, 2, 2); p(0x4a405d, 11, 9, 2, 2); p(0xf3e7c9, 4, 13, 12, 3); p(0x65527c, 7, 13, 1, 3); p(0x65527c, 12, 13, 1, 3); }
  } else {
    p(0xc991aa, 15, 9, 2, 9); p(0xc991aa, 16, 7, 3, 3); p(0xc991aa, 13, 17, 4, 2);
    p(0xe9b7c9, 6, 10, 8, 8); p(0xe9b7c9, 3, 4, 13, 8); p(0xe9b7c9, 3, 1, 4, 6); p(0xe9b7c9, 12, 1, 4, 6);
    p(0xe9b7c9, 3, 12 - foot, 4, 4); p(0xe9b7c9, 11, 16 + foot, 3, 4); p(0xe9b7c9, 5, 16 - foot, 3, 4); eyes(0x5d89a3, 6); if (!back) p(0xb27d98, 8, 10, 3, 1);
  }
  return direction === 'left' ? pixels.map((pixel) => ({ ...pixel, x: 20 - pixel.x - pixel.w })) : pixels;
}
