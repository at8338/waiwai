import { laptopPixels, LAPTOP_WIDTH, LAPTOP_HEIGHT } from './laptop-art.ts';
import { ARCADE_GAMES, ARCADE_IDS } from './arcade.ts';
import type { ArcadeGame } from './arcade.ts';
import { furniturePixels, monitor, serverRack } from './furniture-art.ts';
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
  const { x:tx,y:ty,w:tw,h:th,kind }=item;
  const x=tx*TILE,y=ty*TILE,w=tw*TILE,h=th*TILE;
  const g=scene.add.graphics().setDepth(y+h);
  for(const pixel of furniturePixels(item))rect(g,pixel.color,pixel.x,pixel.y,pixel.w,pixel.h);
  if(kind==='calendar'&&openCalendar)g.setInteractive(new Phaser.Geom.Rectangle(x,y,w,h),Phaser.Geom.Rectangle.Contains).on('pointerup',openCalendar);
  if(kind==='board'&&openBoard)g.setInteractive(new Phaser.Geom.Rectangle(x,y-14,w,h+14),Phaser.Geom.Rectangle.Contains).on('pointerup',()=>openBoard(item));
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
  if (roomId !== 'arena') {
    const door = scene.add.graphics().setDepth(-90);
    rect(door, 0x526e65, room.door.x * TILE, room.door.y * TILE, TILE, TILE);
    rect(door, 0xebe3ba, room.door.x * TILE + 3, room.door.y * TILE + 3, 10, 10);
    rect(door, 0x526e65, room.door.x * TILE + 7, room.door.y * TILE + 4, 2, 8);
    rect(door, 0x526e65, room.door.x * TILE + 5, room.door.y * TILE + 6, 6, 2);
  }
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
    g.generateTexture(key, pose === 'lie' ? 32 : 20, 28); g.destroy();
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

export function laptopTexture(scene: Phaser.Scene): string {
  const key = 'reaction-laptop';
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (const pixel of laptopPixels()) rect(g, pixel.color, pixel.x, pixel.y, pixel.w, pixel.h);
    g.generateTexture(key, LAPTOP_WIDTH, LAPTOP_HEIGHT); g.destroy();
  }
  return key;
}
