import type { Pixel } from './avatar.ts';
import type { Direction } from './world.ts';
import type { VehicleKind } from './transport.ts';
export function vehiclePixels(kind: VehicleKind, direction: Direction = 'right', frame = 0): Pixel[] {
  const pixels: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  const side = direction === 'right' || direction === 'left';
  const wheel = (x: number, y: number) => {
    p(0x344a4b, x + 2, y, 4, 1); p(0x344a4b, x + 2, y + 7, 4, 1); p(0x344a4b, x, y + 2, 1, 4); p(0x344a4b, x + 7, y + 2, 1, 4);
    p(0x80958e, x + 1, y + 1, 1, 1); p(0x80958e, x + 6, y + 1, 1, 1); p(0x80958e, x + 1, y + 6, 1, 1); p(0x80958e, x + 6, y + 6, 1, 1);
    p(0xd7d8bd, x + 3, y + 2, 1, 4); p(0xd7d8bd, x + 2, y + 3, 4, 1);
  };
  if (kind === 'bike') {
    if (side) {
      wheel(1, 12); wheel(23, 12);
      p(0xc17f60, 7, 10, 14, 2); p(0xc17f60, 9, 7, 2, 8); p(0xc17f60, 11, 14, 10, 2);
      p(0xc17f60, 18, 6, 2, 10); p(0xc17f60, 20, 9, 3, 2); p(0xc17f60, 22, 10, 2, 3); p(0xc17f60, 24, 12, 2, 4);
      p(0x42564e, 6, 5, 9, 2); p(0x778c86, 21, 1, 2, 9); p(0x42564e, 20, 0, 8, 2);
      p(0xe8c98a, frame === 1 ? 13 : 16, 15, 4, 1);
    } else {
      p(0x344a4b, 14, 10, 4, 10); p(0x9aa8a0, 15, 10, 2, 10);
      p(0xc17f60, 13, 5, 6, 9); p(0xc17f60, 11, 9, 10, 2); p(0x42564e, 10, 4, 12, 2);
      p(0xe9d9a5, 15, 5, 2, 2); p(0x5e766b, 9, 11, 3, 4); p(0x5e766b, 20, 11, 3, 4);
    }
  } else if (kind === 'skateboard') {
    if (side) {
      p(0x42554d, 3, 13, 26, 3); p(0x9bb69b, 5, 12, 22, 2); p(0xe4c583, 12, 13, 8, 1);
      p(0xd3ac67, 6, 16, 4, 4); p(0xd3ac67, 22, 16, 4, 4); p(0x465b57, 7, 17, 2, 2); p(0x465b57, 23, 17, 2, 2);
    } else {
      p(0x42554d, 12, 8, 8, 9); p(0x9bb69b, 13, 9, 6, 7); p(0xe4c583, 14, 10, 4, 4);
      p(0xd3ac67, 10, 15, 3, 4); p(0xd3ac67, 19, 15, 3, 4);
    }
  } else {
    const stride = frame === 1 ? 1 : frame === 2 ? -1 : 0;
    for (const [x, y] of [[8, 12 + stride], [19, 12 - stride]]) {
      p(0xc58d72, x, y, 7, 4); p(0xe6cba0, x + 1, y, 5, 1); p(0x526a66, x, y + 4, 7, 1);
      p(0xd4b36f, x, y + 5, 2, 2); p(0xd4b36f, x + 5, y + 5, 2, 2);
    }
  }
  return direction === 'left' ? pixels.map((p) => ({ ...p, x: 32 - p.x - p.w })) : pixels;
}
