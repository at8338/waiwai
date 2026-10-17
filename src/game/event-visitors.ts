import { eventDrawing } from './event-drawing.ts';
import type { Pixel } from './avatar.ts';
const COSTUMES = {
  thief:0x536976,santa:0xc65d58,ghost:0xb9aa86,waldo:0xf4ecd6,terminator:0x414854,momotaro:0xf0e9d7,kaguya:0xbf8eaa,alice:0x74a6bf,oz:0x77a9c1,magic:0x8e7aa8,festival:0x567e9c,
} as const;
export type VisitorCostume = keyof typeof COSTUMES;
export function isVisitorCostume(value: string): value is VisitorCostume { return Object.hasOwn(COSTUMES,value); }
const visitors = new Map<VisitorCostume, Pixel[]>();
export function eventVisitorPixels(kind: VisitorCostume): Pixel[] {
  const previous=visitors.get(kind);if(previous)return previous;
  const {rect:p,poly,oval,line,pixels}=eventDrawing(48,48);
  const ink=0x34414e,white=0xfff5df,skin=0xebbf99,shade=0xc08f76,gold=0xe3bc77,red=0xc95f5a,blue=0x668fba,coat=COSTUMES[kind];
  // Body and limbs: angled shoulders, cuffed sleeves, separate trouser legs.
  poly(ink,[[15,23],[32,23],[37,28],[38,36],[34,38],[30,34],[30,42],[18,42],[17,34],[13,38],[9,36],[11,28]]);
  poly(coat,[[16,24],[30,24],[35,28],[36,34],[33,35],[29,30],[29,38],[18,38],[18,30],[13,35],[11,34],[13,28]]);
  p(0x556778,18,37,5,7);p(0x556778,25,37,5,7);p(ink,17,43,7,3);p(ink,25,43,8,3);p(0x89989a,18,45,5,.5);p(0x89989a,26,45,6,.5);
  oval(skin,10,34,5,4);oval(skin,33,34,5,4);p(shade,11,36,3,.5);p(shade,34,36,3,.5);
  // Neck, face, ears and swept hair. Half-unit details remain legible at map scale.
  p(shade,21,21,6,5);oval(shade,14,13,4,6);oval(shade,30,13,4,6);
  poly(ink,[[18,6],[29,6],[33,10],[32,20],[28,24],[20,24],[16,20],[15,11]]);
  poly(skin,[[19,8],[28,8],[31,11],[30,20],[27,23],[21,23],[18,20],[17,12]]);
  poly(0x5b4c43,[[16,13],[16,8],[20,4],[29,5],[32,8],[32,13],[28,9],[26,10],[21,8],[18,14]]);
  line(0x8b6a50,18,9,22,6);line(0x8b6a50,24,6,29,7);
  p(ink,20,14,1.5,2);p(ink,27,14,1.5,2);p(white,20,14,.5,.5);p(white,27,14,.5,.5);
  line(0x7f6553,19.5,12.5,22,12.5);line(0x7f6553,26.5,12.5,29,12.5);
  p(shade,24,16,1,2);line(0x9b6e62,22,20,26,20);p(0xf7d3b0,19,17,.5,2);
  // Collars, placket, pockets and buttons make the clothes read as clothing.
  poly(white,[[19,24],[23,27],[21,29],[18,25]]);poly(white,[[28,24],[24,27],[26,29],[30,25]]);
  line(0x52616c,24,28,24,37);for(const y of[30,33,36])p(gold,24.5,y,.5,.5);
  line(0x52616c,19,35,22,35);line(0x52616c,27,35,29,35);line(white,11,33,14,34);line(white,33,34,36,33);
  if(kind==='santa'){
    poly(red,[[14,10],[18,2],[27,1],[35,7],[33,11],[28,6],[25,7],[21,10]]);oval(white,32,7,5,5);p(white,15,10,18,3);
    poly(ink,[[16.5,18],[21,19],[25,20],[31.5,18],[31,24],[26,29],[20,27],[17,23]]);
    poly(white,[[17.5,18.5],[21,20],[25,21],[30.5,18.5],[30,23.5],[25.5,28],[20.5,26],[18,22.5]]);
    oval(white,20,18,5,2);oval(white,25,18,5,2);oval(0xd39b85,23,17.5,4,2);
    p(white,16,12,1.5,5);p(white,31,12,1,5);line(white,20,12,22,12);line(white,27,12,29,12);
    p(white,22.5,28,3,10);p(ink,16,34,16,3);p(gold,22,33,5,5);p(ink,23,34,3,3);
    p(white,16,38,15,2);oval(0x94724e,35,29,11,15);poly(0xc19a64,[[37,31],[38,24],[43,24],[44,31]]);line(ink,37,28,43,28);
  }else if(kind==='waldo'){
    for(const y of[25,30,35])p(red,18,y,12,2);p(blue,18,38,12,5);
    poly(red,[[17,9],[18,5],[23,2],[28,4],[31,9]]);p(white,17,9,15,3);oval(white,23,0,4,4);p(white,18,6,12,1.5);
    for(const x of[18,25]){p(ink,x,13,6,5);p(skin,x+.5,13.5,5,4);}p(ink,24,14,1,1);p(ink,20,14,1,2);p(ink,27,14,1,2);
    line(gold,39,19,39,46,1);oval(gold,36,17,4,4);
  }else if(kind==='thief'){
    poly(0x3d5261,[[15,11],[16,6],[23,3],[30,5],[33,10]]);p(0x283f50,16,12,16,5);p(white,19,13,3,1.5);p(white,27,13,3,1.5);
    for(const y of[28,32,36])p(0x99a5a5,18,y,11,.5);
    oval(0xac8a5d,32,28,14,16);poly(0xd1af75,[[35,30],[35,24],[42,25],[43,30]]);line(ink,34,28,43,28);line(0x795c43,36,33,41,39);line(0x795c43,41,33,36,39);
  }else if(kind==='terminator'){
    p(ink,17,12,16,5);p(0xd65e56,28,13,3,1);poly(0xaebbc0,[[30,17],[32,18],[30,23],[27,22]]);p(white,30,18,.5,2);
    poly(0x8e9ba1,[[19,24],[24,29],[21,32],[19,28]]);poly(0x8e9ba1,[[29,24],[24,29],[27,32],[30,28]]);
    line(0xb7c2c2,24,29,24,37);line(0x8c989e,18,35,21,34);p(ink,29,31,17,3);p(0x9caaae,34,31.5,11,.5);p(ink,37,33,3,6);p(gold,39,34,3,.5);
  }else if(kind==='ghost'){
    p(0x485966,8,23,7,14);p(0x8baa92,9,24,2,10);p(0x273f4c,11,24,2,10);line(0x556b66,15,25,20,37,1);
    p(white,27,26,4,5);oval(red,27,26,4,4);line(white,27,26,31,30,.5);p(ink,32,30,14,3);p(0x91bdba,41,29,4,1);line(0x344a52,33,32,30,38,1);
    p(0x537483,20,30,3,2);line(gold,21,32,21,34,.5);
  }else if(kind==='momotaro'){
    p(red,16,10,16,2);oval(red,22,9,5,4);p(blue,18,33,12,7);p(gold,18,33,12,1);line(blue,19,25,21,32);line(blue,28,25,26,32);
    line(0x99744e,38,8,38,42);poly(white,[[39,8],[47,9],[47,24],[39,23]]);oval(0xe5a39c,40,13,6,7);p(0x7da06a,42,12,3,1);
  }else if(kind==='kaguya'){
    p(ink,15,9,3,21);p(ink,30,9,3,21);poly(coat,[[18,30],[30,30],[36,44],[12,44]]);p(0xe2bbcd,14,40,20,3);
    line(white,19,25,29,35,1);line(white,29,25,22,34,1);p(gold,18,33,13,4);p(0xf4d595,20,34,9,1);line(gold,16,8,31,8);oval(gold,14,6,4,4);oval(gold,29,6,4,4);
  }else if(kind==='alice'||kind==='oz'){
    p(gold,15,9,3,20);p(gold,30,9,3,20);poly(coat,[[18,32],[30,32],[35,41],[13,41]]);poly(white,[[20,25],[28,25],[27,32],[31,40],[17,40],[21,32]]);
    if(kind==='oz'){for(let x=19;x<30;x+=3)for(let y=34;y<40;y+=3)p(0xa5c8d3,x,y,1.5,1.5);p(red,17,43,7,3);p(red,25,43,8,3);}else{line(ink,16,8,31,8);p(ink,23,7,3,3);p(white,18,40,14,2);}
  }else if(kind==='magic'){
    poly(0x655579,[[11,11],[20,8],[27,0],[31,10],[38,12],[37,15],[11,15]]);poly(coat,[[16,10],[24,2],[27,11],[34,13],[14,13]]);p(gold,21,10,9,1);
    p(ink,20,17,1.5,2);p(ink,27,17,1.5,2);
    poly(ink,[[16.5,20],[23,21],[30.5,20],[30,25],[24,32],[17,25]]);poly(0xe5d8bd,[[17.5,20.5],[23,22],[29.5,20.5],[29,25],[24,31],[18,25]]);poly(coat,[[17,31],[30,31],[35,45],[12,45]]);line(gold,40,11,40,45,1);oval(0xb3d5d4,37,6,7,7);p(white,38,7,1,2);
  }else if(kind==='festival'){
    p(white,16,10,16,2);oval(red,23,9,3,3);line(white,19,25,21,35);line(white,28,25,26,35);p(gold,18,33,12,2);p(white,17,40,6,2);p(white,25,40,6,2);
    oval(red,35,26,10,11);line(0x99744e,40,35,40,43);line(white,36,30,44,30);
  }
  const out=pixels();visitors.set(kind,out);return out;
}
let meteor: Pixel[] | undefined;
export function meteorIllustration(): Pixel[] {
  if (meteor) return meteor;
  const {poly,line,oval,pixels}=eventDrawing(48,48);
  poly(0x3b424c,[[2,34],[6,20],[15,6],[31,2],[41,13],[46,30],[40,42],[22,47],[7,42]]);
  poly(0x78878b,[[4,33],[8,21],[16,8],[30,4],[39,14],[44,29],[39,40],[22,44],[9,40]]);
  poly(0xa4b0ad,[[8,21],[16,8],[30,4],[28,17],[18,28],[7,31]]);
  poly(0x576873,[[28,17],[39,14],[44,29],[39,40],[29,42],[32,28]]);
  poly(0x87969b,[[18,28],[28,17],[32,28],[29,42],[22,44],[11,37]]);
  oval(0x526570,15,13,7,5);oval(0x829495,16,13,5,2);oval(0x455964,31,28,7,9);oval(0x3e535d,10,32,4,4);
  line(0x415761,27,6,26,13,1);line(0x415761,26,13,30,18,1);line(0xd7b480,26,8,25,13,.5);
  line(0xf0bf76,5,33,14,37,1);line(0xf0bf76,14,37,21,44,1);line(0xdf995f,39,17,41,25,1);
  line(0xd0d8c7,17,9,26,6,.5);line(0xb5c4bf,8,23,9,27,.5);line(0xb5c4bf,20,31,24,29,.5);
  meteor = pixels(); return meteor;
}
