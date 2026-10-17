import type { Furniture } from './world.ts';
import type { Pixel } from './avatar.ts';
import { TILE } from './world.ts';
import { cockpitFurniturePixels } from './robot-art.ts';
type PixelRect = (color:number,x:number,y:number,w:number,h:number)=>void;
// Decorative tool terminals. Live metrics are viewed at the configured links.
export function monitor(p: PixelRect, w: number, h: number): void {
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

export function serverRack(p: PixelRect, w: number, h: number): void {
  p(0x293b46, 0, 0, w, h); p(0x72878a, 1, 1, w - 2, h - 2);
  p(0x344c57, 3, 3, w - 6, h - 6);
  for (let row = 5; row < h - 7; row += 7) {
    p(0x9cafa9, 5, row, w - 10, 5); p(0x45616c, 8, row + 1, w - 20, 3);
    p(0xb9c9bc, w - 11, row + 1, 2, 2); p(0x7b999f, w - 8, row + 1, 1, 2);
  }
  p(0x293b46, 3, h - 2, 6, 2); p(0x293b46, w - 9, h - 2, 6, 2);
}

// Shared with the live map and incident thumbnails: furniture has one drawing.
export function furniturePixels(item: Furniture): Pixel[] {
  const pixels: Pixel[]=[];
  const p:PixelRect=(color,x,y,w,h)=>{if(w>0&&h>0)pixels.push({color,x,y,w,h});};
  const outline=(color:number,x:number,y:number,w:number,h:number)=>{p(color,x,y,w,1);p(color,x,y+h-1,w,1);p(color,x,y,1,h);p(color,x+w-1,y,1,h);};
  const { x: tx, y: ty, w: tw, h: th, kind } = item;
  const x = tx * TILE, y = ty * TILE, w = tw * TILE, h = th * TILE;

  if (kind !== 'calendar' && kind !== 'board') p(0xb59b74, x + 2, y + h - 2, w, 4);
  if (['viewport', 'reactor', 'console', 'pilot'].includes(kind)) {
    for (const pixel of cockpitFurniturePixels(kind, w, h)) p(pixel.color, x + pixel.x, y + pixel.y, pixel.w, pixel.h);
  } else if (kind === 'calendar') {
    p(0x816d59, x, y + 1, w, h - 1); p(0xfff3d8, x + 2, y + 2, w - 4, h - 3);
    p(0xbb6559, x + 2, y + 2, w - 4, 4);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 7; col++) p(col === 0 ? 0xc06a5b : 0x84918b, x + 3 + col * 4, y + 8 + row * 4, 2, 2);
    p(0xe5b556, x + 19, y + 8, 3, 3);
    for (const hook of [7, w - 9]) { p(0x5c665c, x + hook, y, 2, 4); p(0xe9e0bd, x + hook, y + 1, 1, 2); }

  } else if (kind === 'parking') {
    p(0xa8b3a2, x, y, w, h); p(0xd7dcc3, x + 1, y + 1, w - 2, h - 2);
    p(0x789083, x, y, w, 2);
    for (let slot = 0; slot < 3; slot++) { p(0x8a998e, x + slot * 16 + 3, y + 3, 2, 10); p(0x8a998e, x + slot * 16 + 3, y + 12, 9, 2); }
  } else if (kind === 'vending') {
    p(0x557e87, x, y, w, h); p(0x8bb5b3, x + 2, y + 2, w - 4, h - 4);
    p(0xe9ecd2, x + 4, y + 4, w - 8, 7); p(0x557e87, x + 7, y + 6, w - 14, 2);
    p(0x344f5c, x + 4, y + 13, w - 12, 18);
    for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) {
      p([0xc9e6de, 0xe5c680, 0xd49b89][col], x + 6 + col * 5, y + 15 + row * 8, 3, 6);
      p(0xf0f1d4, x + 7 + col * 5, y + 14 + row * 8, 1, 2);
    }
    p(0xe2c97f, x + w - 7, y + 16, 3, 3); p(0x344f5c, x + 6, y + h - 11, w - 12, 6);
    p(0x567580, x + 2, y + h - 3, 5, 3); p(0x567580, x + w - 7, y + h - 3, 5, 3);
  } else if (kind === 'monitor' || kind === 'rack') {
    const local: PixelRect = (color, px, py, pw, ph) => p(color, x + px, y + py, pw, ph);
    if (kind === 'monitor') monitor(local, w, h); else serverRack(local, w, h);
  } else if (kind === 'desk' || kind === 'workbench') {
    p(0x694d3c, x, y, w, h - 4);
    p(0xb57f50, x + 2, y + 2, w - 4, h - 8);
    p(0xe5b574, x + 2, y + 2, w - 4, 3);
    p(0x76513a, x + 4, y + h - 8, 3, 6);
    p(0x76513a, x + w - 7, y + h - 8, 3, 6);
    if (kind === 'desk') {
    p(0x3e4846, x + 15, y - 1, 18, 12);
    p(0x8bb6a6, x + 17, y + 1, 14, 8);
    p(0xd4edc3, x + 19, y + 3, 7, 1);
    p(0xd4edc3, x + 19, y + 5, 10, 1);
    p(0x424f49, x + 22, y + 11, 4, 3);
    p(0xe3dac0, x + 15, y + 16, 16, 4);
    p(0xfbedd0, x + 37, y + 11, 5, 6);
    p(0x76604c, x + 38, y + 11, 3, 2);
    } else {
      p(0x7a6850, x + 8, y + 7, 3, 13);
      p(0x586a6b, x + 4, y + 5, 11, 4);
      p(0xc27f5a, x + 23, y + 13, 12, 3);
      p(0x688c7c, x + 26, y + 4, 3, 13);
      p(0xe1d5a8, x + w - 21, y + 6, 13, 12);
    }
    p(0x547365, x + 17, y + 27, 14, 5);
    p(0x729481, x + 18, y + 24, 12, 5);
  } else if (kind === 'plant') {
    p(0x946345, x + 4, y + 9, 9, 6);
    p(0xc78e5d, x + 3, y + 8, 11, 3);
    p(0x557043, x + 7, y - 2, 3, 12);
    p(0x476749, x + 1, y, 7, 6);
    p(0x6c9355, x + 8, y - 5, 6, 8);
    p(0x85a764, x + 4, y - 4, 5, 5);
    p(0x5c8250, x + 8, y + 3, 7, 4);
  } else if (kind === 'sofa') {
    p(0x476957, x, y, w, h - 1);
    p(0x73987a, x + 2, y + 2, w - 4, 10);
    p(0x8aab8b, x + 4, y + 3, w - 8, 2);
    for (let i = 6; i < w - 8; i += 18) {
      p(0x91ab87, x + i, y + 14, 16, 11);
      p(0xa4bb96, x + i, y + 14, 16, 2);
    }
    p(0x5a8067, x + 1, y + 11, 5, 17);
    p(0x5a8067, x + w - 6, y + 11, 5, 17);
    p(0xf2cf86, x + 8, y + 8, 8, 8);
    p(0xce916d, x + w - 18, y + 8, 8, 8);
  } else if (kind === 'shelf') {
    p(0x725039, x, y - 5, w, h + 5);
    p(0xa87548, x + 2, y - 3, w - 4, h);
    const colors = [0x799e8a, 0xc98162, 0xe6cb7e, 0x708f9c];
    for (let i = 4; i < w - 3; i += 5) p(colors[(i - 4) / 5 % 4], x + i, y, 3, 9);
    p(0xdda96e, x, y + h - 3, w, 3);
  } else if (kind === 'board') {
    // Raise the face while keeping the original footprint and saved link identity.
    const wall = item.boardMount === 'wall', top = y - 14, faceH = wall ? 27 : 28;
    const bottom = top + faceH, foot = y + h - 3;
    if (wall) {
      p(0xb8ae95, x + 2, top + 2, w, faceH + 2);
      for (const bx of [x + 7, x + w - 9]) p(0x626e70, bx, top - 1, 2, 5);
    } else {
      p(0xb7ab90, x + 6, foot + 2, w - 12, 3);
      for (const leg of [x + 9, x + w - 12]) {
        p(0x56666d, leg, bottom - 3, 3, foot - bottom + 4);
        p(0xb4c3c2, leg, bottom - 3, 1, foot - bottom + 3);
        p(0x829798, leg - 5, foot - 1, 13, 2);
        for (const wheel of [leg - 5, leg + 5]) { p(0x394b53, wheel, foot + 1, 3, 3); p(0x8c9b9a, wheel + 1, foot + 1, 1, 1); }
      }
      p(0x8b9d9d, x + 12, bottom + 8, w - 24, 2);
    }
    p(0x536b72, x, top, w, faceH);
    p(0xc5d2d0, x + 1, top + 1, w - 2, faceH - 2);
    p(0xfafcf1, x + 3, top + 3, w - 6, faceH - 6);
    p(0xffffff, x + 4, top + 3, w - 8, 2);
    // Small marker notes and a flow diagram, on a vertical white writing surface.
    p(0x4d858c, x + 8, top + 7, Math.min(23, w - 36), 2);
    for (let row = 0; row < 2; row++) {
      p(0x839b9d, x + 8, top + 13 + row * 5, 2, 2);
      p(0x839b9d, x + 13, top + 13 + row * 5, row ? 13 : 18, 1);
    }
    const diagram = x + w - 25;
    outline(0x639b9a, diagram, top + 8, 13, 6);
    p(0x639b9a, diagram + 6, top + 15, 1, 3);
    p(0x639b9a, diagram + 4, top + 17, 5, 1);
    outline(0xc48479, diagram + 2, top + 19, 9, 3);
    p(0x82999c, x + 3, bottom - 2, w - 6, 3);
    p(0xd6dfd9, x + 4, bottom - 2, w - 8, 1);
    for (const [offset, color] of [[8, 0x477d99], [16, 0xc86e63], [24, 0x4b6969]]) {
      p(color, x + offset, bottom - 3, 6, 1); p(0x394f59, x + offset, bottom - 3, 1, 1);
    }
    p(0x647b84, x + w - 16, bottom - 4, 8, 2);

  } else if (kind === 'buffet' || kind === 'dishreturn') {
    p(0x536e70, x, y + 10, w, h - 10); p(0xa3bbb3, x + 2, y + 12, w - 4, h - 15);
    p(0xd9e3d3, x, y + 9, w, 4); p(0xf7f1d7, x + 2, y + 9, w - 4, 1);
    for (let i = 6; i < w - 6; i += 26) { p(0x78988e, x + i, y + 26, 22, 14); p(0xc9d7c2, x + i + 17, y + 30, 2, 6); }
    p(0x435e63, x + 4, y + h - 3, w - 8, 3);
    if (kind === 'buffet') {
      for (let i = 8; i < w - 47; i += 27) {
        p(0x738e8d, x + i, y + 14, 23, 10); p(0xf0e8c9, x + i + 2, y + 15, 19, 7);
        p(0x9da75a, x + i + 4, y + 17, 6, 4); p(0xc68c55, x + i + 11, y + 16, 7, 4);
        p(0xcce1d6, x + i + 5, y + 2, 1, 5); p(0xcce1d6, x + i + 8, y, 1, 4);
      }
      // Rice cooker, stacked bowls and a glass sneeze guard.
      p(0x536b70, x + w - 34, y + 12, 22, 13); p(0xe9e8d1, x + w - 33, y + 9, 20, 11);
      p(0xfaf3d9, x + w - 35, y + 8, 24, 3); p(0x536b70, x + w - 26, y + 6, 6, 2);
      p(0xcb8d60, x + w - 25, y + 15, 4, 2);
      for (const post of [3, w - 6]) p(0x759294, x + post, y, 2, 27);
      p(0xa7c6c0, x + 3, y, w - 6, 2); p(0xd5e5d1, x + 6, y + 3, w - 12, 1);
    } else {
      p(0x334e56, x + 6, y + 15, w - 12, 13);
      for (let i = 9; i < w - 13; i += 18) for (let row = 0; row < 3; row++) {
        p(0xc6d7ce, x + i, y + 19 - row * 3, 15, 2); p(0xf5edcf, x + i + 2, y + 18 - row * 3, 11, 1);
      }
      p(0x8ca59b, x + 7, y + 32, w - 14, 5);
    }
  } else if (kind === 'counter') {
    p(0x8b654a, x, y, w, h); p(0xe5c394, x, y, w, 8);
    p(0x455759, x + 10, y - 6, 21, 14); p(0xa7bfb4, x + 12, y - 4, 13, 7);
    for (let i = 42; i < w - 9; i += 17) { p(0xf8edcf, x + i, y + 2, 7, 7); p(0x7a5340, x + i + 1, y + 2, 5, 2); }
    for (let i = 8; i < w - 6; i += 24) p(0xad825b, x + i, y + 13, 17, 15);
  } else if (kind === 'pond') {
    p(0x879b83, x, y, w, h); p(0x72a7ad, x + 3, y + 3, w - 6, h - 6);
    for (let i = 9; i < w - 8; i += 19) { p(0xb1d5cc, x + i, y + 16 + i % 3 * 12, 13, 1); }
    p(0x6e9367, x + 12, y + 12, 12, 6); p(0xdfc3ba, x + 16, y + 10, 4, 4);
    p(0x6e9367, x + w - 29, y + h - 23, 14, 6);
  } else if (kind === 'easel') {
    p(0x94714f, x + 6, y + 3, 4, h - 3); p(0x94714f, x + w - 10, y + 3, 4, h - 3);
    p(0xf5e8cd, x + 2, y, w - 4, h - 9); p(0xb3c19a, x + 5, y + 4, w - 10, h - 17);
    p(0xd99c83, x + 7, y + 10, 11, 14); p(0x829db3, x + 18, y + 5, 17, 17);
    p(0xd9bb79, x + 26, y + 22, 10, 8); p(0x8e6a45, x, y + h - 10, w, 3);
  } else if (kind === 'arcade') {
    p(0x383b53, x + 3, y, w - 6, h); p(0xc290b5, x + 2, y, w - 4, 5);
    p(0x9cbfc5, x + 7, y + 7, w - 14, 22); p(0x40556b, x + 9, y + 9, w - 18, 18);
    p(0xdbc07d, x + 15, y + 16, 5, 5); p(0xa7c598, x + 27, y + 20, 7, 3);
    p(0x8d769f, x + 3, y + 31, w - 6, 8); p(0x2b3543, x + 11, y + 30, 3, 6);
    p(0xdca28e, x + 28, y + 33, 4, 3); p(0x242c3b, x + 17, y + h - 7, 12, 3);
  } else if (kind === 'bed') {
    p(0x8b765f, x, y, w, h); p(0xf2e8cf, x + 3, y + 3, w - 6, h - 6);
    p(0xfcf7e3, x + 9, y + 6, w - 18, 12); p(0xa1b7ad, x + 3, y + 22, w - 6, h - 25);
    p(0xc2d0bf, x + 3, y + 22, w - 6, 5);
  } else if (kind === 'telescope') {
    p(0x8798ab, x + 20, y + 17, 4, h - 17);
    p(0x8798ab, x + 12, y + h - 4, 21, 3);
    p(0xdfdcbf, x + 5, y + 10, 31, 10); p(0xa4bbca, x + 3, y + 8, 7, 14);
    p(0x36465f, x + 3, y + 10, 3, 10); p(0xdfdcbf, x + 32, y + 13, 7, 5);
  } else {
    if (th > 1) {
      for (let i = 5; i < w - 4; i += 18) {
        p(0x648279, x + i, y - 5, 12, 9);
        p(0x648279, x + i, y + h - 4, 12, 9);
      }
    }
    p(0x80563d, x, y + 2, w, h - 2);
    p(0xc18a52, x + 2, y, w - 4, h - 5);
    p(0xe0b577, x + 3, y + 1, w - 6, 3);
    p(0xf4e7bc, x + 8, y + 8, 10, 7);
    p(0x8ba5a0, x + 10, y + 10, 5, 1);
    if (item.tableSetting === 'meal') {
      // Two little lunch trays; the existing table chairs remain usable.
      for (const offset of [12, w - 31]) {
        p(0x637f7b, x + offset, y + 7, 21, 13); p(0xb4be8a, x + offset + 1, y + 8, 19, 11);
        p(0xf9efd2, x + offset + 3, y + 10, 7, 6); p(0xdab883, x + offset + 4, y + 14, 5, 2);
        p(0xc58d5c, x + offset + 12, y + 10, 6, 4); p(0x729255, x + offset + 12, y + 15, 3, 2);
        p(0x704d3b, x + offset + 4, y + 21, 16, 1); p(0x704d3b, x + offset + 4, y + 23, 16, 1);
      }
    }
    if (th > 1 && !item.tableSetting) {
      p(0x557459, x + w - 15, y + 13, 7, 9);
      p(0xe8cf86, x + w - 13, y + 15, 3, 3);
    }
  }
  return pixels;
}
