import type { Pixel } from './avatar.ts';

// A stylized Tokyo Bay panorama rather than a geographically exact camera view.
export function tokyoBayPixels(night: boolean, overcast: boolean, elevated = false): Pixel[] {
  const pixels: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const water = night ? 0x243e59 : overcast ? 0x8babb0 : 0x8ebbc3;
  p(water, 0, 45, 480, 11);
  // Odaiba's paired building blocks and its spherical observation room.
  const building = night ? 0x607d91 : 0xc1cfc8, edge = night ? 0x91a6b1 : 0xdee0cc;
  p(building, 402, 24, 9, 21); p(building, 435, 20, 10, 25); p(edge, 403, 24, 1, 20); p(edge, 436, 20, 1, 24);
  p(building, 404, 28, 40, 3); p(building, 406, 39, 36, 3);
  p(edge, 417, 20, 12, 8); p(edge, 419, 18, 8, 12);
  p(night ? 0xa6bac0 : 0x8ba9b3, 419, 21, 9, 6); p(night ? 0xd6d8bd : 0xe6e4cf, 420, 19, 5, 2);
  for (const x of [404, 408, 437, 441]) for (let y = 26; y < 40; y += 4) p(night ? 0xe6cb8d : 0x89a7af, x, y, 1, 2);
  // Tokyo Tower: tapered red-and-white lattice and two observation decks.
  const tower = night ? 0xe9a16c : 0xbc765a, stripe = night ? 0xffdca0 : 0xf1e2c1;
  p(tower, 59, 7, 1, 7); p(tower, 58, 12, 3, 4);
  for (let y = 15; y < 42; y += 2) {
    const width = 3 + Math.floor((y - 15) / 4) * 2;
    p(y === 19 || y === 27 || y === 35 ? stripe : tower, 60 - Math.floor(width / 2), y, width, 2);
    if (y > 28) p(night ? 0x34475f : 0x9caaa7, 59, y + 1, 3, 1);
  }
  p(tower, 53, 25, 14, 3); p(stripe, 54, 25, 12, 1);
  p(tower, 55, 18, 10, 2); p(tower, 52, 40, 3, 5); p(tower, 65, 40, 3, 5);
  // Rainbow Bridge's two towers, curved main cables and vertical suspenders.
  const cable = night ? 0xd8d9bd : 0x718a91, structure = night ? 0xccd1bf : 0xc9d4ce;
  const cableY = (x: number) => x < 130 ? 12 + 23 * (1 - x / 130) ** 2
    : x > 350 ? 12 + 23 * ((x - 350) / 130) ** 2
    : 12 + 19 * (1 - ((x - 240) / 110) ** 2);
  for (let x = 0; x < 480; x += 2) p(cable, x, Math.round(cableY(x)), 2, 1);
  for (let x = 10; x < 480; x += 12) {
    const y = Math.round(cableY(x)); p(night ? 0x8da4ab : 0x9cafa9, x, y, 1, 40 - y);
  }
  for (const x of [130, 350]) {
    p(structure, x - 6, 12, 3, 34); p(structure, x + 3, 12, 3, 34);
    p(structure, x - 6, 14, 12, 3); p(structure, x - 6, 26, 12, 2);
    p(night ? 0xf5dfae : 0xe3e5d3, x - 6, 12, 2, 33);
    p(night ? 0x768c99 : 0x788e94, x - 4, 44, 8, 7);
  }
  p(night ? 0x8499a1 : 0x81989b, 0, 39, 480, 4); p(night ? 0xe8cc91 : 0xc5d1c5, 0, 39, 480, 1);
  for (let x = 5; x < 480; x += 16) p(night ? 0xf1d39b : 0xdee0c7, x, 41, 3, 1);
  for (let i = 0; i < 48; i++) {
    const x = (i * 43 + 7) % 472, y = 47 + i % 8;
    p(night ? i % 3 ? 0x8a9a98 : 0xd0b57f : 0xb6d1d0, x, y, 3 + i % 5, 1);
  }
  if (!elevated) return pixels;
  const distant = pixels.filter((pixel) => pixel.y < 45).map((pixel) => ({ ...pixel, y: Math.round(pixel.y * 0.6 + 2), h: Math.max(1, Math.round(pixel.h * 0.6)) }));
  pixels.length = 0;
  p(water, 0, 28, 480, 52);
  pixels.push(...distant);
  // From the roof the horizon sits high, with bay water and nearby rooftops below.
  for (let i = 0; i < 56; i++) p(night ? i % 3 ? 0x718b99 : 0xc4ad7e : 0xb7d1cf, (i * 43 + 9) % 468, 34 + (i * 11) % 37, 3 + i % 7, 1);
  for (const [x, y, width] of [[12, 54, 58, 14], [93, 64, 46, 11], [359, 61, 51, 13], [421, 49, 48, 16]]) {
    p(night ? 0x2a4058 : 0x7c9499, x, y + 5, width, 80 - y - 5);
    p(night ? 0x718898 : 0xc0cfca, x + 4, y, width - 4, 10);
    p(night ? 0x556f82 : 0xa3b8b4, x, y + 4, width, 7);
    p(night ? 0x8a9b9f : 0xdbe0cb, x + 4, y, width - 4, 2);
    p(night ? 0x3d5369 : 0x859e9f, x + 13, y + 2, 12, 5);
    p(night ? 0x93a9ad : 0xd8e0d5, x + 13, y + 2, 12, 1);
    p(night ? 0x3d5369 : 0x859e9f, x + width - 15, y + 3, 8, 4);
    for (let row = y + 12; row < 79; row += 5) for (let window = 5; window < width - 3; window += 7) p(night ? 0xd9bc80 : 0xb3cfcb, x + window, row, 2, 2);
  }
  return pixels;
}
