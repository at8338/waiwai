import { ARCADE_GAMES, ARCADE_IDS } from './arcade.ts';
import type { ArcadeGame } from './arcade.ts';
import { cockpitFurniturePixels } from './robot-art.ts';
import { roomWindowColumns } from './lighting.ts';
import Phaser from 'phaser';
import { COLS, ROWS, TILE, isWall } from './world.ts';
import type { Direction, Furniture } from './world.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { avatarPixels, appearanceKey, DEFAULT_APPEARANCE, SHIRTS } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import type { RoomObject } from './objects.ts';
import { objectSize } from './objects.ts';
import type { AvatarPose } from './reactions.ts';

type Paint = Phaser.GameObjects.Graphics;
const rect = (g: Paint, color: number, x: number, y: number, w: number, h: number) => {
  g.fillStyle(color).fillRect(x, y, w, h);
};
type PixelRect = (color: number, x: number, y: number, w: number, h: number) => void;

// Decorative tool terminals. Live metrics are viewed at the configured links.
function monitor(p: PixelRect, w: number, h: number): void {
  p(0x283c47, 0, 0, w, h - 4); p(0x8aa0a2, 1, 1, w - 2, h - 7);
  p(0x233b48, 3, 3, w - 6, h - 11); p(0x41616a, 4, 4, w - 8, 3);
  p(0xbbcdb9, 6, 5, 9, 1); p(0x758f96, 6, 10, 1, h - 20);
  p(0x758f96, 6, h - 12, w - 13, 1);
  const heights = [3, 6, 4, 8, 6, 9, 5, 7];
  for (let i = 0; i < Math.floor((w - 17) / 7); i++) {
    const height = Math.min(heights[i % heights.length], h - 22);
    p(i % 3 === 0 ? 0xd4bc83 : 0x8bbab1, 10 + i * 7, h - 13 - height, 4, height);
  }
  p(0x354c55, w / 2 - 3, h - 4, 6, 3); p(0xb1bda7, w / 2 - 11, h - 2, 22, 2);
}

function serverRack(p: PixelRect, w: number, h: number): void {
  p(0x293b46, 0, 0, w, h); p(0x72878a, 1, 1, w - 2, h - 2);
  p(0x344c57, 3, 3, w - 6, h - 6);
  for (let row = 5; row < h - 7; row += 7) {
    p(0x9cafa9, 5, row, w - 10, 5); p(0x45616c, 8, row + 1, w - 20, 3);
    p(0xb9c9bc, w - 11, row + 1, 2, 2); p(0x7b999f, w - 8, row + 1, 1, 2);
  }
  p(0x293b46, 3, h - 2, 6, 2); p(0x293b46, w - 9, h - 2, 6, 2);
}

function rug(g: Paint, x: number, y: number, w: number, h: number, color: number): void {
  rect(g, 0xb69b71, x - 1, y - 1, w + 2, h + 2);
  rect(g, color, x, y, w, h);
  g.lineStyle(1, 0xfff1cb, 0.5).strokeRect(x + 3, y + 3, w - 6, h - 6);
  for (let i = 5; i < w - 3; i += 8) {
    rect(g, 0xfff1cb, x + i, y + 6, 2, 1);
    rect(g, 0xfff1cb, x + i, y + h - 7, 2, 1);
  }
}

