import type { Pixel } from './avatar.ts';
import type { EventProp } from './event-props.ts';

/** 32×32 authored objects, in the original 8-unit footprint. Pixel runs are
 * shared by the actual office, event journal and development contact sheet. */
export const EVENT_PROP_ART_SIZE = 32;
const C = { ink: 0x34414c, edge: 0x53636c, white: 0xfff7df, paper: 0xe8dcc1, red: 0xcf7164, coral: 0xe89b83, blue: 0x6ba7bb, pale: 0xb8d9d5, gold: 0xdfb66d, lightGold: 0xf8dc96, wood: 0x9c724e, green: 0x719776, leaf: 0xa5bc7c, purple: 0xa08aaf, metal: 0xa9b8b9, dark: 0x273542 };
const cache = new Map<EventProp, Pixel[]>();
export function designedEventProp(kind: EventProp): Pixel[] {
  const cached = cache.get(kind); if (cached) return cached;
  const grid: (number | undefined)[] = Array(32 * 32);
  const dot = (c: number | undefined, x: number, y: number) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) grid[y * 32 + x] = c; };
  const rect = (c: number | undefined, x: number, y: number, w: number, h: number) => {
    for (let yy = Math.max(0, Math.round(y)); yy < Math.min(32, Math.round(y + h)); yy++) for (let xx = Math.max(0, Math.round(x)); xx < Math.min(32, Math.round(x + w)); xx++) dot(c, xx, yy);
  };
  const ellipse = (c: number | undefined, x: number, y: number, w: number, h: number) => {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(32, y + h); yy++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(32, x + w); xx++) if (((xx + .5 - x - w / 2) / (w / 2)) ** 2 + ((yy + .5 - y - h / 2) / (h / 2)) ** 2 <= 1) dot(c, xx, yy);
  };
  const line = (c: number, x: number, y: number, xx: number, yy: number, width = 1) => {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(xx - x), Math.abs(yy - y))));
    for (let i = 0; i <= steps; i++) rect(c, x + (xx - x) * i / steps, y + (yy - y) * i / steps, width, width);
  };
  const poly = (c: number, points: number[][]) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i], [xj, yj] = points[j];
        if ((yi > y + .5) !== (yj > y + .5) && x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) dot(c, x, y);
    }
  };
  const box = (c: number, x: number, y: number, w: number, h: number) => { rect(C.ink, x, y, w, h); rect(c, x + 1, y + 1, w - 2, h - 2); rect(C.white, x + 2, y + 1, w - 4, 1); };
  const circle = (c: number, x: number, y: number, w: number, h = w) => { ellipse(C.ink, x, y, w, h); ellipse(c, x + 1, y + 1, w - 2, h - 2); };
  const eye = (x: number, y: number) => { ellipse(C.ink, x, y, 3, 4); dot(C.white, x, y); };
  const text = (x: number, y: number, w: number, rows = 3) => { for (let row = 0; row < rows; row++) rect(row ? C.metal : C.edge, x, y + row * 3, Math.max(2, w - (row % 3) * 2), 1); };
  const leaf = (x: number, y: number, flip = false) => { ellipse(C.green, x, y, 9, 5); line(C.leaf, x + 1, y + (flip ? 1 : 3), x + 7, y + (flip ? 3 : 1)); };
  const wheel = (x: number, y: number, size = 7) => { circle(C.dark, x, y, size); ellipse(C.metal, x + 2, y + 2, size - 4, size - 4); dot(C.white, x + 3, y + 2); };
  const bowl = (c: number, y = 17) => { poly(C.ink, [[2,y],[30,y],[25,28],[8,28]]); poly(c, [[4,y+1],[28,y+1],[24,26],[9,26]]); ellipse(C.white, 3,y-3,26,7); ellipse(C.gold,5,y-2,22,4); rect(C.ink,11,28,10,2); };
  const screen = (c = C.blue) => { box(C.metal, 3, 6, 26, 19); box(C.dark, 5, 8, 22, 14); rect(c, 7, 10, 18, 10); line(C.pale, 8, 11, 14, 11); };
  const animal = (fur: number, ears: 'point' | 'round' | 'long' | 'none' = 'round') => {
    ellipse(C.ink, 8, 14, 17, 15); ellipse(fur, 9, 15, 15, 13);
    rect(C.ink, 8, 26, 6, 4); rect(C.ink, 20, 26, 6, 4); rect(fur, 9, 26, 4, 3); rect(fur, 21, 26, 4, 3);
    if (ears === 'point') { poly(C.ink, [[5,13],[5,1],[14,8],[20,8],[28,1],[27,15]]); poly(fur, [[7,12],[7,4],[13,9],[21,9],[26,4],[25,14]]); dot(C.coral,8,7); dot(C.coral,24,7); }
    if (ears === 'round') { circle(fur, 4, 5, 9); circle(fur, 21, 5, 9); }
    if (ears === 'long') { circle(fur, 8, 0, 5, 15); circle(fur, 20, 0, 5, 15); rect(C.coral,10,3,1,7); rect(C.coral,22,3,1,7); }
    circle(fur, 5, 7, 23, 17); eye(10,12); eye(20,12); ellipse(C.white, 12,17,9,5); dot(C.ink,16,18); line(C.ink,16,19,16,20);
  };
  switch (kind) {
    // Paperwork and office furniture: actual sheets, controls, legs and surfaces.
    case 'paper': case 'scroll': case 'book': case 'envelope': case 'ticket': case 'card': {
      if (kind === 'envelope') { box(C.paper, 2, 7, 28, 19); line(C.wood,3,8,15,19); line(C.wood,28,8,16,19); line(C.wood,3,24,11,18); line(C.wood,28,24,20,18); rect(C.red,23,10,4,5); break; }
      if (kind === 'ticket') { box(C.gold,1,8,30,16); text(5,13,12,2); for(let y=10;y<23;y+=3) dot(C.wood,23,y); rect(C.white,26,11,2,10); break; }
      box(kind === 'book' ? C.red : C.white, 6, 2, 21, 28);
      if (kind === 'book') { rect(C.wood,7,3,3,25); box(C.gold,13,7,10,9); text(15,10,6,2); rect(C.paper,11,26,14,2); }
      else if(kind === 'card') { rect(C.red,9,5,2,3); poly(C.red,[[16,9],[23,16],[16,25],[11,16]]); rect(C.red,23,25,2,2); }
      else { text(10,8,13,5); if(kind === 'scroll') { circle(C.gold,3,1,8,5); circle(C.gold,23,26,8,5); } else { poly(C.paper,[[21,3],[26,8],[21,8]]); rect(C.blue,10,23,7,2); } }
      break;
    }
    case 'printer': { box(C.metal,3,10,26,16); box(C.white,8,1,16,14); text(11,5,10,2); box(C.edge,5,16,22,7); rect(C.green,24,13,2,2); box(C.white,9,20,14,11); text(12,23,8,2); break; }
    case 'desk': { box(C.wood,1,9,30,7); rect(C.gold,3,10,26,3); for(const x of[4,26]) { rect(C.ink,x,16,3,15); rect(C.metal,x,17,1,12); } box(C.paper,6,5,9,6); rect(C.blue,20,6,5,3); break; }
    case 'chair': { box(C.green,7,1,18,13); box(C.leaf,5,16,22,6); rect(C.metal,15,14,2,16); line(C.ink,5,29,26,29,2); line(C.metal,16,25,8,29); line(C.metal,16,25,24,29); wheel(4,28,4); wheel(25,28,4); rect(C.ink,3,11,3,10); rect(C.ink,26,11,3,10); break; }
    case 'stapler': { box(C.metal,2,23,28,5); poly(C.ink,[[3,20],[16,7],[28,7],[30,12],[10,24]]); poly(C.red,[[5,19],[17,9],[27,9],[27,12],[9,21]]); line(C.coral,8,18,21,10); rect(C.metal,3,22,4,2); break; }
    case 'clip': { line(C.metal,9,27,6,9,3); line(C.metal,6,9,11,4,3); line(C.metal,11,4,23,4,3); line(C.metal,23,4,25,24,3); line(C.metal,25,24,12,27,3); line(C.metal,12,27,12,10,3); line(C.metal,12,10,19,10,3); line(C.metal,19,10,19,21,3); line(C.white,7,10,7,20); break; }
    case 'pin': { circle(C.red,8,2,16,12); circle(C.coral,11,4,8,5); poly(C.metal,[[14,13],[18,13],[15,30]]); break; }
    case 'pencil': case 'wand': case 'sword': case 'feather': {
      if(kind === 'feather') { ellipse(C.pale,9,1,15,23); line(C.edge,6,30,22,3); for(let y=7;y<24;y+=3) line(C.white,12,y,21,y-4); }
      else if(kind === 'sword') { poly(C.metal,[[7,24],[22,3],[29,1],[27,8],[11,28]]); line(C.white,10,23,27,3); line(C.gold,6,20,16,29,3); line(C.wood,8,26,4,30,3); }
      else { line(C.ink,5,27,25,4,4); line(kind === 'wand' ? C.purple : C.gold,6,27,26,4,2); if(kind==='pencil') { line(C.coral,5,28,8,25,3); poly(C.paper,[[25,3],[30,0],[28,7]]); dot(C.ink,29,1); } else { poly(C.lightGold,[[25,0],[27,5],[32,6],[28,9],[29,14],[24,11],[20,14],[21,9],[17,6],[23,5]]); } }
      break;
    }
    case 'ruler': { poly(C.ink,[[2,20],[25,2],[31,10],[8,28]]); poly(C.gold,[[4,20],[25,4],[29,10],[9,26]]); for(let i=0;i<8;i++) line(C.wood,7+i*2.5,19-i*2,9+i*2.5,22-i*2); break; }
    case 'eraser': { poly(C.ink,[[5,8],[24,8],[30,16],[24,25],[4,25],[0,18]]); poly(C.coral,[[6,9],[23,9],[27,16],[20,23],[5,23],[2,18]]); poly(C.paper,[[15,9],[23,9],[27,16],[20,23],[12,23],[17,16]]); break; }
    case 'scissors': { circle(C.red,2,17,12); circle(C.red,17,17,12); ellipse(C.white,5,20,6,6); ellipse(C.white,20,20,6,6); line(C.metal,9,20,26,2,3); line(C.metal,22,20,6,2,3); circle(C.ink,13,14,5); break; }
    case 'glue': { box(C.paper,8,13,16,17); rect(C.red,10,6,12,7); rect(C.white,14,1,4,5); rect(C.blue,9,18,14,8); text(11,20,9,2); break; }
    case 'stamp': { box(C.edge,4,22,24,7); poly(C.red,[[7,22],[12,16],[12,10],[20,10],[20,16],[26,22]]); circle(C.wood,10,2,12,11); rect(C.white,12,4,6,1); break; }
    case 'calculator': case 'phone': case 'floppy': {
      box(kind==='floppy'?C.blue:C.ink,7,1,19,30);
      if(kind==='floppy'){ box(C.metal,10,2,13,9); rect(C.dark,17,3,3,6); box(C.paper,10,17,13,11); text(12,20,9,2); }
      else { box(C.pale,9,4,15,kind==='phone'?19:7); if(kind==='phone') { rect(C.blue,10,10,13,12); circle(C.white,14,26,4); rect(C.edge,13,2,7,1); } else for(let y=14;y<28;y+=4)for(let x=10;x<24;x+=4) rect(x===22?C.gold:C.metal,x,y,3,3); }
      break;
    }
    case 'tv': case 'radio': case 'camera': {
      if(kind==='tv'){ screen(); line(C.ink,16,6,10,1); line(C.ink,16,6,23,0); rect(C.ink,6,25,3,4); rect(C.ink,23,25,3,4); rect(C.green,9,17,8,2); rect(C.lightGold,18,13,4,4); }
      else if(kind==='radio'){ box(C.wood,2,9,28,20); line(C.metal,24,9,29,0,2); circle(C.ink,5,13,13); for(let y=16;y<24;y+=2)line(C.metal,8,y,14,y); box(C.pale,20,12,7,4); circle(C.gold,20,20,6); }
      else { box(C.edge,1,9,30,19); box(C.metal,7,5,9,5); circle(C.metal,10,12,15); circle(C.dark,13,15,9); ellipse(C.blue,15,16,4,4); dot(C.white,16,16); rect(C.gold,3,12,4,3); rect(C.red,25,11,3,2); }
      break;
    }
    case 'clock': case 'compass': { circle(kind==='clock'?C.wood:C.gold,2,2,28); circle(C.white,5,5,22); for(let i=0;i<12;i++){const a=i*Math.PI/6;rect(C.edge,15+Math.sin(a)*9,15-Math.cos(a)*9,1,i%3?1:2);} if(kind==='clock') { line(C.ink,16,16,16,9,2); line(C.ink,16,16,22,19,2); dot(C.red,16,16); } else { poly(C.red,[[16,7],[20,19],[16,17]]); poly(C.blue,[[16,25],[12,13],[16,17]]); dot(C.ink,16,16); } break; }
    case 'hourglass': { box(C.wood,5,1,22,4); box(C.wood,5,27,22,4); poly(C.edge,[[8,5],[24,5],[22,11],[18,16],[22,21],[24,27],[8,27],[10,21],[14,16],[10,11]]); poly(C.pale,[[10,5],[22,5],[20,11],[16,15],[12,11]]); poly(C.gold,[[16,18],[22,26],[10,26]]); line(C.gold,16,13,16,23); line(C.white,10,7,12,10); break; }
    case 'key': { circle(C.gold,2,1,17); ellipse(undefined,6,5,9,9); line(C.gold,14,14,27,28,4); rect(C.gold,25,21,5,3); rect(C.gold,21,25,4,3); line(C.lightGold,16,15,26,26); break; }
    case 'safe': { box(C.edge,3,1,27,30); box(C.metal,6,4,21,24); box(C.edge,8,6,17,20); circle(C.gold,11,10,11); line(C.ink,16,12,16,18); line(C.ink,13,15,19,15); rect(C.ink,24,9,1,11); rect(C.metal,24,10,2,2); break; }
    case 'fingerprint': { for(let r=13;r>1;r-=3){ for(let i=0;i<150;i++){const a=-Math.PI*.4+i/149*Math.PI*1.8; dot(C.edge,Math.round(16+Math.cos(a)*r),Math.round(15+Math.sin(a)*r));} } line(C.edge,16,13,16,27); line(C.edge,12,19,10,29); break; }
    case 'magnifier': { line(C.ink,20,20,29,29,6); line(C.wood,22,22,29,29,3); circle(C.metal,1,1,23); circle(C.pale,4,4,17); line(C.white,7,13,14,6,2); break; }
    case 'footprint': case 'paw': { if(kind==='footprint'){ ellipse(C.edge,11,9,12,16); ellipse(C.edge,10,24,11,7); for(let i=0;i<4;i++)ellipse(C.edge,7+i*5,2+i%2,4,6); }else{ ellipse(C.wood,7,15,19,14); for(const[x,y]of[[3,9],[9,3],[18,3],[25,9]])ellipse(C.wood,x,y,5,8); ellipse(C.gold,11,20,9,5); } break; }
    // Containers: handles, rims, transparent liquid and readable closures.
    case 'cup': { ellipse(C.ink,21,10,10,13); ellipse(C.white,23,12,6,9); box(C.paper,4,7,20,21); ellipse(C.white,4,4,20,8); ellipse(C.wood,7,6,14,4); rect(C.white,6,12,2,10); ellipse(C.paper,4,24,20,5); break; }
    case 'bottle': case 'potion': case 'thermometer': { if(kind==='thermometer'){ box(C.white,12,1,8,24); circle(C.red,9,19,14); rect(C.red,15,6,2,20); for(let y=5;y<20;y+=4)rect(C.edge,19,y,3,1); dot(C.white,12,23); }else{ box(C.wood,12,1,8,4); rect(C.pale,12,5,8,7); if(kind==='potion'){circle(C.purple,5,10,22,21);ellipse(C.pale,8,11,16,7);rect(C.purple,7,17,18,10);dot(C.white,10,19);}else{box(C.blue,9,10,14,21);box(C.paper,10,19,12,7);rect(C.green,13,21,6,3);}rect(C.white,10,13,2,6); } break; }
    case 'plate': { circle(C.paper,1,6,30,21); circle(C.white,4,8,24,16); ellipse(C.pale,8,11,16,10); ellipse(C.white,10,12,12,8); break; }
    case 'basket': { poly(C.wood,[[2,13],[30,13],[26,29],[6,29]]); poly(C.gold,[[4,14],[28,14],[24,27],[8,27]]); for(let y=17;y<27;y+=3)line(C.wood,7,y,25,y); for(let x=9;x<26;x+=4)line(C.wood,x,15,x,27); for(let i=0;i<30;i++){const a=Math.PI+i/29*Math.PI;rect(C.wood,16+Math.cos(a)*10,14+Math.sin(a)*12,2,2);} break; }
    case 'suitcase': case 'chest': case 'gift': { if(kind==='chest'){ellipse(C.ink,2,3,28,23);ellipse(C.wood,3,4,26,21);box(C.wood,2,16,28,15);rect(C.gold,6,7,3,22);rect(C.gold,23,7,3,22);rect(C.gold,3,16,26,2);box(C.metal,13,16,7,7);dot(C.ink,16,20);line(C.lightGold,10,6,20,6);for(let y=22;y<29;y+=3)line(C.ink,10,y,22,y);}else if(kind==='gift'){box(C.red,3,12,26,18);rect(C.gold,14,12,4,18);box(C.coral,1,8,30,6);ellipse(C.gold,6,1,10,8);ellipse(C.gold,16,1,10,8);ellipse(C.white,9,3,5,3);ellipse(C.white,18,3,5,3);}else{box(C.green,2,9,28,20);box(C.gold,10,3,12,7);rect(C.dark,12,5,8,4);box(C.green,3,10,26,7);rect(C.gold,6,10,2,17);rect(C.gold,24,10,2,17);box(C.metal,14,16,5,6);dot(C.ink,16,19);} break; }
    case 'door': case 'mirror': case 'painting': { box(C.wood,4,1,24,30); box(kind==='door'?C.green:kind==='mirror'?C.blue:C.paper,7,4,18,24); if(kind==='door'){box(C.pale,10,7,12,9);circle(C.gold,21,20,3);}else if(kind==='mirror'){poly(C.pale,[[9,5],[23,5],[9,24]]);line(C.white,11,9,15,5,2);}else{ellipse(C.gold,18,7,4,4);poly(C.blue,[[8,25],[14,14],[18,20],[23,13],[24,26]]);poly(C.green,[[8,26],[8,21],[18,19],[24,23],[24,27]]);} break; }
    case 'ladder': { for(const x of[6,24])box(C.wood,x,1,3,30);for(let y=5;y<29;y+=6){rect(C.gold,8,y,17,2);rect(C.wood,8,y+2,17,1);} break; }
    case 'pipe': { box(C.green,9,9,15,22);box(C.leaf,4,2,25,10);rect(C.dark,7,4,19,5);rect(C.green,11,12,2,17);rect(C.leaf,21,12,1,16);break; }
    case 'cable': case 'rope': { const c=kind==='rope'?C.wood:C.ink;for(let i=0;i<55;i++){const a=i/54*Math.PI*3;rect(c,15+Math.cos(a)*10,15+Math.sin(a)*7+i/9,2,2);}if(kind==='cable'){box(C.metal,22,24,7,6);rect(C.ink,24,30,1,2);rect(C.ink,27,30,1,2);}else for(let y=4;y<30;y+=4)dot(C.gold,12,y);break; }
    case 'gear': case 'wheel': { circle(kind==='gear'?C.metal:C.ink,5,5,22);circle(C.edge,10,10,12);circle(C.metal,13,13,6);for(let i=0;i<8;i++){const a=i*Math.PI/4;if(kind==='gear')rect(C.metal,14+Math.cos(a)*13,14+Math.sin(a)*13,4,4);else line(C.metal,16,16,16+Math.cos(a)*9,16+Math.sin(a)*9);}break; }
    case 'battery': {box(C.metal,7,4,18,27);rect(C.ink,12,0,8,4);rect(C.green,9,17,14,12);rect(C.red,9,6,14,9);rect(C.white,13,9,6,1);rect(C.white,16,7,1,5);rect(C.white,13,22,6,1);break;}
    case 'magnet': {box(C.metal,3,3,8,20);box(C.metal,21,3,8,20);ellipse(C.metal,3,13,26,18);rect(C.white,11,4,10,17);ellipse(C.white,10,15,12,8);rect(C.red,3,3,8,8);rect(C.blue,21,3,8,8);rect(C.white,4,4,6,1);rect(C.white,22,4,6,1);break;}
    case 'bulb': {circle(C.gold,6,1,20,21);rect(C.gold,11,18,10,7);box(C.edge,11,24,10,5);rect(C.ink,14,29,4,2);line(C.white,11,7,9,11,2);line(C.wood,13,14,16,19);line(C.wood,19,14,16,19);break;}
    case 'hammer': case 'gavel': {line(C.ink,8,29,22,10,5);line(C.wood,9,28,22,10,3);if(kind==='hammer'){poly(C.metal,[[11,5],[19,1],[31,9],[29,14],[19,11],[15,16],[11,13]]);line(C.white,17,4,28,10);}else{poly(C.wood,[[9,4],[14,0],[29,11],[25,17]]);line(C.gold,14,4,25,13,2);box(C.wood,2,28,26,4);}break;}
    // Flora and minerals have organic contours rather than square blocks.
    case 'tree': case 'bamboo': case 'seedling': case 'seed': case 'leaf': case 'flower': case 'cactus': case 'mushroom': {
      if(kind==='tree'){rect(C.wood,13,17,7,14);line(C.gold,15,20,15,29);circle(C.green,2,8,19,17);circle(C.green,13,6,18,18);circle(C.leaf,8,0,19,19);ellipse(C.green,10,12,13,8);}
      else if(kind==='bamboo'){for(const x of[9,21]){box(C.green,x,1,5,30);for(let y=7;y<31;y+=8)rect(C.gold,x,y,5,2);leaf(x-7,5);leaf(x+3,12,true);}}
      else if(kind==='leaf'){poly(C.green,[[3,27],[5,13],[16,5],[29,1],[28,17],[17,27]]);line(C.leaf,2,30,26,5,2);for(let i=0;i<4;i++)line(C.leaf,8+i*4,24-i*4,7+i*4,15-i*3);}
      else if(kind==='mushroom'){box(C.paper,12,13,9,17);ellipse(C.ink,1,1,30,20);ellipse(C.red,2,2,28,17);rect(C.paper,2,17,28,2);circle(C.white,7,6,6);circle(C.white,21,9,5);rect(C.wood,19,21,1,7);}
      else if(kind==='cactus'){rect(C.wood,9,24,15,7);circle(C.green,12,2,9,25);circle(C.green,3,10,6,10);rect(C.green,6,16,9,5);circle(C.green,24,7,5,12);rect(C.green,19,15,9,4);line(C.leaf,15,6,15,23);for(const[x,y]of[[17,9],[17,16],[6,13],[26,10]])dot(C.white,x,y);}
      else if(kind==='flower'){line(C.green,16,12,16,30,2);leaf(6,22);leaf(18,18,true);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;circle(C.red,12+Math.cos(a)*7,8+Math.sin(a)*6,9);}circle(C.lightGold,12,8,9);dot(C.wood,16,12);}
      else{if(kind==='seed'){ellipse(C.wood,7,17,19,13);ellipse(C.gold,10,19,10,8);}else{poly(C.wood,[[7,21],[26,21],[23,31],[10,31]]);rect(C.gold,7,20,19,3);}line(C.green,16,8,16,23,2);leaf(6,8);leaf(17,4,true);}
      break;
    }
    case 'crystal': {poly(C.ink,[[16,0],[27,10],[24,24],[15,32],[5,22],[6,10]]);poly(C.blue,[[16,2],[25,11],[22,23],[15,29],[7,21],[8,10]]);poly(C.pale,[[16,2],[18,11],[15,28],[11,19],[12,8]]);line(C.white,16,3,13,9);line(C.edge,18,11,24,12);break;}
    case 'egg': case 'dinosaurEgg': {circle(C.paper,5,1,23,30);ellipse(C.white,8,4,10,17);for(const[x,y,w,h]of(kind==='egg'?[[19,9,5,4],[9,23,5,3]]:[[19,8,5,7],[8,17,5,6],[18,24,5,4]]))ellipse(kind==='egg'?C.coral:C.green,x,y,w,h);break;}
    case 'bone': {line(C.paper,7,8,25,25,6);for(const[x,y]of[[2,3],[7,0],[20,24],[25,19]])circle(C.paper,x,y,7);line(C.white,11,11,20,20);break;}
    case 'fossil': {circle(C.wood,1,3,30,26);ellipse(C.gold,4,5,25,21);line(C.paper,6,16,27,16,2);for(let x=10;x<25;x+=4){line(C.paper,x,16,x-2,10,2);line(C.paper,x,16,x-2,23,2);}poly(C.paper,[[4,14],[9,10],[9,22],[4,18]]);circle(C.ink,24,13,2);break;}
    // Animals: distinct silhouettes, faces, limbs and characteristic markings.
    case 'cat': case 'fox': {animal(kind==='cat'?C.gold:C.red,'point');line(C.ink,5,19,1,18);line(C.ink,26,19,30,18);if(kind==='fox')poly(C.white,[[8,16],[16,23],[25,16],[22,23],[10,23]]);else{line(C.wood,14,8,16,11);line(C.wood,19,8,18,11);}break;}
    case 'dog': {animal(C.gold);ellipse(C.wood,4,7,5,11);ellipse(C.wood,24,7,5,11);rect(C.red,11,24,12,2);dot(C.lightGold,17,26);break;}
    case 'rabbit': {animal(C.white,'long');ellipse(C.coral,10,18,3,2);ellipse(C.coral,22,18,3,2);break;}
    case 'panda': {animal(C.white);circle(C.ink,4,5,8);circle(C.ink,22,5,8);ellipse(C.ink,8,11,7,7);ellipse(C.ink,19,11,7,7);dot(C.white,11,13);dot(C.white,22,13);rect(C.ink,8,25,6,5);rect(C.ink,20,25,6,5);break;}
    case 'monkey': {animal(C.wood);ellipse(C.gold,7,10,19,12);eye(10,12);eye(20,12);ellipse(C.coral,13,18,7,4);for(let i=0;i<25;i++){const a=i/24*Math.PI*1.7;dot(C.wood,Math.round(27+Math.cos(a)*4),Math.round(23+Math.sin(a)*5));}break;}
    case 'cow': {animal(C.white,'none');line(C.gold,7,9,5,2,3);line(C.gold,24,9,27,2,3);ellipse(C.ink,8,9,7,6);ellipse(C.coral,10,17,15,6);dot(C.wood,13,20);dot(C.wood,21,20);ellipse(C.ink,18,24,5,4);break;}
    case 'sheep': {for(const[x,y]of[[4,12],[10,8],[18,9],[23,14],[8,20],[18,20]])circle(C.paper,x,y,10);circle(C.white,9,10,16);circle(C.wood,22,14,9,12);eye(24,17);rect(C.ink,9,27,3,4);rect(C.ink,22,27,3,4);break;}
    case 'elephant': {circle(C.metal,3,12,23,17);circle(C.metal,15,5,15,17);circle(C.edge,12,8,11,13);ellipse(C.metal,14,9,8,10);poly(C.metal,[[25,13],[30,14],[30,28],[24,30],[22,27],[26,25]]);eye(25,10);rect(C.edge,5,24,5,7);rect(C.edge,18,25,5,6);line(C.paper,25,19,24,22,2);break;}
    case 'horse': case 'unicorn': {ellipse(C.wood,5,14,20,11);poly(kind==='unicorn'?C.white:C.gold,[[3,19],[7,15],[18,15],[20,6],[26,4],[30,12],[25,16],[25,25],[20,25],[18,22],[8,22],[5,28],[2,27]]);rect(C.wood,9,23,3,8);rect(C.wood,21,23,3,8);rect(C.edge,7,29,6,2);rect(C.edge,19,29,6,2);line(C.wood,21,7,18,16,3);eye(25,8);if(kind==='unicorn'){poly(C.gold,[[23,7],[24,0],[27,6]]);line(C.purple,5,16,1,25,3);}break;}
    case 'owl': {animal(C.wood,'point');circle(C.paper,7,11,10);circle(C.paper,18,11,10);eye(10,13);eye(21,13);poly(C.gold,[[14,18],[19,18],[16,22]]);for(let x=11;x<23;x+=4)line(C.gold,x,26,x+1,28);break;}
    case 'duck': {ellipse(C.ink,2,15,26,15);ellipse(C.gold,3,16,24,13);circle(C.gold,15,3,14);eye(22,7);poly(C.red,[[25,10],[32,11],[31,15],[25,15]]);ellipse(C.lightGold,8,19,13,6);poly(C.gold,[[5,18],[0,12],[2,22]]);break;}
    case 'penguin': {circle(C.ink,5,2,23,28);ellipse(C.white,9,12,15,16);ellipse(C.white,8,6,7,9);ellipse(C.white,18,6,7,9);eye(10,7);eye(21,7);poly(C.gold,[[13,12],[20,12],[16,16]]);ellipse(C.red,4,28,10,4);ellipse(C.red,20,28,10,4);break;}
    case 'frog': {ellipse(C.green,5,14,22,14);circle(C.leaf,3,6,11);circle(C.leaf,20,6,11);ellipse(C.green,3,11,28,12);eye(7,9);eye(24,9);line(C.ink,9,19,23,19);rect(C.green,1,26,10,4);rect(C.green,23,26,8,4);break;}
    case 'fish': case 'whale': {if(kind==='fish'){poly(C.blue,[[22,15],[31,6],[30,25],[23,19]]);circle(C.blue,1,8,25,17);eye(6,12);poly(C.gold,[[15,18],[18,13],[19,22]]);line(C.edge,21,11,21,21);line(C.white,11,10,17,10);}else{ellipse(C.blue,1,9,26,20);poly(C.blue,[[23,15],[28,7],[31,8],[30,20],[24,24]]);ellipse(C.paper,4,21,19,6);eye(7,15);line(C.pale,12,9,12,3);line(C.pale,12,4,8,1);line(C.pale,12,4,16,1);}break;}
    case 'turtle': {ellipse(C.green,3,24,7,5);ellipse(C.green,21,24,7,5);circle(C.leaf,22,10,10);circle(C.green,2,5,24,22);poly(C.gold,[[13,7],[21,12],[19,22],[9,23],[5,15]]);line(C.wood,13,7,13,15);line(C.wood,5,15,13,15);line(C.wood,13,15,19,22);eye(27,13);break;}
    case 'snail': {line(C.green,2,28,29,28,3);circle(C.gold,3,7,21);for(let i=0;i<32;i++){const a=i/31*Math.PI*4,r=7*(1-i/40);dot(C.wood,Math.round(13+Math.cos(a)*r),Math.round(17+Math.sin(a)*r));}rect(C.green,24,19,6,9);line(C.green,25,20,24,13,2);line(C.green,28,20,30,13,2);dot(C.ink,24,13);dot(C.ink,30,13);break;}
    case 'bee': {ellipse(C.pale,4,3,12,12);ellipse(C.pale,15,3,12,12);ellipse(C.gold,5,12,24,14);for(const x of[11,18])rect(C.ink,x,13,3,12);eye(24,15);poly(C.ink,[[5,16],[0,19],[5,22]]);line(C.ink,26,11,28,6);break;}
    case 'butterfly': {for(const side of[-1,1]){ellipse(side<0?C.coral:C.blue,side<0?1:18,3,13,17);ellipse(side<0?C.red:C.purple,side<0?5:18,18,10,12);ellipse(C.lightGold,side<0?5:22,8,5,7);}rect(C.ink,15,9,3,19);line(C.ink,16,9,11,3);line(C.ink,17,9,23,3);break;}
    case 'spider': {for(let i=0;i<4;i++)for(const side of[-1,1]){line(C.edge,16+side*6,13+i*3,16+side*12,7+i*6,2);line(C.edge,16+side*12,7+i*6,16+side*15,12+i*5,2);}circle(C.ink,8,9,17,18);eye(11,13);eye(19,13);break;}
    case 'octopus': {circle(C.red,5,1,23,22);ellipse(C.coral,8,4,10,6);eye(10,11);eye(21,11);for(let i=0;i<5;i++){line(C.red,7+i*5,20,3+i*6,30,3);dot(C.paper,4+i*6,29);}ellipse(C.wood,14,17,5,4);break;}
    case 'crab': {circle(C.red,7,10,19,15);for(const side of[-1,1]){line(C.red,16+side*7,16,16+side*13,7,3);circle(C.coral,side<0?0:25,0,7,10);for(let i=0;i<3;i++)line(C.red,16+side*7,19+i*3,16+side*14,20+i*4,2);}eye(10,8);eye(20,8);break;}
    case 'snake': {for(let i=0;i<40;i++){const a=i/39*Math.PI*2.1;ellipse(C.green,14+Math.cos(a)*10,20+Math.sin(a)*6,5,5);}line(C.green,23,21,23,9,5);ellipse(C.leaf,19,2,12,10);eye(25,4);line(C.red,29,10,31,13);break;}
    case 'dinosaur': case 'dragon': {poly(C.green,[[2,24],[9,20],[12,11],[20,7],[22,2],[30,4],[31,12],[23,15],[24,27],[20,27],[20,30],[15,30],[16,24],[10,25],[6,29],[1,29]]);ellipse(C.leaf,14,16,8,9);eye(25,6);rect(C.white,26,12,4,1);if(kind==='dragon'){poly(C.red,[[12,11],[2,5],[3,19],[11,21]]);poly(C.gold,[[22,3],[22,0],[25,3]]);poly(C.gold,[[27,3],[30,0],[30,4]]);}else for(let i=0;i<4;i++)rect(C.leaf,9+i*3,17-i*3,2,2);break;}
    case 'flamingo': {ellipse(C.coral,4,13,19,10);line(C.red,21,17,25,5,3);circle(C.coral,22,1,8);poly(C.ink,[[27,5],[32,7],[30,10],[26,7]]);eye(25,3);line(C.red,12,22,12,30);line(C.red,18,22,21,27);line(C.red,21,27,15,27);break;}
    // Food is drawn on a recognisable plate, wrapper or serving silhouette.
    case 'sandwich': {poly(C.wood,[[3,27],[16,3],[30,27]]);poly(C.paper,[[5,25],[16,6],[27,25]]);line(C.green,4,24,28,24,2);line(C.red,4,27,28,27,2);line(C.gold,3,29,29,29,2);break;}
    case 'bread': {circle(C.wood,3,1,26,15);box(C.wood,5,10,22,21);box(C.paper,7,11,18,17);ellipse(C.paper,6,4,20,13);ellipse(C.gold,10,8,4,2);dot(C.wood,20,20);break;}
    case 'pizza': {poly(C.wood,[[16,1],[31,28],[1,28]]);poly(C.gold,[[16,5],[27,26],[5,26]]);circle(C.red,13,10,5);circle(C.red,8,21,5);circle(C.red,20,20,5);line(C.paper,10,17,13,17);dot(C.green,18,23);break;}
    case 'sushi': {box(C.ink,4,13,25,15);ellipse(C.paper,4,9,25,11);ellipse(C.red,4,6,25,11);line(C.coral,8,9,25,9,2);line(C.coral,8,13,25,13);box(C.paper,11,20,11,6);rect(C.ink,13,21,7,5);break;}
    case 'burger': {ellipse(C.wood,2,21,28,10);box(C.gold,2,19,28,7);rect(C.green,1,17,30,3);rect(C.red,3,14,26,3);rect(C.wood,3,11,26,4);ellipse(C.gold,2,2,28,17);rect(C.gold,2,11,28,4);for(const[x,y]of[[8,7],[15,5],[23,8],[18,10]])line(C.white,x,y,x+1,y);break;}
    case 'donut': {circle(C.wood,1,2,30,28);ellipse(C.coral,3,3,26,23);circle(C.wood,10,10,12);ellipse(C.white,12,12,8,8);for(const[x,y,c]of[[7,8,C.gold],[21,7,C.white],[6,20,C.blue],[24,19,C.purple],[16,25,C.gold]])rect(c,x,y,3,1);break;}
    case 'cake': {box(C.wood,3,13,26,17);rect(C.paper,4,15,24,4);rect(C.paper,4,24,24,3);ellipse(C.white,2,9,28,8);rect(C.white,2,13,28,4);for(const x of[7,15,23])circle(C.red,x,9,4);rect(C.gold,15,3,2,9);poly(C.red,[[16,0],[19,3],[16,5],[14,3]]);break;}
    case 'pudding': {ellipse(C.paper,1,25,30,6);poly(C.wood,[[8,7],[24,7],[28,26],[4,26]]);poly(C.gold,[[9,9],[23,9],[26,25],[6,25]]);ellipse(C.wood,7,4,18,8);ellipse(C.coral,11,3,9,4);rect(C.lightGold,10,13,2,8);break;}
    case 'icecream': {poly(C.wood,[[7,17],[26,17],[16,32]]);poly(C.gold,[[9,18],[24,18],[16,29]]);for(let y=20;y<28;y+=3)line(C.wood,11,y,21,y);circle(C.paper,5,9,23,12);circle(C.coral,8,1,18,17);ellipse(C.white,11,4,6,4);break;}
    case 'dumpling': {line(C.wood,16,1,16,31,2);for(const[y,c]of[[3,C.coral],[12,C.paper],[21,C.leaf]])circle(c,7,y,19,10);break;}
    case 'noodle': {bowl(C.red);for(let i=0;i<5;i++){line(C.gold,6+i*4,15,8+i*4,19);line(C.gold,8+i*4,19,10+i*4,16);}line(C.wood,19,2,26,18);line(C.wood,23,2,29,17);line(C.pale,8,11,6,4);break;}
    case 'pan': {circle(C.edge,1,2,25);circle(C.dark,4,5,19);line(C.edge,21,23,28,30,5);line(C.metal,23,25,28,30);ellipse(C.white,8,8,12,11);circle(C.gold,11,11,6);break;}
    case 'fork': {rect(C.metal,14,14,4,18);box(C.metal,7,8,18,8);for(const x of[7,14,22])rect(C.metal,x,0,3,13);rect(C.white,15,18,1,11);break;}
    case 'meat': {circle(C.paper,21,1,8);circle(C.paper,25,5,7);line(C.paper,24,8,18,15,5);circle(C.wood,2,11,23,20);ellipse(C.red,5,13,16,14);ellipse(C.coral,9,16,8,8);break;}
    case 'cheese': {poly(C.wood,[[1,13],[23,2],[31,10],[30,28],[1,28]]);poly(C.gold,[[3,14],[24,4],[29,11],[28,26],[3,26]]);line(C.lightGold,3,14,29,11);for(const[x,y,w]of[[8,18,4],[20,15,5],[23,23,3]])ellipse(C.wood,x,y,w,w);break;}
    case 'banana': {poly(C.gold,[[24,2],[28,3],[28,14],[24,24],[15,30],[5,29],[1,25],[13,24],[20,17],[24,9]]);line(C.lightGold,5,26,15,26,2);line(C.lightGold,15,26,24,15,2);rect(C.wood,24,0,4,5);break;}
    case 'apple': case 'peach': case 'pumpkin': {ellipse(kind==='pumpkin'?C.wood:C.red,2,8,28,23);ellipse(kind==='peach'?C.coral:kind==='pumpkin'?C.gold:C.coral,5,8,24,21);line(C.wood,16,10,17,4,2);leaf(17,2);if(kind==='pumpkin'){for(const x of[9,17,24])line(C.wood,x,12,x,26);poly(C.ink,[[7,15],[11,15],[9,19]]);poly(C.ink,[[21,15],[25,15],[23,19]]);line(C.ink,11,24,21,24,2);}else if(kind==='peach')line(C.red,17,12,16,27);else ellipse(C.white,7,13,3,5);break;}
    case 'carrot': {poly(C.wood,[[6,10],[23,8],[19,20],[10,31]]);poly(C.red,[[8,11],[21,10],[17,22],[11,28]]);line(C.coral,10,14,15,13);line(C.coral,11,20,16,19);for(const x of[7,16,25])line(C.green,15,10,x,1,3);break;}
    case 'corn': {circle(C.gold,9,2,15,26);for(let y=6;y<25;y+=4)for(let x=12;x<23;x+=4)rect(C.lightGold,x,y,2,2);poly(C.green,[[7,8],[11,22],[23,28],[15,31],[7,23]]);poly(C.leaf,[[26,8],[23,20],[14,29],[20,30],[27,21]]);break;}
    case 'candy': {poly(C.red,[[1,5],[9,12],[9,22],[1,29],[4,17]]);poly(C.red,[[31,5],[24,12],[24,22],[31,29],[28,17]]);circle(C.coral,7,7,19,21);for(let i=0;i<4;i++)line(C.paper,10+i*4,11,8+i*4,24,2);break;}
    // Instruments retain strings, keys, valves and the silhouette of the instrument.
    case 'piano': {box(C.ink,2,5,28,21);rect(C.wood,4,7,24,8);rect(C.white,3,19,26,7);for(let x=4;x<29;x+=3)line(C.edge,x,20,x,25);for(const x of[6,9,15,18,21,27])rect(C.ink,x,19,2,4);rect(C.ink,4,26,3,6);rect(C.ink,25,26,3,6);box(C.paper,12,8,9,6);break;}
    case 'guitar': case 'violin': {circle(C.wood,4,15,20,16);circle(kind==='guitar'?C.gold:C.red,7,11,14,15);rect(C.wood,15,3,4,20);box(C.wood,15,0,6,7);if(kind==='guitar')circle(C.ink,11,17,7);else{line(C.ink,10,17,10,22);line(C.ink,20,17,20,22);}for(let x=16;x<19;x++)line(C.paper,x,3,x,26);box(C.ink,11,26,10,2);if(kind==='violin')line(C.gold,25,3,21,30,2);break;}
    case 'trumpet': {poly(C.wood,[[4,14],[23,11],[29,3],[31,4],[31,25],[29,26],[23,18],[4,18]]);poly(C.gold,[[6,14],[24,12],[29,6],[29,22],[24,17],[6,17]]);for(const x of[10,15,20]){rect(C.gold,x,10,2,15);rect(C.metal,x-1,8,4,2);}line(C.gold,10,25,23,25,3);line(C.gold,23,25,23,18,3);break;}
    case 'drum': {box(C.red,3,9,26,18);ellipse(C.paper,2,4,28,11);ellipse(C.white,4,6,24,6);ellipse(C.wood,3,23,26,6);for(const x of[5,13,22])line(C.gold,x,13,x+3,24);line(C.wood,4,1,20,10,2);line(C.wood,29,1,16,10,2);break;}
    case 'mic': {rect(C.ink,15,17,2,13);box(C.edge,8,28,16,3);circle(C.metal,10,1,13,20);for(let y=4;y<17;y+=3)line(C.edge,12,y,20,y);line(C.ink,7,10,7,21,2);line(C.ink,7,21,24,21,2);line(C.ink,24,10,24,21,2);break;}
    case 'note': {line(C.ink,12,6,12,26,3);line(C.ink,27,3,27,22,3);poly(C.ink,[[12,5],[29,1],[29,7],[12,11]]);ellipse(C.ink,3,22,12,8);ellipse(C.ink,18,18,12,8);break;}
    // Vehicles are viewed from the side, with windscreens, undercarriage and wheels.
    case 'car': case 'bus': case 'train': {if(kind==='car'){poly(C.ink,[[1,17],[5,12],[9,6],[23,6],[28,14],[31,17],[31,26],[1,26]]);poly(C.blue,[[2,18],[7,14],[10,8],[22,8],[26,16],[29,18],[29,24],[2,24]]);poly(C.pale,[[10,9],[15,9],[15,15],[7,15]]);poly(C.pale,[[17,9],[21,9],[25,15],[17,15]]);rect(C.paper,2,20,3,2);rect(C.red,27,20,3,2);}else{box(kind==='bus'?C.gold:C.blue,1,5,30,22);for(let x=4;x<28;x+=7)box(C.pale,x,9,6,8);rect(C.paper,2,20,28,2);rect(C.ink,23,8,1,18);if(kind==='train'){rect(C.metal,3,2,25,3);line(C.edge,3,30,30,30);}}wheel(5,23);wheel(22,23);break;}
    case 'bike': {for(const x of[1,20]){circle(C.ink,x,17,11);circle(C.paper,x+2,19,7);line(C.metal,x+5,19,x+5,25);line(C.metal,x+2,22,x+8,22);}line(C.red,6,22,13,11,2);line(C.red,13,11,18,22,2);line(C.red,6,22,18,22,2);line(C.red,13,11,23,11,2);line(C.red,23,11,18,22,2);line(C.red,23,10,25,22,2);rect(C.ink,9,8,8,2);line(C.metal,23,11,22,5,2);rect(C.ink,20,4,9,2);break;}
    case 'boat': {poly(C.wood,[[1,23],[31,23],[25,31],[7,31]]);line(C.gold,2,24,30,24);line(C.wood,15,1,15,24,2);poly(C.paper,[[17,2],[30,20],[17,20]]);poly(C.coral,[[13,7],[3,20],[13,20]]);break;}
    case 'plane': {poly(C.ink,[[0,15],[12,12],[14,3],[16,0],[18,3],[20,12],[31,17],[30,20],[19,18],[19,27],[24,30],[9,30],[13,26],[12,18],[1,19]]);poly(C.paper,[[2,16],[13,14],[15,3],[17,3],[19,14],[29,18],[18,17],[17,28],[14,28],[14,17]]);rect(C.blue,15,6,2,5);break;}
    case 'helicopter': {line(C.ink,4,2,30,2,2);rect(C.metal,17,4,2,5);ellipse(C.blue,11,8,19,16);ellipse(C.pale,20,10,9,8);poly(C.blue,[[12,12],[1,8],[1,15],[14,19]]);line(C.metal,16,22,16,27,2);line(C.metal,25,22,25,27,2);line(C.ink,10,28,30,28,2);break;}
    case 'rocket': {poly(C.ink,[[15,0],[24,10],[24,25],[7,25],[7,11]]);poly(C.paper,[[15,2],[22,11],[22,23],[9,23],[9,11]]);circle(C.blue,11,10,10);poly(C.red,[[7,16],[1,27],[7,27]]);poly(C.red,[[24,16],[30,27],[24,27]]);poly(C.gold,[[11,24],[21,24],[18,31],[16,28],[13,31]]);break;}
    case 'ufo': {circle(C.pale,9,1,15,15);ellipse(C.blue,1,13,30,13);ellipse(C.metal,0,14,32,7);for(const x of[5,14,24])circle(C.gold,x,16,3);line(C.leaf,11,25,8,31);line(C.leaf,21,25,25,31);line(C.white,12,5,17,3,2);break;}
    case 'satellite': {box(C.metal,12,11,9,13);for(const x of[0,23]){box(C.blue,x,6,9,20);for(let y=9;y<25;y+=4)line(C.pale,x+1,y,x+7,y);line(C.pale,x+4,7,x+4,24);}line(C.ink,10,16,23,16,2);line(C.metal,17,10,21,3,2);circle(C.gold,19,0,6);break;}
    case 'telescope': {line(C.ink,16,17,16,30,2);line(C.ink,16,22,8,31,2);line(C.ink,16,22,26,31,2);poly(C.edge,[[3,17],[24,4],[29,13],[8,26]]);poly(C.metal,[[5,17],[24,6],[27,12],[9,23]]);line(C.blue,25,5,29,13,3);line(C.paper,9,16,21,9,2);break;}
    case 'robot': {rect(C.ink,15,0,2,4);circle(C.gold,13,0,6);box(C.metal,6,4,21,13);box(C.dark,9,8,15,6);rect(C.pale,11,10,3,2);rect(C.pale,20,10,2,2);box(C.blue,9,18,15,10);box(C.gold,13,20,7,5);line(C.metal,5,19,3,27,3);line(C.metal,28,19,30,27,3);rect(C.ink,9,28,5,4);rect(C.ink,21,28,5,4);break;}
    case 'sleigh': {poly(C.red,[[4,7],[9,7],[12,16],[24,16],[26,10],[30,10],[29,25],[8,25]]);line(C.gold,2,28,28,28,2);line(C.gold,2,28,0,23,2);line(C.gold,11,25,11,28,2);line(C.gold,24,25,24,28,2);line(C.coral,9,18,26,18);break;}
    // Costume and fantasy items: silhouettes are deliberately distinct.
    case 'hat': case 'helmet': case 'crown': {if(kind==='hat'){box(C.purple,8,2,17,22);box(C.gold,8,18,17,4);box(C.purple,1,24,30,4);}else if(kind==='helmet'){circle(C.metal,3,2,27,25);box(C.dark,6,14,21,9);rect(C.metal,14,13,4,16);line(C.white,7,9,12,5,2);}else{poly(C.wood,[[2,5],[9,13],[16,1],[23,13],[31,5],[27,29],[5,29]]);poly(C.gold,[[4,8],[10,17],[16,5],[22,17],[29,9],[25,27],[7,27]]);for(const[x,c]of[[9,C.red],[16,C.blue],[23,C.green]])circle(c,x-2,21,4);}break;}
    case 'shield': {poly(C.ink,[[3,3],[29,3],[28,19],[24,26],[16,32],[8,26],[4,19]]);poly(C.blue,[[5,5],[27,5],[26,18],[22,24],[16,29],[10,24],[6,18]]);rect(C.paper,14,8,4,15);rect(C.paper,8,13,16,4);line(C.pale,6,6,12,6);break;}
    case 'broom': {line(C.wood,25,0,11,22,3);poly(C.wood,[[12,13],[21,21],[12,31],[1,26]]);poly(C.gold,[[12,15],[19,21],[11,29],[3,25]]);for(let i=0;i<4;i++)line(C.wood,11+i,20,5+i*3,27);line(C.red,10,16,18,22,2);break;}
    case 'carpet': {box(C.red,2,3,28,26);box(C.gold,4,5,24,22);box(C.red,6,7,20,18);poly(C.purple,[[16,8],[24,16],[16,24],[8,16]]);poly(C.gold,[[16,12],[20,16],[16,20],[12,16]]);for(let y=5;y<29;y+=3){rect(C.gold,0,y,2,1);rect(C.gold,30,y,2,1);}break;}
    case 'pocket': {poly(C.ink,[[4,4],[28,4],[27,23],[16,31],[5,23]]);poly(C.blue,[[6,6],[26,6],[25,22],[16,28],[7,22]]);line(C.paper,8,8,24,8);line(C.paper,8,9,8,21);line(C.paper,24,9,24,21);dot(C.gold,16,12);break;}
    case 'bowtie': {poly(C.ink,[[1,4],[15,12],[18,12],[31,4],[31,28],[18,20],[15,20],[1,28]]);poly(C.red,[[3,7],[14,14],[14,19],[3,25]]);poly(C.coral,[[19,14],[29,7],[29,25],[19,19]]);box(C.red,13,12,7,9);break;}
    case 'sock': {poly(C.blue,[[15,1],[27,1],[27,24],[22,30],[3,30],[1,26],[4,22],[15,20]]);rect(C.paper,16,3,10,4);poly(C.paper,[[3,23],[9,23],[10,29],[4,29],[2,26]]);rect(C.paper,22,20,5,5);break;}
    case 'shoe': {poly(C.ink,[[4,7],[16,7],[19,17],[26,18],[31,23],[30,30],[2,30],[1,25]]);poly(C.purple,[[5,9],[15,9],[18,19],[26,20],[29,24],[3,24]]);rect(C.paper,3,26,26,3);for(let x=12;x<23;x+=3)line(C.paper,x,18,x+2,21);break;}
    case 'shirt': {poly(C.edge,[[10,1],[21,1],[31,9],[26,17],[23,14],[23,31],[8,31],[8,14],[4,17],[0,9]]);poly(C.red,[[10,3],[21,3],[28,10],[25,14],[21,11],[21,29],[10,29],[10,11],[5,14],[3,10]]);poly(C.paper,[[11,3],[20,3],[16,8]]);rect(C.gold,14,15,5,5);break;}
    case 'glasses': {box(C.ink,1,9,13,13);box(C.ink,18,9,13,13);rect(C.pale,3,11,9,8);rect(C.pale,20,11,9,8);line(C.ink,14,13,17,13,2);line(C.white,4,14,7,11);line(C.white,21,14,24,11);break;}
    case 'moustache': {poly(C.ink,[[1,13],[5,18],[10,13],[15,11],[16,14],[18,11],[23,13],[27,18],[31,13],[30,23],[24,25],[17,22],[16,19],[14,22],[8,25],[2,23]]);line(C.edge,6,20,12,15);line(C.edge,21,15,26,20);break;}
    case 'hand': {poly(C.wood,[[7,27],[0,18],[1,14],[5,15],[8,19],[8,4],[11,3],[13,15],[13,1],[16,0],[18,15],[19,3],[22,3],[22,17],[25,8],[28,9],[27,24],[22,31],[10,31]]);poly(C.paper,[[9,26],[3,18],[5,17],[10,22],[10,5],[11,5],[14,20],[15,3],[16,3],[18,20],[20,5],[21,5],[22,22],[26,11],[26,23],[21,29],[11,29]]);break;}
    case 'mask': case 'theatre': {const mask=(x:number,y:number,c:number,happy:boolean)=>{poly(C.ink,[[x,y],[x+15,y],[x+14,y+16],[x+8,y+22],[x+1,y+16]]);poly(c,[[x+1,y+1],[x+14,y+1],[x+13,y+15],[x+8,y+20],[x+2,y+15]]);ellipse(C.ink,x+3,y+6,3,2);ellipse(C.ink,x+10,y+6,3,2);if(happy)line(C.ink,x+5,y+13,x+10,y+13,2);else poly(C.ink,[[x+4,y+16],[x+8,y+12],[x+12,y+16]]);};mask(kind==='theatre'?1:8,kind==='theatre'?1:3,C.gold,true);if(kind==='theatre')mask(16,9,C.purple,false);break;}
    case 'ghost': case 'slime': case 'jelly': {if(kind==='jelly'){ellipse(C.paper,1,25,30,6);poly(C.edge,[[9,5],[24,5],[29,27],[3,27]]);poly(C.purple,[[10,7],[23,7],[27,25],[5,25]]);ellipse(C.coral,9,3,15,6);for(const x of[10,16,22])line(C.pale,x,10,x-1,23);ellipse(C.white,12,5,4,1);}else if(kind==='ghost'){poly(C.edge,[[2,29],[2,13],[6,4],[14,1],[24,4],[29,13],[29,30],[23,26],[18,31],[12,26],[7,30]]);poly(C.paper,[[4,27],[4,13],[8,6],[14,3],[23,6],[27,13],[27,27],[23,24],[18,28],[12,23],[7,27]]);eye(10,12);eye(21,12);ellipse(C.ink,14,21,5,4);}else{poly(C.edge,[[1,27],[3,17],[10,10],[15,1],[19,10],[27,17],[31,27],[27,31],[5,31]]);poly(C.blue,[[3,26],[5,18],[12,12],[15,5],[18,13],[25,18],[29,26],[26,29],[6,29]]);ellipse(C.pale,7,17,4,6);eye(12,20);eye(23,20);line(C.ink,16,26,22,26);}break;}
    case 'skull': {circle(C.paper,3,1,27,24);box(C.paper,8,18,17,12);ellipse(C.ink,7,10,7,8);ellipse(C.ink,20,10,7,8);poly(C.ink,[[16,17],[19,22],[13,22]]);for(let x=11;x<24;x+=4)line(C.ink,x,25,x,29);break;}
    case 'heart': {ellipse(C.red,1,3,16,17);ellipse(C.red,15,3,16,17);poly(C.red,[[2,12],[30,12],[16,31]]);ellipse(C.coral,5,6,7,4);break;}
    // Sports and board games have readable pips, seams, symbols and feet.
    case 'ball': {circle(C.paper,1,1,30);poly(C.ink,[[16,9],[23,14],[20,22],[11,22],[9,14]]);for(let i=0;i<5;i++){const a=i*Math.PI*2/5;line(C.ink,16+Math.cos(a)*7,16+Math.sin(a)*7,16+Math.cos(a)*14,16+Math.sin(a)*14,2);}break;}
    case 'bowling': {circle(C.paper,11,0,10,12);poly(C.ink,[[12,10],[20,10],[20,16],[26,26],[24,31],[8,31],[6,26],[12,16]]);poly(C.paper,[[13,11],[19,11],[18,16],[24,26],[22,29],[10,29],[8,26],[14,16]]);rect(C.red,12,12,8,2);rect(C.red,12,16,8,2);break;}
    case 'chess': {poly(C.ink,[[9,25],[12,15],[10,8],[19,0],[26,10],[20,16],[23,26]]);box(C.ink,5,28,23,4);box(C.paper,7,24,19,4);poly(C.paper,[[11,24],[14,14],[12,8],[19,2],[24,10],[18,14],[21,24]]);rect(C.ink,21,8,2,2);line(C.wood,12,23,20,23);break;}
    case 'shogi': {poly(C.wood,[[15,1],[25,8],[30,30],[2,30],[7,8]]);poly(C.gold,[[15,3],[23,9],[27,28],[5,28],[9,9]]);rect(C.ink,10,11,12,2);rect(C.ink,15,9,2,15);rect(C.ink,11,18,10,2);rect(C.ink,9,24,15,2);break;}
    case 'dice': case 'domino': {box(C.paper,kind==='dice'?3:8,2,kind==='dice'?26:17,28);if(kind==='domino'){line(C.ink,9,16,23,16);for(const[x,y]of[[12,7],[20,12],[12,21],[20,26],[16,24]])circle(C.ink,x-1,y-1,3);}else for(const[x,y]of[[9,8],[23,8],[16,16],[9,24],[23,24]])circle(C.ink,x-2,y-2,4);break;}
    case 'puzzle': {poly(C.blue,[[2,8],[11,8],[11,3],[17,1],[21,4],[20,8],[29,8],[29,16],[24,16],[23,21],[29,22],[29,31],[20,31],[20,26],[15,24],[12,27],[12,31],[2,31],[2,22],[7,22],[9,17],[5,15],[2,16]]);line(C.pale,3,10,10,10);break;}
    case 'trophy': {ellipse(C.gold,1,4,30,14);ellipse(C.white,4,6,24,8);poly(C.wood,[[7,2],[25,2],[24,16],[18,21],[18,26],[25,27],[27,31],[5,31],[7,27],[14,26],[14,21],[8,16]]);poly(C.gold,[[9,4],[23,4],[22,15],[16,20],[10,15]]);rect(C.lightGold,11,5,2,9);rect(C.gold,15,20,2,7);rect(C.gold,8,28,16,2);break;}
    case 'medal': {poly(C.red,[[4,0],[12,0],[20,15],[13,18]]);poly(C.blue,[[21,0],[29,0],[20,18],[13,15]]);circle(C.gold,7,12,20);circle(C.lightGold,10,15,14);poly(C.wood,[[17,16],[19,20],[23,21],[20,24],[20,28],[17,26],[13,28],[14,23],[11,21],[15,20]]);break;}
    case 'coin': case 'ring': {circle(C.gold,3,2,26,28);if(kind==='ring')ellipse(undefined,7,6,18,20);else circle(C.wood,7,6,18,20);if(kind==='coin'){circle(C.lightGold,8,7,16,18);rect(C.wood,14,11,4,11);rect(C.wood,12,21,8,2);}else{poly(C.blue,[[13,0],[22,0],[26,5],[17,12],[8,5]]);line(C.pale,14,1,17,9);}break;}
    // Celestial and weather symbols are shaped, not arbitrary coloured squares.
    case 'cloud': {for(const[x,y,w,h]of[[1,14,17,12],[7,7,17,19],[18,11,14,15]])ellipse(C.pale,x,y,w,h);ellipse(C.white,4,14,12,8);ellipse(C.white,11,8,12,12);rect(C.paper,5,24,23,2);break;}
    case 'sun': {for(let i=0;i<12;i++){const a=i*Math.PI/6;line(C.gold,16+Math.cos(a)*12,16+Math.sin(a)*12,16+Math.cos(a)*15,16+Math.sin(a)*15,2);}circle(C.gold,6,6,21);circle(C.lightGold,8,8,17);ellipse(C.white,11,10,5,3);break;}
    case 'moon': {circle(C.gold,2,1,29);ellipse(undefined,14,-3,24,28);ellipse(C.lightGold,6,9,5,5);ellipse(C.wood,8,21,3,3);break;}
    case 'star': {poly(C.wood,[[16,0],[20,11],[32,12],[23,19],[26,31],[16,25],[5,31],[8,19],[0,12],[12,11]]);poly(C.gold,[[16,3],[19,13],[28,14],[21,19],[23,27],[16,23],[9,27],[11,19],[4,14],[13,13]]);line(C.lightGold,16,7,13,16);break;}
    case 'planet': {circle(C.blue,6,4,23);ellipse(C.pale,10,8,8,4);line(C.gold,1,23,30,10,3);line(C.wood,2,26,31,13);ellipse(C.green,17,20,7,4);break;}
    case 'comet': {poly(C.gold,[[2,27],[5,18],[31,0],[24,15],[29,10],[18,27]]);poly(C.lightGold,[[7,24],[13,14],[27,4],[16,24]]);circle(C.coral,1,18,14);circle(C.lightGold,4,21,8);break;}
    case 'lightning': {poly(C.gold,[[17,0],[28,0],[20,11],[29,11],[5,32],[11,19],[4,19]]);poly(C.lightGold,[[18,2],[24,2],[15,15],[23,14],[10,26],[14,17],[8,17]]);break;}
    case 'rainbow': {for(let i=0;i<6;i++){ellipse([C.red,C.gold,C.leaf,C.blue,C.purple,C.paper][i],i*2,3+i*2,32-i*4,49-i*4);}ellipse(undefined,12,15,8,25);rect(undefined,0,28,32,4);break;}
    case 'snow': {for(let i=0;i<6;i++){const a=i*Math.PI/3;const x=16+Math.cos(a)*14,y=16+Math.sin(a)*14;line(C.blue,16,16,x,y,2);for(const side of[-1,1])line(C.blue,16+Math.cos(a)*9,16+Math.sin(a)*9,16+Math.cos(a)*8+Math.cos(a+side*Math.PI/3)*6,16+Math.sin(a)*8+Math.sin(a+side*Math.PI/3)*6);}circle(C.pale,13,13,6);break;}
    case 'snowman': {circle(C.paper,5,14,23,18);circle(C.white,8,3,17);rect(C.ink,9,0,15,5);rect(C.ink,6,4,21,3);eye(12,9);eye(20,9);poly(C.red,[[16,12],[24,13],[16,15]]);rect(C.red,8,17,18,3);rect(C.red,21,19,4,9);for(const y of[22,26])circle(C.ink,14,y,3);break;}
    case 'fire': {poly(C.red,[[16,0],[20,12],[25,5],[31,23],[26,31],[6,31],[1,25],[7,8],[10,19]]);poly(C.gold,[[16,11],[20,21],[24,17],[26,26],[22,31],[10,30],[7,24]]);poly(C.lightGold,[[16,22],[20,28],[18,31],[13,31],[12,28]]);break;}
    // Festival, buildings and sculptures are drawn as little physical models.
    case 'balloon': {circle(C.red,6,0,23,24);ellipse(C.coral,10,4,5,9);poly(C.red,[[16,23],[20,27],[12,27]]);line(C.wood,16,27,18,31);break;}
    case 'umbrella': {poly(C.ink,[[16,1],[26,6],[32,17],[24,14],[17,17],[9,14],[0,17],[5,7]]);poly(C.blue,[[16,3],[24,7],[29,14],[23,12],[17,14],[9,12],[3,14],[7,8]]);line(C.pale,16,4,10,13);line(C.pale,17,4,22,13);line(C.wood,16,15,16,29,2);line(C.wood,16,29,10,29,2);line(C.wood,10,29,10,26,2);break;}
    case 'cone': {poly(C.ink,[[14,1],[18,1],[28,27],[4,27]]);poly(C.red,[[15,3],[17,3],[25,25],[7,25]]);rect(C.paper,12,10,9,4);rect(C.paper,9,19,15,3);box(C.edge,1,27,30,4);break;}
    case 'sign': {box(C.wood,1,2,30,18);box(C.paper,3,4,26,14);text(6,7,20,3);rect(C.wood,14,20,4,12);break;}
    case 'flag': {line(C.ink,4,0,4,31,2);poly(C.red,[[6,2],[20,2],[29,6],[25,15],[6,15]]);line(C.paper,7,8,25,8,2);box(C.wood,1,29,10,3);break;}
    case 'tent': {poly(C.ink,[[16,1],[32,29],[0,29]]);poly(C.red,[[16,4],[29,27],[3,27]]);poly(C.paper,[[16,7],[24,27],[8,27]]);poly(C.dark,[[16,13],[21,27],[11,27]]);line(C.gold,17,4,25,27);break;}
    case 'kite': {poly(C.ink,[[16,0],[29,12],[16,26],[3,12]]);poly(C.red,[[16,2],[27,12],[16,24],[5,12]]);poly(C.blue,[[16,2],[16,24],[5,12]]);line(C.gold,16,3,16,25);line(C.paper,5,12,27,12);line(C.wood,16,26,22,31);rect(C.red,18,28,5,2);break;}
    case 'fan': {const pts=[[16,28]];for(let i=0;i<=24;i++){const a=Math.PI+i*Math.PI/24;pts.push([16+Math.cos(a)*16,24+Math.sin(a)*23]);}poly(C.red,pts);for(let i=0;i<9;i++){const a=Math.PI+i*Math.PI/8;line(C.gold,16,28,16+Math.cos(a)*15,24+Math.sin(a)*22);}line(C.wood,16,24,16,31,2);break;}
    case 'lantern': {ellipse(C.red,4,4,25,24);for(const x of[10,16,22])line(C.coral,x,7,x,25);box(C.wood,8,2,17,4);box(C.wood,9,27,15,3);line(C.wood,16,0,16,2,2);line(C.gold,16,30,16,32,2);box(C.paper,13,11,7,11);text(14,14,4,2);break;}
    case 'bell': {poly(C.wood,[[12,3],[20,3],[24,9],[25,20],[30,25],[2,25],[7,20],[8,9]]);poly(C.gold,[[13,5],[19,5],[22,10],[23,21],[26,23],[6,23],[9,21],[10,10]]);circle(C.wood,12,26,9,5);line(C.lightGold,12,9,11,19,2);circle(C.gold,14,0,4);break;}
    case 'anchor': {line(C.edge,16,8,16,30,3);circle(C.metal,11,0,11);circle(C.white,14,3,5);line(C.metal,7,15,26,15,3);poly(C.metal,[[0,19],[10,22],[6,23],[15,28],[25,23],[21,22],[32,19],[29,28],[16,32],[3,28]]);break;}
    case 'windmill': {box(C.paper,11,13,12,19);poly(C.red,[[8,14],[16,5],[26,14]]);for(let i=0;i<4;i++){const a=i*Math.PI/2;line(C.wood,16,13,16+Math.cos(a)*13,13+Math.sin(a)*13,3);line(C.gold,16+Math.cos(a)*6,13+Math.sin(a)*6,16+Math.cos(a)*13,13+Math.sin(a)*13,5);}circle(C.ink,14,11,5);box(C.blue,14,24,6,8);break;}
    case 'ferris': {circle(C.metal,2,0,28);ellipse(C.white,4,2,24,24);for(let i=0;i<8;i++){const a=i*Math.PI/4,x=16+Math.cos(a)*12,y=14+Math.sin(a)*12;line(C.metal,16,14,x,y);box(i%2?C.red:C.blue,x-2,y-2,5,5);}line(C.wood,16,15,7,31,2);line(C.wood,16,15,26,31,2);circle(C.gold,13,11,6);break;}
    case 'pyramid': {poly(C.wood,[[16,0],[32,31],[0,31]]);poly(C.gold,[[16,3],[29,29],[3,29]]);poly(C.wood,[[16,3],[29,29],[16,27]]);for(let y=12;y<30;y+=5)line(C.lightGold,16-y*.4,y,16,y);break;}
    case 'column': {box(C.paper,5,1,22,5);box(C.paper,8,7,16,20);box(C.paper,4,27,24,5);for(const x of[11,16,21])line(C.metal,x,8,x,26);rect(C.white,9,8,1,18);break;}
    case 'statue': {circle(C.paper,10,0,12);poly(C.paper,[[8,12],[24,12],[28,21],[22,23],[21,29],[10,29],[9,23],[3,21]]);box(C.metal,4,28,24,4);line(C.edge,16,14,16,27);line(C.metal,12,14,10,23);eye(12,4);eye(19,4);break;}
    case 'vase': {poly(C.ink,[[10,0],[23,0],[21,8],[28,20],[27,29],[22,32],[9,32],[4,28],[4,21],[12,8]]);poly(C.blue,[[12,2],[21,2],[19,8],[26,21],[25,28],[21,30],[10,30],[6,27],[6,22],[14,8]]);line(C.pale,9,18,8,24,2);rect(C.gold,7,23,18,2);break;}
    case 'mountain': {poly(C.edge,[[17,0],[32,31],[0,31]]);poly(C.metal,[[17,3],[29,29],[3,29]]);poly(C.white,[[17,3],[22,13],[17,11],[14,16],[11,13]]);poly(C.green,[[3,29],[9,19],[16,29]]);break;}
    case 'bridge': {rect(C.wood,1,18,30,5);for(const x of[3,25])box(C.metal,x,0,4,30);line(C.edge,1,11,16,17);line(C.edge,16,17,31,11);for(let x=9;x<26;x+=4)line(C.metal,x,15,x,19);rect(C.gold,1,19,30,1);break;}
    case 'castle': {box(C.metal,7,9,19,22);box(C.paper,1,4,9,28);box(C.paper,23,4,9,28);for(const x of[1,7,23,29])rect(C.paper,x,0,3,6);for(const x of[4,26])box(C.dark,x,13,3,6);circle(C.dark,12,20,10,14);rect(C.dark,12,27,10,5);line(C.white,10,11,22,11);break;}
    case 'shell': { circle(C.gold,3,5,27,23); poly(C.gold,[[4,15],[16,29],[29,15]]); for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;line(C.wood,16,27,16+Math.cos(a)*12,16+Math.sin(a)*10);} ellipse(C.lightGold,9,8,5,3); break; }
    case 'cursor': { poly(C.ink,[[3,1],[28,20],[18,21],[24,30],[19,32],[13,23],[7,29]]); poly(C.white,[[5,5],[23,18],[15,19],[21,29],[20,29],[13,20],[8,25]]); break; }
    default: { const missing: never = kind; throw new Error('Missing incident illustration: ' + missing); }
  }
  const pixels: Pixel[] = [];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32;) {
    const color = grid[y * 32 + x]; if (color === undefined) { x++; continue; }
    let end = x + 1; while (end < 32 && grid[y * 32 + end] === color) end++;
    pixels.push({ color, x: x / 4, y: y / 4, w: (end - x) / 4, h: .25 }); x = end;
  }
  cache.set(kind, pixels); return pixels;
}
