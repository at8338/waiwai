import type { Pixel } from './avatar.ts';
import { buddyPixels } from './buddies.ts';
import { eventDrawing } from './event-drawing.ts';
import { eventVisitorPixels } from './event-visitors.ts';
const cache=new Map<number,Pixel[]>();
export function comicVisitorPixels(variant: number): Pixel[] {
  // Pokémon keeps the existing sprite, as in its buddy/journal view.
  if(variant===9)return buddyPixels('pikachu','down',0).map(p=>({...p,x:6+p.x*1.7,y:5+p.y*1.7,w:p.w*1.7,h:p.h*1.7}));
  const previous=cache.get(variant);if(previous)return previous;
  const {rect:p,poly,oval,line,pixels}=eventDrawing(48,48);
  const ink=0x34414e,white=0xfff5df,blue=0x669fbd,red=0xcc625c,gold=0xe6be78,skin=0xebbf99;
  const eye=(x:number,y:number)=>{oval(ink,x,y,2,3);p(white,x,y,.5,.5);};
  const disc=(c:number,x:number,y:number,w:number,h=w)=>{oval(ink,x,y,w,h);oval(c,x+.5,y+.5,w-1,h-1);};
  const person=(coat:number,hair:number)=>{
    const base=eventVisitorPixels('momotaro');
    for(const px of base){if(px.x>=34)continue;const c=px.color===0xf0e9d7?coat:px.color===0x5b4c43?hair:px.color===0xc95f5a?hair:px.color;p(c,px.x,px.y,Math.min(px.w,34-px.x),px.h);}
  };
  if(variant===0){ // Round blue robot cat, pocket, collar, bell and whiskers.
    disc(blue,12,21,26,23);disc(white,16,25,18,15);disc(white,9,39,14,7);disc(white,27,39,14,7);
    disc(blue,7,1,35,31);disc(white,10,8,29,23);disc(white,17,4,8,11);disc(white,25,4,8,11);eye(21,9);eye(26,9);
    disc(red,22,13,5);line(ink,24,18,24,23);line(ink,19,25,29,25);for(const side of[-1,1])for(let i=0;i<3;i++)line(ink,24+side*8,19+i*2,24+side*14,17+i*4);
    p(red,13,29,24,3);disc(gold,22,30,6);line(ink,23,33,27,33);disc(white,8,28,7);disc(white,35,28,7);poly(ink,[[18,35],[32,35],[30,39],[21,40]]);poly(white,[[19,35.5],[31,35.5],[29,38],[22,39]]);
  }else if(variant===1||variant===2||variant===3){
    person(variant===2?red:0xe49b52,variant===3?gold:ink);
    if(variant===1){poly(ink,[[15,12],[12,7],[17,7],[14,1],[21,5],[24,0],[27,5],[33,2],[31,8],[35,9],[31,13]]);p(blue,18,33,13,3);p(blue,19,26,3,5);disc(white,27,27,4);p(ink,28,28,2,2);}
    if(variant===2){oval(0xb18a54,11,6,27,6);oval(gold,16,0,18,11);p(red,16,6,17,2);p(skin,21,25,6,9);line(ink,24,27,24,31,.5);p(gold,19,30,1,1);p(gold,29,30,1,1);}
    if(variant===3){poly(gold,[[16,11],[14,6],[18,6],[18,1],[23,5],[26,0],[29,5],[34,3],[32,10]]);p(blue,16,10,17,4);p(0xb9c4c3,20,10.5,9,2.5);line(ink,23,11,26,11);line(ink,24,11,24,12);for(const y of[17,19]){line(0x9b6e62,18,y,21,y+.5);line(0x9b6e62,28,y,31,y-.5);}p(blue,18,34,13,2);}
  }else if(variant===4||variant===8||variant===11||variant===12){
    person(variant===11?red:blue,variant===12?gold:variant===4?0x8c7aa5:ink);
    if(variant===4){p(0x8c7aa5,14,8,4,18);p(0x8c7aa5,30,8,4,18);p(white,18,26,13,10);p(blue,20,28,10,10);oval(red,15,1,19,10);p(red,13,9,23,2);p(white,21,4,7,1);p(white,23,5,3,2);}
    if(variant===4||variant===8){for(const x of[17,25]){p(ink,x,13,7,6);p(skin,x+.5,13.5,6,5);eye(x+3,14);}line(ink,23,14,26,14);}
    if(variant===8){p(white,21,26,7,9);poly(red,[[19,25],[24,27],[29,25],[28,30],[24,28],[20,30]]);p(blue,18,35,12,6);p(skin,19,41,3,2);p(skin,26,41,3,2);}
    if(variant===11){oval(red,15,1,19,11);p(red,13,9,23,3);disc(white,22,3,8);line(red,24,8,24,5);line(red,24,5,26,7);line(red,26,7,28,5);line(red,28,5,28,8);p(blue,18,28,13,12);p(red,23,28,3,6);p(gold,19,30,2,2);p(gold,28,30,2,2);oval(0x6c5144,20,18,10,3);}
    if(variant===12){disc(gold,13,4,7);disc(gold,30,4,7);p(gold,13,9,3,27);p(gold,33,9,3,27);p(white,18,25,13,9);poly(blue,[[18,25],[24,30],[31,25],[28,31],[21,31]]);poly(red,[[20,29],[24,31],[28,29],[28,34],[24,32],[20,34]]);p(blue,17,35,15,6);p(red,18,43,6,3);p(red,26,43,6,3);line(gold,18,11,30,11);disc(red,23,10,3);}
  }else if(variant===5){
    poly(ink,[[12,22],[34,22],[39,38],[33,38],[32,44],[17,44],[16,38],[9,37]]);poly(red,[[14,23],[32,23],[36,36],[30,36],[30,42],[19,42],[18,36],[12,35]]);p(gold,17,35,15,3);disc(gold,8,32,8);disc(gold,33,32,8);disc(gold,16,41,8,5);disc(gold,26,41,8,5);
    disc(0xd6a273,9,1,31,27);eye(18,10);eye(29,10);for(const x of[11,21,31])disc(red,x,15,x===21?8:6,6);line(ink,20,23,29,23);p(white,21,23,6,1);
  }else if(variant===6){
    person(0x41434f,ink);p(ink,14,7,4,22);p(ink,30,7,4,22);poly(0x41434f,[[18,30],[31,30],[35,43],[13,43]]);poly(red,[[16,3],[24,7],[22,1],[29,1],[28,7],[36,3],[35,13],[27,10],[23,12],[16,10]]);disc(ink,0,33,9,12);poly(ink,[[1,35],[0,29],[4,32],[7,29],[8,35]]);p(gold,2,36,1,1);p(gold,6,36,1,1);
  }else if(variant===7){
    disc(0x8f9d94,8,16,31,29);disc(white,13,25,22,17);poly(ink,[[11,19],[12,1],[18,1],[21,20],[27,20],[29,1],[35,1],[37,20]]);poly(0x8f9d94,[[12,19],[13,2],[17,2],[21,21],[28,21],[30,2],[34,2],[36,21]]);disc(0x8f9d94,10,12,29,20);disc(white,15,17,7);disc(white,29,17,7);eye(18,18);eye(31,18);poly(ink,[[22,23],[28,23],[25,26]]);for(const y of[30,35])for(const x of[17,25])poly(0x8f9d94,[[x,y+2],[x+3,y],[x+6,y+2],[x+3,y+1]]);for(const side of[-1,1])line(ink,24+side*9,26,24+side*17,25);
  }else if(variant===10){
    disc(0xc95d85,4,35,16,10);disc(0xc95d85,29,35,16,10);disc(0xe7a2ba,6,8,36,34);disc(0xe7a2ba,0,25,12,11);disc(0xe7a2ba,37,23,11,11);oval(ink,17,17,3,8);oval(ink,28,17,3,8);p(white,17.5,18,1,3);p(white,28.5,18,1,3);oval(0xd2759b,10,27,6,3);oval(0xd2759b,33,27,6,3);line(ink,23,30,27,30);oval(0xf3c2d0,12,13,8,3);
  }else{
    disc(white,15,23,19,20);disc(white,13,37,12,8);disc(white,27,37,12,8);disc(white,7,4,31,22);disc(white,27,11,17,12);oval(ink,9,8,7,18);eye(27,10);oval(ink,39,14,6,4);line(ink,30,22,37,22);p(red,16,25,17,2);line(ink,15,32,9,32,1);line(ink,33,32,39,32,1);
  }
  const out=pixels();cache.set(variant,out);return out;
}