function drawFurniture(scene: Phaser.Scene, item: Furniture, openCalendar?: () => void, openBoard?: (item: Furniture) => void): void {
  const { x: tx, y: ty, w: tw, h: th, kind } = item;
  const x = tx * TILE, y = ty * TILE, w = tw * TILE, h = th * TILE;
  const g = scene.add.graphics().setDepth(y + h);
  if (kind !== 'calendar' && kind !== 'board') rect(g, 0xb59b74, x + 2, y + h - 2, w, 4);
  if (['viewport', 'reactor', 'console', 'pilot'].includes(kind)) {
    for (const pixel of cockpitFurniturePixels(kind, w, h)) rect(g, pixel.color, x + pixel.x, y + pixel.y, pixel.w, pixel.h);
  } else if (kind === 'calendar') {
    rect(g, 0x816d59, x, y + 1, w, h - 1); rect(g, 0xfff3d8, x + 2, y + 2, w - 4, h - 3);
    rect(g, 0xbb6559, x + 2, y + 2, w - 4, 4);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 7; col++) rect(g, col === 0 ? 0xc06a5b : 0x84918b, x + 3 + col * 4, y + 8 + row * 4, 2, 2);
    rect(g, 0xe5b556, x + 19, y + 8, 3, 3);
    for (const hook of [7, w - 9]) { rect(g, 0x5c665c, x + hook, y, 2, 4); rect(g, 0xe9e0bd, x + hook, y + 1, 1, 2); }
    if (openCalendar) g.setInteractive(new Phaser.Geom.Rectangle(x, y, w, h), Phaser.Geom.Rectangle.Contains).on('pointerup', openCalendar);
  } else if (kind === 'parking') {
    rect(g, 0xa8b3a2, x, y, w, h); rect(g, 0xd7dcc3, x + 1, y + 1, w - 2, h - 2);
    rect(g, 0x789083, x, y, w, 2);
    for (let slot = 0; slot < 3; slot++) { rect(g, 0x8a998e, x + slot * 16 + 3, y + 3, 2, 10); rect(g, 0x8a998e, x + slot * 16 + 3, y + 12, 9, 2); }
  } else if (kind === 'vending') {
    rect(g, 0x557e87, x, y, w, h); rect(g, 0x8bb5b3, x + 2, y + 2, w - 4, h - 4);
    rect(g, 0xe9ecd2, x + 4, y + 4, w - 8, 7); rect(g, 0x557e87, x + 7, y + 6, w - 14, 2);
    rect(g, 0x344f5c, x + 4, y + 13, w - 12, 18);
    for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
      rect(g, [0xc9e6de, 0xe5c680, 0xd49b89][col], x + 6 + col * 5, y + 15 + row * 8, 3, 6);
      rect(g, 0xf0f1d4, x + 7 + col * 5, y + 14 + row * 8, 1, 2);
    }
    rect(g, 0xe2c97f, x + w - 7, y + 16, 3, 3); rect(g, 0x344f5c, x + 6, y + h - 11, w - 12, 6);
    rect(g, 0x567580, x + 2, y + h - 3, 5, 3); rect(g, 0x567580, x + w - 7, y + h - 3, 5, 3);
  } else if (kind === 'monitor' || kind === 'rack') {
    const p: PixelRect = (color, px, py, pw, ph) => rect(g, color, x + px, y + py, pw, ph);
    if (kind === 'monitor') monitor(p, w, h); else serverRack(p, w, h);
  } else if (kind === 'desk' || kind === 'workbench') {
    rect(g, 0x694d3c, x, y, w, h - 4);
    rect(g, 0xb57f50, x + 2, y + 2, w - 4, h - 8);
    rect(g, 0xe5b574, x + 2, y + 2, w - 4, 3);
    rect(g, 0x76513a, x + 4, y + h - 8, 3, 6);
    rect(g, 0x76513a, x + w - 7, y + h - 8, 3, 6);
    if (kind === 'desk') {
    rect(g, 0x3e4846, x + 15, y - 1, 18, 12);
    rect(g, 0x8bb6a6, x + 17, y + 1, 14, 8);
    rect(g, 0xd4edc3, x + 19, y + 3, 7, 1);
    rect(g, 0xd4edc3, x + 19, y + 5, 10, 1);
    rect(g, 0x424f49, x + 22, y + 11, 4, 3);
    rect(g, 0xe3dac0, x + 15, y + 16, 16, 4);
    rect(g, 0xfbedd0, x + 37, y + 11, 5, 6);
    rect(g, 0x76604c, x + 38, y + 11, 3, 2);
    } else {
      rect(g, 0x7a6850, x + 8, y + 7, 3, 13);
      rect(g, 0x586a6b, x + 4, y + 5, 11, 4);
      rect(g, 0xc27f5a, x + 23, y + 13, 12, 3);
      rect(g, 0x688c7c, x + 26, y + 4, 3, 13);
      rect(g, 0xe1d5a8, x + w - 21, y + 6, 13, 12);
    }
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
  } else if (kind === 'board') {
    // Raise the face while keeping the original footprint and saved link identity.
    const wall = item.boardMount === 'wall', top = y - 14, faceH = wall ? 27 : 28;
    const bottom = top + faceH, foot = y + h - 3;
    if (wall) {
      rect(g, 0xb8ae95, x + 2, top + 2, w, faceH + 2);
      for (const bx of [x + 7, x + w - 9]) rect(g, 0x626e70, bx, top - 1, 2, 5);
    } else {
      rect(g, 0xb7ab90, x + 6, foot + 2, w - 12, 3);
      for (const leg of [x + 9, x + w - 12]) {
        rect(g, 0x56666d, leg, bottom - 3, 3, foot - bottom + 4);
        rect(g, 0xb4c3c2, leg, bottom - 3, 1, foot - bottom + 3);
        rect(g, 0x829798, leg - 5, foot - 1, 13, 2);
        for (const wheel of [leg - 5, leg + 5]) { rect(g, 0x394b53, wheel, foot + 1, 3, 3); rect(g, 0x8c9b9a, wheel + 1, foot + 1, 1, 1); }
      }
      rect(g, 0x8b9d9d, x + 12, bottom + 8, w - 24, 2);
    }
    rect(g, 0x536b72, x, top, w, faceH);
    rect(g, 0xc5d2d0, x + 1, top + 1, w - 2, faceH - 2);
    rect(g, 0xfafcf1, x + 3, top + 3, w - 6, faceH - 6);
    rect(g, 0xffffff, x + 4, top + 3, w - 8, 2);
    // Small marker notes and a flow diagram, on a vertical white writing surface.
    rect(g, 0x4d858c, x + 8, top + 7, Math.min(23, w - 36), 2);
    for (let row = 0; row < 2; row++) {
      rect(g, 0x839b9d, x + 8, top + 13 + row * 5, 2, 2);
      rect(g, 0x839b9d, x + 13, top + 13 + row * 5, row ? 13 : 18, 1);
    }
    const diagram = x + w - 25;
    g.lineStyle(1, 0x639b9a).strokeRect(diagram, top + 8, 13, 6);
    rect(g, 0x639b9a, diagram + 6, top + 15, 1, 3);
    rect(g, 0x639b9a, diagram + 4, top + 17, 5, 1);
    g.lineStyle(1, 0xc48479).strokeRect(diagram + 2, top + 19, 9, 3);
    rect(g, 0x82999c, x + 3, bottom - 2, w - 6, 3);
    rect(g, 0xd6dfd9, x + 4, bottom - 2, w - 8, 1);
    for (const [offset, color] of [[8, 0x477d99], [16, 0xc86e63], [24, 0x4b6969]]) {
      rect(g, color, x + offset, bottom - 3, 6, 1); rect(g, 0x394f59, x + offset, bottom - 3, 1, 1);
    }
    rect(g, 0x647b84, x + w - 16, bottom - 4, 8, 2);
    if (openBoard) g.setInteractive(new Phaser.Geom.Rectangle(x, top, w, y + h - top), Phaser.Geom.Rectangle.Contains)
      .on('pointerup', () => openBoard(item));
  } else if (kind === 'buffet' || kind === 'dishreturn') {
    rect(g, 0x536e70, x, y + 10, w, h - 10); rect(g, 0xa3bbb3, x + 2, y + 12, w - 4, h - 15);
    rect(g, 0xd9e3d3, x, y + 9, w, 4); rect(g, 0xf7f1d7, x + 2, y + 9, w - 4, 1);
    for (let i = 6; i < w - 6; i += 26) { rect(g, 0x78988e, x + i, y + 26, 22, 14); rect(g, 0xc9d7c2, x + i + 17, y + 30, 2, 6); }
    rect(g, 0x435e63, x + 4, y + h - 3, w - 8, 3);
    if (kind === 'buffet') {
      for (let i = 8; i < w - 47; i += 27) {
        rect(g, 0x738e8d, x + i, y + 14, 23, 10); rect(g, 0xf0e8c9, x + i + 2, y + 15, 19, 7);
        rect(g, 0x9da75a, x + i + 4, y + 17, 6, 4); rect(g, 0xc68c55, x + i + 11, y + 16, 7, 4);
        rect(g, 0xcce1d6, x + i + 5, y + 2, 1, 5); rect(g, 0xcce1d6, x + i + 8, y, 1, 4);
      }
      // Rice cooker, stacked bowls and a glass sneeze guard.
      rect(g, 0x536b70, x + w - 34, y + 12, 22, 13); rect(g, 0xe9e8d1, x + w - 33, y + 9, 20, 11);
      rect(g, 0xfaf3d9, x + w - 35, y + 8, 24, 3); rect(g, 0x536b70, x + w - 26, y + 6, 6, 2);
      rect(g, 0xcb8d60, x + w - 25, y + 15, 4, 2);
      for (const post of [3, w - 6]) rect(g, 0x759294, x + post, y, 2, 27);
      rect(g, 0xa7c6c0, x + 3, y, w - 6, 2); rect(g, 0xd5e5d1, x + 6, y + 3, w - 12, 1);
    } else {
      rect(g, 0x334e56, x + 6, y + 15, w - 12, 13);
      for (let i = 9; i < w - 13; i += 18) for (let row = 0; row < 3; row++) {
        rect(g, 0xc6d7ce, x + i, y + 19 - row * 3, 15, 2); rect(g, 0xf5edcf, x + i + 2, y + 18 - row * 3, 11, 1);
      }
      rect(g, 0x8ca59b, x + 7, y + 32, w - 14, 5);
    }
  } else if (kind === 'counter') {
    rect(g, 0x8b654a, x, y, w, h); rect(g, 0xe5c394, x, y, w, 8);
    rect(g, 0x455759, x + 10, y - 6, 21, 14); rect(g, 0xa7bfb4, x + 12, y - 4, 13, 7);
    for (let i = 42; i < w - 9; i += 17) { rect(g, 0xf8edcf, x + i, y + 2, 7, 7); rect(g, 0x7a5340, x + i + 1, y + 2, 5, 2); }
    for (let i = 8; i < w - 6; i += 24) rect(g, 0xad825b, x + i, y + 13, 17, 15);
  } else if (kind === 'pond') {
    rect(g, 0x879b83, x, y, w, h); rect(g, 0x72a7ad, x + 3, y + 3, w - 6, h - 6);
    for (let i = 9; i < w - 8; i += 19) { rect(g, 0xb1d5cc, x + i, y + 16 + i % 3 * 12, 13, 1); }
    rect(g, 0x6e9367, x + 12, y + 12, 12, 6); rect(g, 0xdfc3ba, x + 16, y + 10, 4, 4);
    rect(g, 0x6e9367, x + w - 29, y + h - 23, 14, 6);
  } else if (kind === 'easel') {
    rect(g, 0x94714f, x + 6, y + 3, 4, h - 3); rect(g, 0x94714f, x + w - 10, y + 3, 4, h - 3);
    rect(g, 0xf5e8cd, x + 2, y, w - 4, h - 9); rect(g, 0xb3c19a, x + 5, y + 4, w - 10, h - 17);
    rect(g, 0xd99c83, x + 7, y + 10, 11, 14); rect(g, 0x829db3, x + 18, y + 5, 17, 17);
    rect(g, 0xd9bb79, x + 26, y + 22, 10, 8); rect(g, 0x8e6a45, x, y + h - 10, w, 3);
  } else if (kind === 'arcade') {
    rect(g, 0x383b53, x + 3, y, w - 6, h); rect(g, 0xc290b5, x + 2, y, w - 4, 5);
    rect(g, 0x9cbfc5, x + 7, y + 7, w - 14, 22); rect(g, 0x40556b, x + 9, y + 9, w - 18, 18);
    rect(g, 0xdbc07d, x + 15, y + 16, 5, 5); rect(g, 0xa7c598, x + 27, y + 20, 7, 3);
    rect(g, 0x8d769f, x + 3, y + 31, w - 6, 8); rect(g, 0x2b3543, x + 11, y + 30, 3, 6);
    rect(g, 0xdca28e, x + 28, y + 33, 4, 3); rect(g, 0x242c3b, x + 17, y + h - 7, 12, 3);
  } else if (kind === 'bed') {
    rect(g, 0x8b765f, x, y, w, h); rect(g, 0xf2e8cf, x + 3, y + 3, w - 6, h - 6);
    rect(g, 0xfcf7e3, x + 9, y + 6, w - 18, 12); rect(g, 0xa1b7ad, x + 3, y + 22, w - 6, h - 25);
    rect(g, 0xc2d0bf, x + 3, y + 22, w - 6, 5);
  } else if (kind === 'telescope') {
    rect(g, 0x8798ab, x + 20, y + 17, 4, h - 17);
    rect(g, 0x8798ab, x + 12, y + h - 4, 21, 3);
    rect(g, 0xdfdcbf, x + 5, y + 10, 31, 10); rect(g, 0xa4bbca, x + 3, y + 8, 7, 14);
    rect(g, 0x36465f, x + 3, y + 10, 3, 10); rect(g, 0xdfdcbf, x + 32, y + 13, 7, 5);
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
    if (item.tableSetting === 'meal') {
      // Two little lunch trays; the existing table chairs remain usable.
      for (const offset of [12, w - 31]) {
        rect(g, 0x637f7b, x + offset, y + 7, 21, 13); rect(g, 0xb4be8a, x + offset + 1, y + 8, 19, 11);
        rect(g, 0xf9efd2, x + offset + 3, y + 10, 7, 6); rect(g, 0xdab883, x + offset + 4, y + 14, 5, 2);
        rect(g, 0xc58d5c, x + offset + 12, y + 10, 6, 4); rect(g, 0x729255, x + offset + 12, y + 15, 3, 2);
        rect(g, 0x704d3b, x + offset + 4, y + 21, 16, 1); rect(g, 0x704d3b, x + offset + 4, y + 23, 16, 1);
      }
    }
    if (th > 1 && !item.tableSetting) {
      rect(g, 0x557459, x + w - 15, y + 13, 7, 9);
      rect(g, 0xe8cf86, x + w - 13, y + 15, 3, 3);
    }
  }
  if (item.label && kind !== 'parking') {
    const label = scene.add.text(x + w / 2, y + h + 3, item.label, {
    fontFamily: 'sans-serif', fontSize: '8px', color: '#f4efd5', backgroundColor: '#314a55', padding: { x: 3, y: 2 },
  }).setOrigin(0.5, 0).setResolution(1).setDepth(kind === 'calendar' ? ROWS * TILE + 18 : y + h + 4);
    if (kind === 'calendar' && openCalendar) label.setInteractive({ useHandCursor: true }).on('pointerup', openCalendar);
  }
}

