import Phaser from 'phaser';
import { COLS, ROWS, TILE, furniture, isWall } from './world.ts';
import type { Direction, Furniture } from './world.ts';

type Paint = Phaser.GameObjects.Graphics;
const rect = (g: Paint, color: number, x: number, y: number, w: number, h: number) => {
  g.fillStyle(color).fillRect(x, y, w, h);
};

function rug(g: Paint, x: number, y: number, w: number, h: number, color: number): void {
  rect(g, 0xb69b71, x - 1, y - 1, w + 2, h + 2);
  rect(g, color, x, y, w, h);
  g.lineStyle(1, 0xfff1cb, 0.5).strokeRect(x + 3, y + 3, w - 6, h - 6);
  for (let i = 5; i < w - 3; i += 8) {
    rect(g, 0xfff1cb, x + i, y + 6, 2, 1);
    rect(g, 0xfff1cb, x + i, y + h - 7, 2, 1);
  }
}

function drawFurniture(scene: Phaser.Scene, item: Furniture): void {
  const { x: tx, y: ty, w: tw, h: th, kind } = item;
  const x = tx * TILE, y = ty * TILE, w = tw * TILE, h = th * TILE;
  const g = scene.add.graphics().setDepth(y + h);
  rect(g, 0xb59b74, x + 2, y + h - 2, w, 4);
  if (kind === 'desk') {
    rect(g, 0x694d3c, x, y, w, h - 4);
    rect(g, 0xb57f50, x + 2, y + 2, w - 4, h - 8);
    rect(g, 0xe5b574, x + 2, y + 2, w - 4, 3);
    rect(g, 0x76513a, x + 4, y + h - 8, 3, 6);
    rect(g, 0x76513a, x + w - 7, y + h - 8, 3, 6);
    rect(g, 0x3e4846, x + 15, y - 1, 18, 12);
    rect(g, 0x8bb6a6, x + 17, y + 1, 14, 8);
    rect(g, 0xd4edc3, x + 19, y + 3, 7, 1);
    rect(g, 0xd4edc3, x + 19, y + 5, 10, 1);
    rect(g, 0x424f49, x + 22, y + 11, 4, 3);
    rect(g, 0xe3dac0, x + 15, y + 16, 16, 4);
    rect(g, 0xfbedd0, x + 37, y + 11, 5, 6);
    rect(g, 0x76604c, x + 38, y + 11, 3, 2);
    rect(g, 0x547365, x + 17, y + 27, 14, 5);
    rect(g, 0x729481, x + 18, y + 24, 12, 5);
  } else if (kind === 'plant') {
    rect(g, 0x946345, x + 4, y + 9, 9, 6);
    rect(g, 0xc78e5d, x + 3, y + 8, 11, 3);
    rect(g, 0x557043, x + 7, y - 2, 3, 12);
    rect(g, 0x476749, x + 1, y, 7, 6);
    rect(g, 0x6c9355, x + 8, y - 5, 6, 8);
    rect(g, 0x85a764, x + 4, y - 4, 5, 5);
    rect(g, 0x5c8250, x + 8, y + 3, 7, 4);
  } else if (kind === 'sofa') {
    rect(g, 0x476957, x, y, w, h - 1);
    rect(g, 0x73987a, x + 2, y + 2, w - 4, 10);
    rect(g, 0x8aab8b, x + 4, y + 3, w - 8, 2);
    for (let i = 6; i < w - 8; i += 18) {
      rect(g, 0x91ab87, x + i, y + 14, 16, 11);
      rect(g, 0xa4bb96, x + i, y + 14, 16, 2);
    }
    rect(g, 0x5a8067, x + 1, y + 11, 5, 17);
    rect(g, 0x5a8067, x + w - 6, y + 11, 5, 17);
    rect(g, 0xf2cf86, x + 8, y + 8, 8, 8);
    rect(g, 0xce916d, x + w - 18, y + 8, 8, 8);
  } else if (kind === 'shelf') {
    rect(g, 0x725039, x, y - 5, w, h + 5);
    rect(g, 0xa87548, x + 2, y - 3, w - 4, h);
    const colors = [0x799e8a, 0xc98162, 0xe6cb7e, 0x708f9c];
    for (let i = 4; i < w - 3; i += 5) rect(g, colors[(i - 4) / 5 % 4], x + i, y, 3, 9);
    rect(g, 0xdda96e, x, y + h - 3, w, 3);
  } else {
    if (th > 1) {
      for (let i = 5; i < w - 4; i += 18) {
        rect(g, 0x648279, x + i, y - 5, 12, 9);
        rect(g, 0x648279, x + i, y + h - 4, 12, 9);
      }
    }
    rect(g, 0x80563d, x, y + 2, w, h - 2);
    rect(g, 0xc18a52, x + 2, y, w - 4, h - 5);
    rect(g, 0xe0b577, x + 3, y + 1, w - 6, 3);
    rect(g, 0xf4e7bc, x + 8, y + 8, 10, 7);
    rect(g, 0x8ba5a0, x + 10, y + 10, 5, 1);
    if (th > 1) {
      rect(g, 0x557459, x + w - 15, y + 13, 7, 9);
      rect(g, 0xe8cf86, x + w - 13, y + 15, 3, 3);
    }
  }
}

