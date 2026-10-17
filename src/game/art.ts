import Phaser from 'phaser';
import { COLS, ROWS, TILE, isWall } from './world.ts';
import type { Direction, Furniture } from './world.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { avatarPixels, appearanceKey, DEFAULT_APPEARANCE, SHIRTS } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import type { RoomObject } from './objects.ts';
import { objectSize } from './objects.ts';

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
  if (kind === 'desk' || kind === 'workbench') {
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
    rect(g, 0x6a756b, x, y, w, h); rect(g, 0xf3f0dc, x + 2, y + 2, w - 4, h - 5);
    for (let i = 6; i < w - 10; i += 16) { rect(g, 0x779d98, x + i, y + 7, 9, 2); rect(g, 0xc39a6a, x + i + 3, y + 13, 5, 3); }
    rect(g, 0x8b7461, x + 5, y + h - 2, w - 10, 3);
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
    if (th > 1) {
      rect(g, 0x557459, x + w - 15, y + 13, 7, 9);
      rect(g, 0xe8cf86, x + w - 13, y + 15, 3, 3);
    }
  }
}

export function drawOffice(scene: Phaser.Scene, roomId: RoomId = 'office'): Phaser.GameObjects.GameObject[] {
  const before = new Set(scene.children.list);
  const room = getRoom(roomId);
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
    if (room.style !== 'grass') rug(floor, 9 * TILE, 5 * TILE, 12 * TILE, 9 * TILE, room.rug);
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
    if (y === 0 && [3, 4, 7, 8, 14, 15, 24, 25].includes(x)) {
      rect(g, 0x7b9b9b, x * TILE + 1, 2, 14, 10);
      rect(g, 0xb9d8c5, x * TILE + 2, 3, 12, 7);
      rect(g, 0xe8edd0, x * TILE + 3, 3, 2, 6);
    }
  }
  room.furniture.forEach((item) => drawFurniture(scene, item));
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
export function avatarTexture(scene: Phaser.Scene, appearance: Appearance, direction: Direction, frame: number): string {
  const key = `person-${appearanceKey(appearance)}-${direction}-${frame}`;
  let cache = textureKeys.get(scene.textures);
  if (!cache) { cache = new Map(); textureKeys.set(scene.textures, cache); }
  cache.delete(key); cache.set(key, true);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (const p of avatarPixels(appearance, direction, frame)) rect(g, p.color, p.x, p.y, p.w, p.h);
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
  if (object.kind === 'desk') {
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