export function drawOffice(scene: Phaser.Scene, roomId: RoomId = 'office', openCalendar?: () => void, openArcade?: (game: ArcadeGame) => void, openBoard?: (item: Furniture) => void): Phaser.GameObjects.GameObject[] {
  const before = new Set(scene.children.list);
  const room = getRoom(roomId);
  const windowColumns = roomWindowColumns(roomId);
  const floor = scene.add.graphics().setDepth(-100);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    rect(floor, (x + y) % 3 === 0 ? room.grain : room.floor, x * TILE, y * TILE, TILE, TILE);
    rect(floor, room.grain, x * TILE, y * TILE + 15, TILE, 1);
    rect(floor, room.grain, x * TILE + ((y % 2) * 8), y * TILE, 1, TILE);
    if ((x * 7 + y * 3) % 5 === 0) rect(floor, room.grain, x * TILE + 5, y * TILE + 6, 6, 1);
  }
  if (roomId === 'office') {
    rug(floor, 22 * TILE, 2 * TILE, 6 * TILE, 7 * TILE, 0xc3bf89);
    rug(floor, 12 * TILE, 3 * TILE, 6 * TILE, 5 * TILE, 0x9caf9b);
    rug(floor, 13 * TILE, 11 * TILE, 4 * TILE, 3 * TILE, room.rug);
    for (const x of [5, 6, 14, 15, 24, 25]) {
      rect(floor, 0xa77a51, x * TILE, 10 * TILE + 8, TILE, 3);
      rect(floor, 0xf3d49e, x * TILE, 10 * TILE + 8, TILE, 1);
    }
  } else {
    if (room.style === 'mech') {
      rect(floor, 0x354d63, TILE, TILE, 28 * TILE, 18 * TILE);
      for (let y = 2; y < 18; y++) for (let x = 2; x < 28; x++) {
        rect(floor, 0x526d7e, x * TILE, y * TILE, 15, 15);
        if ((x + y) % 4 === 0) rect(floor, 0x73909c, x * TILE + 3, y * TILE + 3, 2, 2);
      }
      for (const x of [9, 20]) { rect(floor, 0x8bc7bd, x * TILE + 7, 6 * TILE, 2, 11 * TILE); }
      rect(floor, 0x728e9b, 11 * TILE, 11 * TILE, 8 * TILE, 5 * TILE);
      for (let i = 0; i < 7; i++) rect(floor, 0xe0b96e, 12 * TILE + i * 12, 16 * TILE, 6, 3);
    } else if (room.style === 'control') {
      rug(floor, 9 * TILE, 6 * TILE, 12 * TILE, 10 * TILE, room.rug);
      for (const x of [9, 20]) for (let y = 2; y < 18; y += 2) rect(floor, 0xb5c3b3, x * TILE + 7, y * TILE + 3, 2, 8);
    } else if (room.sections) {
      for (const section of room.sections) rug(floor, (section.x + 1) * TILE, (section.y + 1) * TILE, (section.w - 2) * TILE, (section.h - 2) * TILE, section.color);
      for (let y = 1; y < ROWS - 1; y++) rect(floor, 0xe6dcb9, 14 * TILE, y * TILE, 2 * TILE, TILE);
      rect(floor, 0xe6dcb9, TILE, 9 * TILE, 28 * TILE, 2 * TILE);
    } else if (room.style !== 'grass') rug(floor, 9 * TILE, 5 * TILE, 12 * TILE, 9 * TILE, room.rug);
    for (let y = 1; y < ROWS - 1; y++) for (let x = 1; x < COLS - 1; x++) {
      if (room.style === 'checker' && (x + y) % 2 === 0) rect(floor, room.grain, x * TILE + 1, y * TILE + 1, 14, 14);
      if (room.style === 'grass') {
        if ((x * 5 + y * 7) % 8 === 0) { rect(floor, 0xe8dba3, x * TILE + 4, y * TILE + 5, 3, 3); rect(floor, 0x6e975a, x * TILE + 5, y * TILE + 8, 1, 3); }
        if (x === 15 || y === 15) rect(floor, room.rug, x * TILE, y * TILE, TILE, TILE);
      }
      if (room.style === 'stars' && (x * 7 + y * 3) % 9 === 0) { rect(floor, 0xe5d6a4, x * TILE + 7, y * TILE + 5, 1, 5); rect(floor, 0xe5d6a4, x * TILE + 5, y * TILE + 7, 5, 1); }
    }
  }
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!isWall(x, y, roomId)) continue;
    const g = scene.add.graphics().setDepth(y * TILE + TILE);
    rect(g, 0x795b42, x * TILE, y * TILE, TILE, TILE);
    rect(g, room.wall, x * TILE + 1, y * TILE, TILE - 2, 9);
    rect(g, 0xf9f0d0, x * TILE + 1, y * TILE, TILE - 2, 2);
    rect(g, 0xc2b28b, x * TILE + 1, y * TILE + 9, TILE - 2, 4);
    if (room.outlook === 'window' && y === 0 && windowColumns.includes(x)) {
      rect(g, 0x7b9b9b, x * TILE + 1, 2, 14, 10);
      rect(g, 0xb9d8c5, x * TILE + 2, 3, 12, 7);
      rect(g, 0xe8edd0, x * TILE + 3, 3, 2, 6);
    }
  }
  for (const section of room.sections ?? []) {
    const entry = section.entrance, x = entry.x * TILE, y = entry.y * TILE, width = entry.w * TILE;
    const threshold = scene.add.graphics().setDepth(-90);
    rect(threshold, 0x947b56, x, y + 5, width, 7); rect(threshold, section.color, x + 1, y + 6, width - 2, 4);
    const label = scene.add.text(x + width / 2, y - 3, section.name, {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#fff7df', backgroundColor: '#344d59', padding: { x: 7, y: 3 },
    }).setOrigin(0.5, 1).setResolution(2).setDepth(y + TILE);
    const sign = scene.add.graphics().setDepth(y + TILE - 1);
    rect(sign, 0x937b5c, label.x - label.width / 2 - 2, label.y - label.height - 2, label.width + 4, label.height + 4);
    rect(sign, section.color, label.x - label.width / 2, label.y - label.height, 3, label.height);
  }
  room.furniture.forEach((item) => drawFurniture(scene, item, openCalendar, openBoard));
  if (roomId === 'arcade') for (const id of ARCADE_IDS) {
    const game = ARCADE_GAMES[id], x = game.x * TILE, y = game.y * TILE;
    const screen = scene.add.graphics().setDepth(y + 48);
    const color = Number.parseInt(game.color.slice(1), 16);
    rect(screen, color, x + 2, y, 44, 5); rect(screen, 0x222e47, x + 9, y + 9, 30, 18);
    if (id === 'four') { for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) rect(screen, (row + col) % 3 ? color : 0x516780, x + 12 + col * 6, y + 11 + row * 5, 4, 3); }
    else if (id === 'reflex' || id === 'echo') { rect(screen, color, x + 19, y + 11, 12, 12); rect(screen, 0x222e47, x + 22, y + 14, 2, 2); rect(screen, 0x222e47, x + 27, y + 14, 2, 2); }
    else if (id === 'toast') { rect(screen, color, x + 16, y + 15, 18, 10); rect(screen, 0xefbf76, x + 21, y + 10, 8, 8); }
    else { for (let i = 0; i < 3; i++) rect(screen, color, x + 12 + i * 9, y + 19, 5, 7); rect(screen, 0xefbf76, x + 23, y + 11, 4, 4); }
    const label = scene.add.text(x + 24, y + 55, game.label, { fontFamily: 'monospace', fontSize: '7px', color: game.color, backgroundColor: '#30364c', padding: { x: 3, y: 2 } }).setOrigin(.5).setDepth(338);
    if (openArcade) label.setInteractive({ useHandCursor: true }).on('pointerup', () => openArcade(id));
  }
  const door = scene.add.graphics().setDepth(-90);
  rect(door, 0x526e65, room.door.x * TILE, room.door.y * TILE, TILE, TILE);
  rect(door, 0xebe3ba, room.door.x * TILE + 3, room.door.y * TILE + 3, 10, 10);
  rect(door, 0x526e65, room.door.x * TILE + 7, room.door.y * TILE + 4, 2, 8);
  rect(door, 0x526e65, room.door.x * TILE + 5, room.door.y * TILE + 6, 6, 2);
  return scene.children.list.filter((child) => !before.has(child));
}