export function drawOffice(scene: Phaser.Scene): void {
  const floor = scene.add.graphics().setDepth(-100);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    rect(floor, (x + y) % 3 === 0 ? 0xe4c996 : 0xead3a5, x * TILE, y * TILE, TILE, TILE);
    rect(floor, 0xd8bc8c, x * TILE, y * TILE + 15, TILE, 1);
    rect(floor, 0xd8bc8c, x * TILE + ((y % 2) * 8), y * TILE, 1, TILE);
    if ((x * 7 + y * 3) % 5 === 0) rect(floor, 0xddc292, x * TILE + 5, y * TILE + 6, 6, 1);
  }
  rug(floor, 22 * TILE, 2 * TILE, 6 * TILE, 7 * TILE, 0xc3bf89);
  rug(floor, 12 * TILE, 3 * TILE, 6 * TILE, 5 * TILE, 0x9caf9b);
  rug(floor, 19 * TILE, 14 * TILE, 6 * TILE, 4 * TILE, 0xc69b7a);
  rug(floor, 13 * TILE, 11 * TILE, 4 * TILE, 3 * TILE, 0xa6b18c);
  // Door thresholds distinguish openings from solid walls.
  for (const x of [5, 6, 14, 15, 24, 25]) {
    rect(floor, 0xa77a51, x * TILE, 10 * TILE + 8, TILE, 3);
    rect(floor, 0xf3d49e, x * TILE, 10 * TILE + 8, TILE, 1);
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!isWall(x, y)) continue;
    const g = scene.add.graphics().setDepth(y * TILE + TILE);
    rect(g, 0x795b42, x * TILE, y * TILE, TILE, TILE);
    rect(g, 0xede5bf, x * TILE + 1, y * TILE, TILE - 2, 9);
    rect(g, 0xf9f0d0, x * TILE + 1, y * TILE, TILE - 2, 2);
    rect(g, 0xc2b28b, x * TILE + 1, y * TILE + 9, TILE - 2, 4);
    if (y === 0 && [3, 4, 7, 8, 14, 15, 24, 25].includes(x)) {
      rect(g, 0x7b9b9b, x * TILE + 1, 2, 14, 10);
      rect(g, 0xb9d8c5, x * TILE + 2, 3, 12, 7);
      rect(g, 0xe8edd0, x * TILE + 3, 3, 2, 6);
    }
  }
  furniture.forEach((item) => drawFurniture(scene, item));
}

export const OUTFITS = [0x668d77, 0xc17b5e, 0x698aab];
export function createAvatarTextures(scene: Phaser.Scene): void {
  OUTFITS.forEach((shirt, color) => {
    for (const direction of ['down', 'up', 'left', 'right'] as Direction[]) {
      for (let frame = 0; frame < 3; frame++) {
        const g = scene.make.graphics({ x: 0, y: 0 });
        const foot = frame === 1 ? 1 : frame === 2 ? -1 : 0;
        const bob = frame === 0 ? 0 : -1;
        rect(g, 0x3f4239, 4, 20 + foot, 3, 3);
        rect(g, 0x3f4239, 9, 20 - foot, 3, 3);
        rect(g, 0x59686c, 4, 17, 8, 4);
        rect(g, shirt, 3, 11 + bob, 10, 8);
        rect(g, 0xeac197, 2, 13 + bob, 2, 5);
        rect(g, 0xeac197, 12, 13 + bob, 2, 5);
        rect(g, 0xf2cba2, 4, 4 + bob, 8, 8);
        rect(g, 0x624632, 3, 2 + bob, 10, 5);
        rect(g, 0x624632, 4, 1 + bob, 7, 2);
        rect(g, 0x896140, 4, 3 + bob, 6, 1);
        if (direction === 'up') {
          rect(g, 0x624632, 4, 5 + bob, 8, 5);
          rect(g, 0x496354, 4, 14 + bob, 8, 1);
        } else if (direction === 'down') {
          rect(g, 0x624632, 3, 5 + bob, 2, 3);
          rect(g, 0x3e3a31, 5, 7 + bob, 1, 2);
          rect(g, 0x3e3a31, 10, 7 + bob, 1, 2);
          rect(g, 0xd89a7e, 7, 10 + bob, 2, 1);
        } else {
          const left = direction === 'left';
          rect(g, 0x624632, left ? 10 : 3, 5 + bob, 3, 5);
          rect(g, 0x3e3a31, left ? 4 : 11, 7 + bob, 1, 2);
          rect(g, 0xf2cba2, left ? 3 : 12, 9 + bob, 1, 2);
        }
        g.generateTexture(`avatar-${color}-${direction}-${frame}`, 16, 24);
        g.destroy();
      }
    }
  });
}
