import type { Pixel } from './avatar.ts';
import type { RobotAction } from './robot.ts';
// A 128 x 144 sprite, shared by the hologram, control dialog and tests.
export function robotPixels(action: RobotAction | null, elapsed: number, reduced = false, selected = ''): Pixel[] {
  const out: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => out.push({ color, x: Math.round(x), y: Math.round(y), w, h });
  const t = Math.max(0, elapsed), phase = t / 1000, wave = reduced ? 0 : Math.sin(phase * Math.PI * 2);
  const metal = 0xc8d5d3, dark = 0x344c61, blue = 0x507fa5, red = 0xc77b6f, gold = 0xe9bd72;
  const color = (part: string, base: number) => selected === part ? 0xf4d98f : base;
  // Head: crown, helmet, eye band, antennae.
  p(dark, 47, 13, 34, 28); p(color('head', metal), 49, 10, 30, 28); p(gold, 59, 3, 10, 10);
  p(gold, 36, 5, 17, 4); p(gold, 75, 5, 17, 4); p(gold, 36, 5, 4, 14); p(gold, 88, 5, 4, 14);
  p(dark, 49, 21, 30, 7); p(0xa1e2d7, 52, 22, 24, 3); p(red, 60, 30, 8, 9); p(dark, 57, 39, 14, 5);
  // Chest and core.
  p(dark, 36, 43, 56, 45); p(color('body', blue), 40, 42, 48, 40); p(metal, 43, 44, 42, 6);
  p(dark, 51, 52, 26, 24); p(action === 'boot' ? gold : 0x80c6bb, 55, 55, 18, 17); p(0xe8e6b8, 60, 58, 8, 10);
  p(gold, 42, 75, 44, 5); p(dark, 43, 83, 42, 13); p(metal, 48, 86, 32, 6);
  const posed = action === 'pose', waving = action === 'wave';
  const leftY = posed ? 29 : 48, rightY = posed || waving ? 27 : 48;
  p(dark, 17, leftY - 2, 22, 22); p(color('leftarm', red), 19, leftY, 18, 18); p(gold, 22, leftY + 2, 12, 3);
  if (!posed) { p(metal, 20, leftY + 20, 14, 14); p(dark, 18, leftY + 33, 18, 17); p(color('leftarm', metal), 21, leftY + 35, 13, 10); }
  p(dark, 89, rightY - 2, 22, 22); p(color('rightarm', red), 91, rightY, 18, 18); p(gold, 94, rightY + 2, 12, 3);
  const handShift = waving ? Math.round(wave * 3) : 0;
  if (waving || posed) {
    p(metal, 102 + handShift, 12, 13, 18); p(color('rightarm', metal), 101 + handShift, 3, 16, 13);
    p(dark, 103 + handShift, 7, 2, 6); p(dark, 109 + handShift, 7, 2, 6);
    if (posed) { p(metal, 13, 15, 13, 20); p(metal, 11, 4, 17, 14); }
  } else if (action === 'punch') {
    p(metal, 102, 67, 10, 8);
    const flight = reduced ? 9 : Math.round(Math.sin(Math.min(1, t / 6500) * Math.PI) * 13);
    p(gold, 110 + flight, 71, 4, 4); p(color('rightarm', metal), 107 + flight, 65, 8, 17);
  } else { p(metal, 94, 68, 14, 14); p(dark, 92, 81, 18, 17); p(color('rightarm', metal), 94, 83, 14, 10); }
  // Legs alternate only in the walking test; shoulders and feet remain within the sprite.
  for (const [x, part, sign] of [[43, 'leftleg', 1], [68, 'rightleg', -1]] as const) {
    const lift = action === 'walk' && !reduced ? Math.max(0, wave * sign) * 5 : 0;
    p(dark, x - 2, 95 - lift, 23, 30); p(color(part, metal), x, 95 - lift, 19, 27); p(blue, x + 3, 99 - lift, 13, 8);
    p(dark, x - 4, 122 - lift, 28, 16); p(color(part, blue), x - 2, 123 - lift, 24, 11); p(gold, x - 2, 135 - lift, 24, 3);
  }
  if (action === 'barrier') {
    for (const [x, y, w, h] of [[5, 32, 2, 80], [121, 32, 2, 80], [14, 19, 2, 15], [112, 19, 2, 15], [14, 111, 2, 15], [112, 111, 2, 15], [25, 13, 77, 2], [25, 132, 77, 2]]) p(0x9cdbdc, x, y, w, h);
  }
  return out;
}
export function cockpitFurniturePixels(kind: string, w: number, h: number): Pixel[] {
  const out: Pixel[] = [], p = (color: number, x: number, y: number, width: number, height: number) => out.push({ color, x, y, w: width, h: height });
  const ink = 0x263f54, metal = 0xadc0c4;
  if (kind === 'viewport' || kind === 'reactor') {
    p(ink, 0, 0, w, h); p(metal, 2, 2, w - 4, h - 4); p(0x1c354a, 5, 5, w - 10, h - 10);
    for (const x of [2, w - 5]) for (const y of [2, h - 5]) p(0xe9bf78, x, y, 3, 3);
    p(0x7db6bd, 9, h - 4, w - 18, 1);
  } else if (kind === 'console') {
    p(ink, 0, 2, w, h - 2); p(0x94aeb8, 1, 1, w - 2, h - 5); p(metal, 2, 0, w - 4, 4);
    p(0x294b65, 6, 6, Math.floor(w * 0.48), h - 16); p(0x86d2c4, 9, 9, Math.floor(w * 0.4), 2);
    for (let i = 0; i < 5; i++) p([0xd7897a, 0xe9bf78, 0x9fd4be][i % 3], w - 32 + i * 5, 9, 3, 3);
    p(ink, w - 22, 15, 3, 8); p(0xd7897a, w - 24, 14, 7, 3);
    for (let i = 0; i < 8; i++) p(0x4e697c, 9 + i * 7, h - 9, 5, 3);
  } else if (kind === 'pilot') {
    p(ink, 6, 0, w - 12, h - 2); p(0xc4d2ce, 7, 1, w - 14, 11); p(0x7797aa, 8, 13, w - 16, h - 15);
    p(0xd58679, 10, 4, w - 20, 6); p(ink, 2, 14, 5, 12); p(ink, w - 7, 14, 5, 12);
    p(0xe6be78, 3, 17, 3, 4); p(0xe6be78, w - 6, 17, 3, 4); p(0x4e697c, 10, h - 4, w - 20, 4);
  }
  return out;
}
export function cockpitHorizonPixels(action: RobotAction | null, elapsed: number, w = 182, h = 70, reduced = false): Pixel[] {
  const out: Pixel[] = [], p = (color: number, x: number, y: number, width: number, height: number) => out.push({ color, x: Math.round(x), y: Math.round(y), w: width, h: height });
  p(0x35586d, 0, 0, w, h); p(0x7398a4, 0, 0, w, Math.floor(h * 0.52)); p(0x4c7f94, 0, Math.floor(h * 0.52), w, Math.ceil(h * 0.48));
  const step = action === 'walk' && !reduced ? Math.floor(elapsed / 150) % 14 : 0;
  for (let i = 0; i < 14; i++) { const x = (i * 15 + step) % (w - 13), height = 9 + i * 7 % 17; p(0x496b7e, x, Math.floor(h * 0.62) - height, 12, height); p(0x95b6bc, x + 2, Math.floor(h * 0.62) - height + 3, 2, 3); }
  p(0xc8d4bc, 14, 12, 24, 2); p(0xc8d4bc, w - 49, 8, 31, 2);
  for (let i = 0; i < 7; i++) p(0xa8c6c3, 5 + i * 25, h - 7 - i % 3 * 4, 15, 1);
  // Reticle, horizon and side brackets are part of a training camera feed.
  p(0xe4e6c1, w / 2 - 6, h / 2, 12, 1); p(0xe4e6c1, w / 2, h / 2 - 5, 1, 11);
  for (const x of [3, w - 4]) p(0x8bd4c5, x, 8, 1, h - 16);
  if (action === 'punch') { const t = reduced ? 0.65 : Math.min(1, elapsed / 6500), x = Math.round(16 + Math.sin(t * Math.PI) * (w - 49)); p(0xf0c784, x - 9, 28, 10, 3); p(0xc9d8d3, x, 22, 18, 14); p(0x3c596c, x + 4, 24, 2, 8); p(0x3c596c, x + 10, 24, 2, 8); }
  if (action === 'barrier') for (let x = 15; x < w - 12; x += 18) { p(0x9bd5d5, x, 6, 1, h - 12); p(0x9bd5d5, x - 5, 18, 11, 1); p(0x9bd5d5, x - 5, h - 19, 11, 1); }
  if (action === 'boot' || action === 'pose') for (let i = 0; i < 5; i++) p(0xf2d492, 24 + i * 27, 8 + i % 2 * 14, 3, 3);
  return out;
}