export const OUTFITS = SHIRTS;
export function createAvatarTextures(scene: Phaser.Scene): void {
  avatarTexture(scene, DEFAULT_APPEARANCE, 'down', 0);
}
const textureKeys = new WeakMap<Phaser.Textures.TextureManager, Map<string, true>>();
export function avatarTexture(scene: Phaser.Scene, appearance: Appearance, direction: Direction, frame: number, pose: AvatarPose = 'stand'): string {
  const key = `person-${appearanceKey(appearance)}-${direction}-${frame}-${pose}`;
  let cache = textureKeys.get(scene.textures);
  if (!cache) { cache = new Map(); textureKeys.set(scene.textures, cache); }
  cache.delete(key); cache.set(key, true);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (const p of avatarPixels(appearance, direction, frame, pose)) rect(g, p.color, p.x, p.y, p.w, p.h);
    g.generateTexture(key, 20, 28); g.destroy();
  }
  if (cache.size > 2048) {
    const oldest = cache.keys().next().value!;
    scene.textures.remove(oldest); cache.delete(oldest);
  }
  return key;
}

export function drawRoomObject(scene: Phaser.Scene, object: RoomObject): Paint {
  const base = objectSize(object.kind), rotated = objectSize(object.kind, object.rotation);
  const g = scene.add.graphics().setPosition((object.x + rotated.w / 2) * TILE, (object.y + rotated.h / 2) * TILE).setDepth((object.y + rotated.h) * TILE);
  g.setRotation(object.rotation * Math.PI / 2);
  const p = (color: number, x: number, y: number, w: number, h: number) => rect(g, color, x - base.w * TILE / 2, y - base.h * TILE / 2, w, h);
  if (object.kind === 'monitor' || object.kind === 'rack') {
    const { w, h } = objectSize(object.kind);
    if (object.kind === 'monitor') monitor(p, w * TILE, h * TILE); else serverRack(p, w * TILE, h * TILE);
  } else if (object.kind === 'bookshelf') {
    const width = base.w * TILE;
    p(0x725039, 0, 0, width, 16); p(0xa87548, 2, 1, width - 4, 13);
    const colors = [0x799e8a, 0xc98162, 0xe6cb7e, 0x708f9c];
    for (let i = 4; i < width - 4; i += 5) {
      p(colors[(i - 4) / 5 % 4], i, 3, 3, 9); p(0xf0dfb7, i, 5, 3, 1);
    }
    p(0xdda96e, 0, 13, width, 3);
  } else if (object.kind === 'desk') {
    p(0x694d3c, 0, 2, 48, 27); p(0xb57f50, 2, 4, 44, 21); p(0xe5b574, 2, 4, 44, 3);
    p(0x76513a, 4, 25, 4, 7); p(0x76513a, 40, 25, 4, 7);
    p(0x3e4846, 15, 0, 18, 13); p(0x8bb6a6, 17, 2, 14, 8);
    p(0xd4edc3, 19, 4, 7, 1); p(0xd4edc3, 19, 6, 10, 1); p(0x424f49, 22, 13, 4, 3);
    p(0xe3dac0, 15, 19, 16, 4); p(0xf8edcf, 36, 14, 7, 7); p(0x7a5340, 37, 14, 5, 2);
  } else if (object.kind === 'chair') {
    p(0x424f49, 7, 10, 2, 5); p(0x424f49, 3, 14, 10, 2);
    p(0x476957, 2, 1, 12, 11); p(0x729481, 3, 2, 10, 4); p(0x9bb49a, 4, 2, 8, 1);
    p(0x88a48a, 4, 7, 8, 4); p(0x547365, 1, 6, 3, 6); p(0x547365, 12, 6, 3, 6);
  } else if (object.kind === 'plant' || object.kind === 'flowers') {
    p(0xb7815b, 4, 9, 8, 6); p(0xe2b17b, 3, 8, 10, 3); p(0x577c51, 7, 1, 2, 8);
    p(0x83a36b, 3, 3, 5, 5); p(0x608b5b, 8, 0, 5, 6);
    if (object.kind === 'flowers') { p(0xdca0a2, 2, 2, 4, 4); p(0xe9cb80, 9, 0, 4, 4); p(0xe4b7c7, 6, 4, 4, 4); }
  } else if (object.kind === 'books') {
    p(0x778f9a, 2, 10, 12, 4); p(0xeee3bc, 3, 11, 10, 1); p(0xc48a6e, 4, 6, 10, 4); p(0xf0dfb7, 5, 7, 8, 1); p(0x8da581, 2, 3, 10, 3);
  } else if (object.kind === 'lamp') {
    p(0x7a715c, 4, 13, 8, 2); p(0x7a715c, 7, 5, 2, 9); p(0xe6cc86, 3, 2, 10, 5); p(0xf7e5aa, 5, 0, 6, 3);
  } else if (object.kind === 'mug') {
    p(0xe8d9b5, 3, 5, 8, 8); p(0xbda584, 4, 5, 6, 2); p(0x795641, 5, 5, 4, 1); p(0xe8d9b5, 11, 7, 3, 4); p(0xbda584, 11, 8, 1, 2);
  } else if (object.kind === 'cushion') {
    p(0x987c8c, 2, 3, 12, 11); p(0xd0a9b7, 3, 3, 10, 8); p(0xe2c1c2, 5, 4, 5, 2); p(0xb1859a, 7, 7, 2, 2);
  } else if (object.kind === 'box') {
    p(0x8c6547, 2, 4, 12, 11); p(0xc49460, 3, 5, 10, 8); p(0xe0b77f, 3, 5, 10, 2); p(0x8c6547, 7, 5, 2, 8);
  } else {
    g.setDepth(-80); p(0xa17d69, 0, 0, 16, 16); p(0xe3c694, 1, 1, 14, 14); p(0xb9a780, 3, 3, 10, 10); p(0xe3c694, 6, 6, 4, 4);
  }
  return g;
}
