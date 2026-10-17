import type { Pixel } from './avatar.ts';
import type { DailyEpisode } from './daily-event-catalog.ts';
// All sprites use a 48 x 48 pixel canvas. Distinct themed silhouettes plus episode props.
export function eventPixels(event: DailyEpisode, frame = 0): Pixel[] {
  const out: Pixel[] = [], v = event.variant;
  const p = (color: number, x: number, y: number, w: number, h: number) => out.push({ color, x, y, w, h });
  const ink = 0x36404d, white = 0xf7f0da, red = 0xc85a57, blue = 0x699db6, gold = 0xe6be6c, skin = 0xe4b68b;
  const accent = [0xe6bc6c, 0x95bbaa, 0xc28db4, 0x8baccd, 0xd38365, 0xb6bb76, 0x9da2d0][v % 7];
  const eyes = (x = 21, y = 18) => { p(ink, x, y, 2, 2); p(ink, x + 7, y, 2, 2); };
  const human = (coat: number, hat?: number) => {
    p(ink, 16, 37, 7, 5); p(ink, 26, 37, 7, 5); p(coat, 15, 24, 19, 14);
    p(coat, 11, 25, 4, 9); p(coat, 34, 25, 4, 9); p(skin, 11, 33, 4, 3); p(skin, 34, 33, 4, 3);
    p(skin, 18, 11, 14, 14); p(ink, 18, 9, 14, 4); eyes();
    if (hat !== undefined) { p(hat, 14, 9, 22, 4); p(hat, 19, 3, 12, 7); }
  };
  const star = (x: number, y: number, c = gold) => { p(c, x, y + 2, 7, 3); p(c, x + 2, y, 3, 7); };
  const wheel = (x: number) => { p(ink, x, 33, 8, 9); p(0xa4b2b3, x + 2, 35, 4, 4); };
  const theme = event.theme;
  if (theme === 'meteor') {
    p(0x75665f, 5, 33, 38, 10); p(0xa0856e, 9, 30, 30, 12); p(0x584f55, 13, 27, 24, 12);
    p(0x84939b, 15, 18, 20, 18); p(0xa9b4b1, 19, 14, 13, 17); p(accent, 18, 24, 4, 3); p(0x556975, 29, 20, 4, 4);
    star(5, 10); star(36, 18, accent);
  } else if (theme === 'thief') {
    human(0x445b63, 0x445b63); p(ink, 17, 16, 16, 5); p(white, 20, 17, 3, 2); p(white, 27, 17, 3, 2);
    p(0xa38b61, 31, 29, 13, 13); p(0xc5a677, 34, 24, 7, 8); p(ink, 33, 27, 9, 2);
  } else if (theme === 'flood') {
    p(0x6bafbf, 2, 34, 44, 9); p(0xbce0d6, 5, 34, 14, 2); p(0xbce0d6, 27, 38, 15, 2);
    p(gold, 18, 26, 16, 9); p(gold, 28, 19, 9, 10); p(ink, 33, 22, 2, 2); p(0xdc8856, 36, 25, 7, 3);
    p(white, 5, 24, 10, 5); p(white, 10, 13, 2, 13); p(accent, 12, 14, 9, 8);
  } else if (theme === 'santa') {
    human(red, red); p(white, 16, 12, 18, 3); p(white, 16, 21, 18, 6); p(white, 20, 25, 10, 5);
    p(ink, 15, 33, 19, 3); p(gold, 23, 32, 5, 5); p(white, 30, 2, 5, 5);
    p(0x9b7955, 35, 25, 11, 17); p(accent, 1, 32, 11, 10); p(white, 5, 31, 3, 12);
  } else if (theme === 'ghost') {
    human(0xb8ac88); p(ink, 11, 22, 7, 15); p(0x6d8b8e, 12, 25, 4, 9); p(ink, 29, 29, 15, 4);
    p(0x7eaf79, 1, 12, 13, 14); p(0x9cc78b, 3, 8, 9, 15); p(ink, 5, 14, 2, 2); p(ink, 10, 14, 2, 2); p(ink, 5, 19, 6, 2);
    p(blue, 37, 25, 7, 2); p(gold, 39, 20 + frame % 2, 2, 5);
  } else if (theme === 'waldo') {
    human(white, red); for (const y of [25, 30, 35]) p(red, 15, y, 19, 3);
    p(blue, 16, 38, 7, 4); p(blue, 26, 38, 7, 4); p(white, 19, 5, 12, 2);
    p(ink, 18, 16, 7, 6); p(ink, 26, 16, 7, 6); p(skin, 19, 17, 5, 3); p(skin, 27, 17, 5, 3); p(gold, 39, 18, 2, 24);
  } else if (theme === 'delorean') {
    wheel(6); wheel(34); p(0x84949d, 2, 24, 44, 12); p(0xd4dcda, 7, 20, 34, 13);
    p(ink, 15, 12, 20, 11); p(0x80b3c2, 17, 14, 15, 8); p(0xc4cecc, 32, 8, 3, 17); p(0xc4cecc, 34, 5, 11, 4);
    p(gold, 2, 28, 6, 3); p(red, 40, 28, 5, 3); p(blue, 13, 32, 21, 2); star(2, 7);
  } else if (theme === 'terminator') {
    human(0x41444f); p(ink, 16, 15, 18, 5); p(red, 28, 16, 3, 2); p(0x9eaeb1, 30, 20, 3, 4);
    p(0x9eaeb1, 24, 26, 2, 12); p(0x9eaeb1, 28, 27, 4, 2); p(white, 34, 32, 9, 7); p(red, 36, 34, 4, 3);
  } else if (theme === 'momotaro') {
    human(white); p(ink, 19, 8, 12, 5); p(red, 16, 12, 19, 3); p(red, 23, 11, 5, 5); p(blue, 15, 32, 19, 6);
    p(0xe9a6a2, 1, 27, 13, 13); p(0xf1c1a8, 4, 24, 8, 15); p(0x84ac7b, 7, 22, 7, 3); p(gold, 36, 28, 8, 4);
  } else if (theme === 'urashima') {
    human(blue, 0xb4a073); p(white, 22, 25, 4, 13); p(0x799d78, 1, 33, 15, 8); p(0x556f61, 5, 30, 9, 8);
    p(0x986e62, 34, 29, 12, 10); p(gold, 34, 29, 12, 3); p(red, 39, 29, 2, 10);
  } else if (theme === 'kaguya') {
    human(0xc38ca9); p(ink, 16, 10, 4, 18); p(ink, 30, 10, 4, 18); p(0xd2b8c9, 12, 32, 25, 9); p(gold, 21, 28, 8, 4);
    for (const x of [3, 40]) { p(0x84ac70, x, 5, 5, 37); for (const y of [13, 23, 33]) p(0xbad08d, x, y, 5, 2); }
  } else if (theme === 'alice') {
    human(blue); p(gold, 15, 11, 5, 17); p(gold, 30, 11, 5, 17); p(white, 20, 26, 10, 12); p(white, 12, 37, 25, 3);
    p(white, 2, 29, 9, 11); p(white, 3, 20, 2, 10); p(white, 8, 20, 2, 10); p(ink, 4, 31, 1, 1); p(gold, 35, 28, 10, 10); p(ink, 40, 30, 1, 5);
  } else if (theme === 'oz') {
    human(blue); p(0x825d4c, 15, 10, 5, 16); p(0x825d4c, 30, 10, 5, 16); p(white, 20, 25, 10, 10); p(red, 16, 39, 7, 3); p(red, 26, 39, 7, 3);
    for (let i = 0; i < 5; i++) p(gold, i * 9, 44, 8, 3); p(0x998d7a, 1, 33, 12, 7); p(ink, 2, 30, 6, 5);
  } else if (theme === 'pirate') {
    human(0x795266, ink); p(white, 23, 5, 5, 4); p(ink, 26, 16, 6, 4); p(red, 17, 21, 17, 3);
    p(0x997249, 1, 32, 13, 10); p(gold, 1, 31, 13, 3); p(gold, 6, 34, 3, 5); p(0x79a37d, 36, 15, 8, 12); p(red, 41, 19, 5, 3);
  } else if (theme === 'ninja') {
    human(0x4a5266, 0x4a5266); p(0x4a5266, 17, 20, 16, 5); p(red, 13, 12, 22, 2); p(red, 34, 13, 8, 3);
    p(0xb29b72, 3, 29, 8, 12); p(white, 5, 31, 4, 8); star(36, 31, 0xadb7bb);
  } else if (theme === 'dragon') {
    p(0x7ba183, 13, 20, 22, 20); p(0x98b39a, 17, 8, 18, 18); p(gold, 20, 5, 4, 6); p(gold, 31, 5, 4, 6); eyes(22, 15);
    p(0x66876e, 4, 20, 12, 14); p(0xa6bd91, 6, 16, 6, 14); p(0x66876e, 34, 24, 10, 13); p(0xc4ce9a, 20, 28, 9, 11); p(red, 36, 18, 6, 3);
  } else if (theme === 'slime') {
    const color = v === 2 ? 0xa8b9bd : v === 3 ? 0x8b82b3 : v === 5 ? 0xdba97c : blue;
    p(color, 7, 28, 34, 12); p(color, 12, 23, 24, 15); p(color, 18, 18, 12, 10); p(color, 22, 12, 4, 10);
    eyes(17, 29); p(red, 20, 35, 9, 2); p(white, 12, 28, 3, 5); if (v === 3) { p(gold, 16, 13, 16, 6); p(gold, 16, 8, 3, 8); p(gold, 23, 7, 3, 8); p(gold, 29, 8, 3, 8); }
  } else if (theme === 'robot' || theme === 'space') {
    if (theme === 'robot') {
      human(0x8b9eaa); p(0xaabfc6, 15, 10, 20, 16); p(ink, 18, 15, 14, 7); p(0x9ddab7, 20, 17, 3, 3); p(0x9ddab7, 27, 17, 3, 3); p(accent, 21, 29, 8, 5); p(ink, 24, 5, 2, 6); p(red, 23, 3, 4, 3);
    } else {
      human(0x94b89c); p(0xa4c7a2, 15, 8, 20, 17); p(ink, 18, 14, 5, 6); p(ink, 28, 14, 5, 6); p(white, 19, 15, 1, 2); p(0x94b89c, 12, 3, 2, 8); p(0x94b89c, 35, 3, 2, 8); star(3, 19);
    }
  } else if (theme === 'dinosaur') {
    p(0x96ad77, 15, 19, 18, 19); p(0xaabd80, 22, 8, 20, 16); p(ink, 35, 13, 2, 2); p(white, 32, 22, 9, 2);
    p(0x96ad77, 6, 31, 15, 7); p(0x96ad77, 2, 27, 7, 7); p(0x718d66, 17, 37, 6, 6); p(0x718d66, 27, 36, 6, 7); p(accent, 16, 17, 5, 5);
  } else if (theme === 'magic') {
    human(0x8776a1); p(0x8776a1, 9, 12, 31, 4); p(0x8776a1, 18, 5, 17, 10); p(0x8776a1, 24, 0, 8, 9);
    p(0xddd0b3, 17, 22, 17, 7); p(0xddd0b3, 21, 27, 9, 6); p(gold, 40, 15, 2, 26); star(37, 8); star(2, 19, accent);
  } else if (theme === 'food') {
    if (v === 1 || v === 13) { p(ink, 6, 32, 36, 9); p(white, 10, 22, 28, 17); p(white, 16, 12, 16, 14); p(white, 21, 6, 6, 8); p(ink, 19, 29, 11, 12); }
    else if (v === 8) { p(white, 10, 27, 29, 10); p(red, 7, 20, 35, 11); p(0xe99d91, 10, 18, 29, 9); }
    else if (v === 11) { p(blue, 14, 16, 21, 25); p(0xa8d0a6, 16, 19, 17, 19); p(white, 17, 8, 16, 13); p(red, 29, 6, 5, 5); }
    else { p(0x9c7659, 8, 37, 33, 5); p(gold, 11, 16, 27, 23); p(0xe9cf91, 14, 12, 21, 24); p(0xa57654, 14, 12, 21, 5); eyes(18, 25); p(red, 23, 32, 6, 2); }
  } else if (theme === 'festival') {
    p(0x97754e, 6, 17, 3, 26); p(0x97754e, 39, 17, 3, 26); p(red, 3, 9, 42, 9);
    for (let i = 0; i < 5; i++) p(white, 5 + i * 8, 9, 4, 9);
    p(0xb28b60, 6, 33, 36, 10); p(accent, 11, 25, 26, 8); p(gold, 19, 2, 10, 6); p(ink, 23, 0, 2, 2);
  } else if (theme === 'detective') {
    human(0xaf926d, 0x887359); p(0x625745, 24, 26, 3, 12); p(ink, 33, 18, 11, 11); p(0xa0c6cb, 35, 20, 7, 7); p(ink, 32, 27, 3, 10); p(gold, 4, 32, 8, 8);
  } else if (theme === 'comic') {
    if ([0, 7, 9, 10, 13].includes(v)) {
      const color = v === 0 ? blue : v === 7 ? 0x8c9c91 : v === 9 ? gold : v === 10 ? 0xe4a6b5 : white;
      p(color, 10, 17, 29, 21); p(color, 15, 9, 20, 27); p(color, 13, 35, 11, 6); p(color, 28, 35, 11, 6); p(white, 18, 26, 15, 11); eyes(19, 18);
      if (v === 9) { p(gold, 14, 0, 5, 16); p(gold, 30, 0, 5, 16); p(ink, 14, 0, 5, 4); p(ink, 30, 0, 5, 4); p(red, 14, 23, 5, 4); p(red, 31, 23, 5, 4); }
      else if (v === 0) { p(red, 12, 26, 26, 3); p(gold, 23, 27, 6, 6); p(red, 24, 16, 4, 4); }
      else if (v === 7) { p(color, 14, 1, 5, 15); p(color, 30, 1, 5, 15); p(ink, 21, 30, 3, 2); p(ink, 28, 30, 3, 2); }
      else if (v === 13) { p(ink, 8, 15, 6, 13); p(ink, 36, 15, 6, 13); p(ink, 25, 20, 6, 4); }
      else { p(red, 7, 36, 12, 6); p(red, 30, 36, 12, 6); }
    } else {
      const colors = [blue, 0xe29749, red, 0xe28d42, red, red, 0x554b61, 0x9da791, blue, gold, 0xe5a6bb, red, 0x617caf, white];
      human(colors[v], [2, 11].includes(v) ? (v === 2 ? gold : red) : undefined);
      if (v === 1 || v === 3) { for (let i = 0; i < 5; i++) p(v === 1 ? ink : gold, 15 + i * 4, 5 + i % 2 * 3, 5, 9); p(blue, 15, 31, 19, 3); }
      if (v === 4 || v === 8) { p(ink, 16, 16, 9, 5); p(ink, 26, 16, 9, 5); p(skin, 18, 17, 5, 2); p(skin, 28, 17, 5, 2); }
      if (v === 5) { p(red, 20, 16, 11, 5); p(gold, 21, 27, 9, 6); }
      if (v === 6) { p(red, 14, 8, 22, 3); p(red, 20, 4, 10, 7); }
      if (v === 11) { p(blue, 19, 29, 12, 9); p(ink, 23, 20, 8, 2); }
      if (v === 12) { p(gold, 12, 10, 7, 23); p(gold, 31, 10, 7, 23); p(red, 21, 25, 8, 5); }
    }
  } else {
    // A viewing scope marks an outdoor incident; the visitor also appears in the panorama.
    p(0x778d94, 12, 17, 25, 9); p(0xb6c4c3, 9, 16, 10, 11); p(ink, 8, 17, 4, 9);
    p(0x8b745c, 24, 25, 3, 10); p(0x8b745c, 17, 35, 4, 9); p(0x8b745c, 30, 35, 4, 9); star(36, 7);
  }
  // Distinct episode marker: a tiny prop parcel changes shape/palette, not the story text alone.
  if (theme !== 'delorean' && theme !== 'flood') {
    const x = v % 2 ? 2 : 37;
    p(accent, x, 38, 8, 7); p(white, x + 3, 38, 2, 7);
    if (v % 3 === 0) star(x, 31, accent);
    else if (v % 3 === 1) { p(0x81a47c, x + 3, 32, 2, 7); p(0x81a47c, x, 33, 7, 2); }
    else { p(white, x, 33, 8, 5); p(ink, x + 2, 34, 4, 1); }
  }
  return out;
}
// Canvas and Phaser share exactly the same pixel geometry.
export function drawEventPreview(canvas: HTMLCanvasElement, episode: DailyEpisode): void {
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#eee3c8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (episode.theme === 'kaiju') {
    ctx.fillStyle = '#cadce0'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#7f9caa'; ctx.fillRect(0, canvas.height - 26, canvas.width, 26);
    for (let i = 0; i < Math.ceil(canvas.width / 18); i++) { ctx.fillStyle = '#97aaa8'; ctx.fillRect(i * 18, canvas.height - 30 - i % 4 * 5, 14, 30); }
    for (const p of outsideEventPixels(episode, canvas.width, canvas.height)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); } }
  else { const scale = Math.min(canvas.width / 64, canvas.height / 56); for (const p of eventPixels(episode)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(Math.round((canvas.width - 48 * scale) / 2 + p.x * scale), Math.round((canvas.height - 48 * scale) / 2 + p.y * scale), Math.ceil(p.w * scale), Math.ceil(p.h * scale)); } }
}
export function outsideEventPixels(event: DailyEpisode, width = 480, height = 56, frame = 0): Pixel[] {
  if (event.theme !== 'kaiju') return [];
  const out: Pixel[] = [], p = (color: number, x: number, y: number, w: number, h: number) => out.push({ color, x, y, w, h });
  const v = event.variant, x = Math.round(width * 0.59) + (frame % 3 - 1), base = height - 9;
  const monster = (color: number) => {
    p(color, x, base - 26, 21, 27); p(color, x + 8, base - 39, 21, 17); p(color, x + 14, base - 42, 12, 8);
    p(color, x - 15, base - 9, 20, 9); p(color, x - 24, base - 13, 12, 7); p(color, x - 5, base - 22, 12, 6);
    p(0xd9e6cb, x - 3, base - 30, 5, 5); p(0xbad3b8, x - 8, base - 21, 5, 5); p(0xe7dc9a, x + 23, base - 36, 3, 2);
    p(color, x - 2, base, 10, 7); p(color, x + 14, base, 11, 7);
  };
  if ([0, 10, 14].includes(v)) { monster(v === 14 ? 0x426f71 : 0x52756b); if (v === 10) p(0x52756b, x + 18, base - 30, 16, 5); }
  else if (v === 1) { p(0x8d718d, x - 3, 12, 8, 31); for (const side of [-1, 1]) { p(0xe4bc7b, x + side * 20 - 12, 11, 26, 20); p(0xa97a7c, x + side * 20 - 8, 16, 18, 10); p(0x638c9d, x + side * 21 - 2, 19, 5, 6); } }
  else if (v === 2 || v === 5 || v === 9) { const c = v === 2 ? 0x76685d : v === 5 ? 0xd6c5a1 : 0x3f5669; p(c, x - 10, base - 30, 35, 33); p(c, x - 5, base - 44, 24, 19); p(c, x - 19, base - 25, 10, 22); p(c, x + 24, base - 25, 10, 22); p(0xe9ddbc, x, base - 34, 3, 3); p(0xe9ddbc, x + 12, base - 34, 3, 3); if (v === 9) p(0xd5d6c1, x - 3, base - 23, 19, 24); else p(0xcc9b76, x - 2, base - 29, 19, 11); }
  else if (v === 3) { p(0x8296a3, x - 25, 19, 53, 12); p(0xd1dcdb, x - 19, 16, 41, 11); p(0x76b6cb, x - 11, 11, 22, 8); p(0x7bdbdb, x - 32, 29, 66, 2); }
  else if (v === 4) { p(0x9bb1b6, x - 38, 20, 76, 9); p(0x84adc0, x - 18, 11, 37, 11); p(0xc4dbac, x - 32, 28, 64, 3); for (let i = 0; i < 5; i++) p(0xe7d48d, x - 27 + i * 13, 24, 4, 3); }
  else if (v === 6) { p(0x72846f, x - 38, 26, 74, 13); p(0x95ad7c, x - 29, 19, 56, 12); p(0xc5b797, x - 15, 4, 30, 20); p(0x8f8175, x - 19, 9, 38, 5); p(0x8f8175, x - 10, 0, 8, 8); p(0x8f8175, x + 5, 0, 8, 8); p(0x5f7a83, x - 3, 14, 6, 9); }
  else if (v === 7 || v === 11) { p(v === 7 ? 0x7f9d83 : 0x6c8fa8, x - 33, 19, 70, 19); p(v === 7 ? 0x7f9d83 : 0x6c8fa8, x + 24, 14, 27, 20); p(0xe1dbc0, x + 40, 18, 3, 3); p(0x7c98a1, x - 45, 12, 15, 27); p(0xa5c1c5, x - 12, 35, 17, 9); if (v === 11) for (let i = 0; i < 8; i++) p(0xe4d39c, x - 26 + i * 8, 24 + i % 2 * 4, 2, 2); }
  else if (v === 8) { p(0xb25f61, x - 20, 20, 34, 11); p(0xe4c080, x - 24, 33, 43, 3); for (let i = 0; i < 3; i++) { p(0xb49170, x + 24 + i * 14, 16, 10, 9); p(0xb49170, x + 26 + i * 14, 12, 3, 6); } }
  else if (v === 12) { p(0x708a99, x - 9, base - 30, 30, 28); p(0x9fb8bd, x - 5, base - 43, 22, 14); p(0xe6b172, x, base - 38, 13, 4); p(0x708a99, x - 5, base - 2, 8, 10); p(0x708a99, x + 13, base - 2, 8, 10); p(0x708a99, x - 19, base - 27, 9, 25); p(0x708a99, x + 22, base - 27, 9, 25); }
  else { for (let i = 0; i < 4; i++) { p(0x577b99, x - 50 + i * 24, 18, 22, 14); p(0xdfca88, x - 47 + i * 24, 21, 6, 6); p(0xdfca88, x - 38 + i * 24, 21, 6, 6); } p(0xd1d8c4, x - 65, 13, 23, 5); }
  return out;
}
