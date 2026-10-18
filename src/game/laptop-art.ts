import type { Pixel } from './avatar.ts';
export const LAPTOP_WIDTH = 14;
export const LAPTOP_HEIGHT = 12;
// One small open laptop, shared by the carried item and the thrown prop.
export function laptopPixels(): Pixel[] {
  const pixels: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  p(0x344959, 1, 0, 12, 8); p(0x96b5bd, 2, 1, 10, 6); p(0x466c89, 3, 2, 8, 4);
  p(0xb9e6dd, 4, 3, 3, 1); p(0x77abb9, 4, 5, 6, 1); p(0x273c49, 1, 7, 12, 1);
  p(0x91a3ab, 0, 8, 14, 3); p(0xd7e1dc, 1, 8, 12, 1);
  for (let x = 2; x < 12; x += 2) p(0x4d6570, x, 9, 1, 1);
  p(0xbed0cf, 6, 10, 3, 1); p(0x405663, 0, 11, 14, 1);
  return pixels;
}
