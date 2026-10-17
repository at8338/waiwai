import type { Pixel } from './avatar.ts';
export const LOST_ITEM_ARTS = ['glove', 'stone', 'box', 'duck', 'key', 'acorn', 'plane', 'envelope', 'screw', 'banana', 'ball', 'bell', 'book', 'bottle', 'bug', 'camera', 'chair', 'clip', 'clock', 'cloud', 'coin', 'cup', 'feather', 'fish', 'flag', 'hat', 'magnet', 'map', 'pencil', 'plant', 'robot', 'shoe', 'sock', 'spoon', 'star', 'thermometer', 'ticket', 'toast', 'train', 'umbrella'] as const;
export type LostItemArt = typeof LOST_ITEM_ARTS[number];
export function lostItemArt(kind: LostItemArt, variant = 0): Pixel[] {
  const pixels: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => pixels.push({ color, x, y, w, h });
  if (kind === 'duck') {
    p(0xdbb85d, 3, 7, 9, 6); p(0xf2d572, 2, 6, 9, 6); p(0xf2d572, 8, 2, 5, 6); p(0xe39454, 12, 5, 3, 2); p(0x3e4845, 11, 4, 1, 1);
  } else if (kind === 'glove') {
    p(0x879ea9, 4, 6, 8, 7); p(0xe8e8d9, 5, 3, 2, 8); p(0xe8e8d9, 8, 2, 2, 9); p(0xe8e8d9, 11, 4, 2, 7); p(0xe8e8d9, 2, 7, 3, 4); p(0x6a858b, 5, 12, 7, 2);
  } else if (kind === 'stone') {
    p(0x778387, 3, 6, 10, 7); p(0xa5b0a7, 5, 4, 6, 7); p(0xe3d9b5, 4, 7, 8, 3); p(0x667970, 5, 8, 6, 1);
  } else if (kind === 'box') {
    p(0xa78358, 3, 5, 10, 9); p(0xd8b679, 3, 4, 10, 3); p(0xf0e3b9, 7, 4, 2, 10); p(0x779c86, 4, 8, 2, 3);
  } else if (kind === 'key') {
    p(0x617478, 3, 5, 10, 8); p(0xdfe3d1, 4, 4, 8, 7); p(0x607e82, 7, 6, 3, 3); p(0xdfe3d1, 7, 6, 2, 2); p(0x607e82, 6, 8, 4, 1);
  } else if (kind === 'acorn') {
    p(0xae794b, 5, 6, 6, 7); p(0xce9c5f, 6, 8, 4, 4); p(0x72563c, 4, 5, 8, 4); p(0x72563c, 8, 2, 2, 4); p(0xe9d9ae, 6, 6, 4, 2);
  } else if (kind === 'plane') {
    for (let i = 0; i < 10; i++) p(i % 2 ? 0xe8e8d4 : 0xc2d4cd, 2 + i, 12 - i, 2, i + 1);
    p(0x7c9d9d, 6, 10, 6, 1);
  } else if (kind === 'envelope') {
    p(0xb8996a, 2, 6, 12, 7); p(0xf0e3b9, 2, 5, 12, 6); p(0xc6b08a, 4, 6, 8, 2); p(0xc6b08a, 6, 8, 4, 2); p(0x83a28d, 11, 6, 2, 2);
  } else if (kind === 'screw') {
    p(0x718a91, 6, 6, 4, 8); p(0xb8c8bd, 4, 3, 8, 5); p(0x61757e, 5, 5, 6, 1); p(0xb8c8bd, 5, 9, 6, 1); p(0xb8c8bd, 5, 12, 6, 1);
  } else if (kind === 'banana') {
    p(0xd0a34f, 4, 3, 3, 9); p(0xf0d77d, 6, 7, 6, 6); p(0xe9c667, 9, 5, 4, 7); p(0x8d7250, 11, 3, 2, 3); p(0xe5a08a, 3, 5, 4, 3);
  } else if (kind === 'book') {
    p(0x697e9d, 3, 2, 11, 12); p(0xece2c4, 5, 3, 8, 9); p(0xb99a70, 3, 2, 2, 12); p(0x8a9b91, 7, 5, 4, 1); p(0x8a9b91, 7, 8, 3, 1);
  } else if (kind === 'clock') {
    p(0x8c7699, 3, 3, 10, 10); p(0xf2e6c3, 4, 4, 8, 8); p(0x536e78, 7, 5, 1, 4); p(0x536e78, 7, 8, 4, 1); p(0x8c7699, 4, 13, 2, 2); p(0x8c7699, 10, 13, 2, 2);
  } else if (kind === 'cup') {
    p(0x91b3a0, 3, 5, 9, 8); p(0xd8d6b5, 4, 4, 7, 2); p(0x91b3a0, 12, 6, 3, 5); p(0xe7e3cb, 12, 7, 2, 3); p(0xc0cdb4, 4, 6, 2, 5);
  } else if (kind === 'sock') {
    p(0xa3b8c1, 7, 2, 5, 9); p(0xa3b8c1, 3, 9, 9, 5); p(0xd9a28f, 7, 3, 5, 2); p(0xe6dcc0, 3, 10, 3, 4);
  } else if (kind === 'umbrella') {
    p(0xa0bcc2, 2, 5, 12, 4); p(0xa0bcc2, 4, 3, 8, 3); p(0x7a698a, 7, 2, 2, 7); p(0x8f7151, 7, 9, 1, 5); p(0x8f7151, 5, 13, 3, 2);
  } else if (kind === 'fish') {
    p(0x93b7c3, 3, 5, 9, 7); p(0x748fa4, 11, 4, 3, 9); p(0xeee4c3, 2, 7, 3, 3); p(0x354e62, 4, 6, 1, 1); p(0xccb889, 7, 8, 3, 3);
  } else if (kind === 'ticket') {
    p(0xe1c393, 2, 4, 12, 8); p(0x9cae9f, 4, 6, 6, 1); p(0x9cae9f, 4, 9, 4, 1); p(0xf7e8c8, 11, 5, 1, 6);
  } else if (kind === 'plant') {
    p(0xb78b69, 5, 10, 7, 5); p(0x917052, 4, 10, 9, 2); p(0x6a936f, 7, 3, 2, 8); p(0x90b68a, 3, 3, 5, 4); p(0x6a936f, 9, 2, 4, 4);
  } else if (kind === 'hat') {
    p(0xc4a676, 2, 10, 13, 3); p(0xc4a676, 5, 3, 7, 8); p(0x8a7696, 5, 8, 7, 2); p(0xe9d7ae, 6, 3, 5, 2);
  } else if (kind === 'bottle') {
    p(0x799eac, 5, 5, 6, 10); p(0xb5cbbd, 6, 2, 4, 4); p(0x647c91, 6, 1, 4, 2); p(0xe4d4a9, 5, 8, 6, 4); p(0xb2c9c4, 6, 6, 1, 2);
  } else if (kind === 'toast') {
    p(0xcfa66b, 3, 3, 10, 11); p(0xe8ca8c, 4, 4, 8, 9); p(0xe8ca8c, 5, 2, 6, 3); p(0xf4dfab, 5, 5, 6, 6); p(0xbca16e, 6, 7, 1, 1);
  } else if (kind === 'star') {
    p(0xe9ce84, 6, 2, 4, 12); p(0xe9ce84, 2, 6, 12, 4); p(0xe9ce84, 4, 4, 8, 8); p(0xf8e6ab, 6, 4, 2, 5);
  } else if (kind === 'cloud') {
    p(0xb4c6cc, 2, 7, 12, 6); p(0xd8dfd4, 4, 4, 7, 7); p(0xd8dfd4, 8, 6, 6, 5); p(0x8fa5b7, 5, 13, 1, 2); p(0x8fa5b7, 10, 13, 1, 2);
  } else if (kind === 'robot') {
    p(0x7c98ab, 4, 4, 9, 7); p(0xb5c9bc, 6, 2, 5, 2); p(0xd6dfa8, 5, 6, 2, 2); p(0xd6dfa8, 10, 6, 2, 2); p(0x92adb7, 5, 11, 7, 3); p(0x536a78, 5, 14, 2, 1); p(0x536a78, 10, 14, 2, 1);
  } else if (kind === 'magnet') {
    p(0xa07783, 3, 3, 3, 9); p(0xa07783, 10, 3, 3, 9); p(0xa07783, 5, 10, 6, 4); p(0xc1cdd0, 3, 3, 3, 3); p(0xc1cdd0, 10, 3, 3, 3);
  } else if (kind === 'coin') {
    p(0xb19662, 3, 4, 10, 8); p(0xe6cd87, 4, 3, 8, 10); p(0xb19662, 6, 6, 4, 4); p(0xf4dfab, 5, 4, 2, 3);
  } else if (kind === 'bell') {
    p(0xb79a66, 3, 10, 11, 3); p(0xe4c987, 5, 5, 7, 6); p(0xe4c987, 7, 3, 3, 3); p(0x7f775d, 7, 13, 3, 2); p(0xf6e2ae, 6, 6, 2, 4);
  } else if (kind === 'shoe') {
    p(0x8c7289, 2, 8, 12, 5); p(0x8c7289, 3, 4, 5, 6); p(0xd6c8a7, 2, 12, 12, 2); p(0xe1d9bb, 7, 8, 3, 1); p(0xe1d9bb, 8, 10, 3, 1);
  } else if (kind === 'pencil') {
    for (let i = 0; i < 10; i++) p(0xd9ba74, 3 + i, 12 - i, 2, 2); p(0x685d59, 12, 2, 2, 2); p(0xc28f93, 2, 12, 3, 2);
  } else if (kind === 'clip') {
    p(0x8ba5b0, 4, 3, 8, 2); p(0x8ba5b0, 4, 4, 2, 9); p(0x8ba5b0, 10, 4, 2, 9); p(0x8ba5b0, 5, 12, 6, 2); p(0xbfd0c9, 7, 6, 2, 5);
  } else if (kind === 'ball') {
    p(0x9bb7a2, 3, 5, 10, 7); p(0x9bb7a2, 5, 3, 6, 11); p(0xe8dba4, 7, 4, 2, 9); p(0xe8dba4, 4, 8, 8, 2);
  } else if (kind === 'flag') {
    p(0x8f795b, 3, 2, 2, 13); p(0xa4bbb4, 5, 3, 9, 6); p(0xd7dfbe, 6, 4, 6, 2); p(0x8f795b, 2, 14, 6, 1);
  } else if (kind === 'thermometer') {
    p(0xd0d6c4, 6, 2, 4, 11); p(0xc48a84, 7, 5, 2, 8); p(0xc48a84, 5, 11, 6, 4); p(0x899a9d, 10, 3, 2, 1); p(0x899a9d, 10, 6, 2, 1);
  } else if (kind === 'spoon') {
    p(0x9fb9bf, 5, 2, 6, 6); p(0xd1ded2, 6, 3, 4, 4); p(0x9fb9bf, 7, 7, 2, 8);
  } else if (kind === 'chair') {
    p(0x7b9c8a, 4, 2, 8, 7); p(0x9cba9d, 3, 9, 10, 3); p(0x7c6c5b, 4, 12, 2, 3); p(0x7c6c5b, 10, 12, 2, 3);
  } else if (kind === 'train') {
    p(0x88a3a5, 2, 5, 12, 8); p(0xd7ca98, 3, 4, 10, 2); p(0xdce7d2, 3, 7, 3, 3); p(0xdce7d2, 8, 7, 3, 3); p(0x526277, 4, 13, 3, 2); p(0x526277, 10, 13, 3, 2);
  } else if (kind === 'map') {
    p(0xdbd2b3, 2, 3, 4, 10); p(0xbdc5a7, 6, 4, 4, 10); p(0xdbd2b3, 10, 3, 4, 10); p(0x91ab9c, 3, 7, 9, 2); p(0xb9827d, 9, 6, 2, 3);
  } else if (kind === 'feather') {
    p(0x9aafbc, 6, 2, 5, 8); p(0xcbd6c6, 5, 4, 5, 8); p(0x788d99, 7, 7, 1, 8); p(0xe2dfc8, 6, 6, 3, 1);
  } else if (kind === 'bug') {
    p(0x759b83, 5, 5, 6, 8); p(0xa8c1a1, 6, 3, 4, 4); p(0x4a6d70, 7, 6, 1, 6); for (const y of [6, 9, 12]) { p(0x6b8274, 3, y, 2, 1); p(0x6b8274, 11, y, 2, 1); }
  } else if (kind === 'camera') {
    p(0x77889e, 2, 5, 12, 8); p(0xb4c4be, 4, 3, 5, 3); p(0xb4c4be, 6, 6, 6, 6); p(0x405b73, 7, 7, 4, 4); p(0xe2d4a8, 3, 6, 2, 2);
  } else {
    const unreachable: never = kind; throw new Error(`Unknown lost item art: ${unreachable}`);
  }
  if (variant) {
    p(0xe6dfbd, 12, 12, 3, 3);
    p(((112 + variant % 16 * 5) << 16) | ((128 + Math.floor(variant / 16) % 8 * 8) << 8) | (136 + Math.floor(variant / 128) * 24), 13, 13, 2, 2);
  }
  return pixels;
}
