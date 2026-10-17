import { furniturePixels } from './furniture-art.ts';
import { incidentCastPixels } from './incident-cast.ts';
import { isWall } from './world.ts';
import { comicVisitorPixels } from './event-comic-art.ts';
import { eventVisitorPixels, isVisitorCostume, meteorIllustration } from './event-visitors.ts';
import { roomEventStage } from './daily-event-stage.ts';
import { damageContains } from './daily-event-stage.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import type { Pixel } from './avatar.ts';
import type { DailyEpisode } from './daily-event-catalog.ts';
import { eventPropPixels } from './event-props.ts';
// Bespoke visitor portraits plus icons of the authored scene's main prop.
export function eventPixels(event: DailyEpisode, _frame = 0): Pixel[] {
  if (!event.direction.approved && event.direction.cast[0]) return incidentCastPixels(event.direction.cast[0]);
  if (event.theme === 'comic') return comicVisitorPixels(event.variant);
  if (event.scene.special === 'meteor') return meteorIllustration();
  if (event.scene.special && isVisitorCostume(event.scene.special)) return eventVisitorPixels(event.scene.special);
  const kind = event.scene.special === 'flood' ? 'duck' : event.scene.props[0];
  return eventPropPixels(kind).map(p=>({...p,x:4+p.x*5,y:4+p.y*5,w:p.w*5,h:p.h*5}));
}
// Canvas and Phaser share exactly the same pixel geometry.
export function drawEventPreview(canvas: HTMLCanvasElement, episode: DailyEpisode, roomId: RoomId = episode.direction.room, backingWidth: 384 | 960 = 960): void {
  const backingHeight = backingWidth * 2 / 3;
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) { canvas.width = backingWidth; canvas.height = backingHeight; }
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  const stage = roomEventStage(episode, roomId, [], -1), scale = Math.min(canvas.width / 480, canvas.height / 320);
  ctx.fillStyle = '#eee3c8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate((canvas.width - 480 * scale) / 2, (canvas.height - 320 * scale) / 2); ctx.scale(scale, scale);
  const room = getRoom(roomId);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) {
    ctx.fillStyle = '#' + (isWall(x,y,roomId)?room.wall:(x+y)%3?room.floor:room.grain).toString(16).padStart(6,'0');
    ctx.fillRect(x*16,y*16,16,16);
    ctx.fillStyle = '#' + room.grain.toString(16).padStart(6,'0');ctx.fillRect(x*16,y*16+15,16,.5);
  }
  for(const section of room.sections??[]){ctx.fillStyle='#'+section.color.toString(16).padStart(6,'0');ctx.globalAlpha=.3;ctx.fillRect((section.x+1)*16,(section.y+1)*16,(section.w-2)*16,(section.h-2)*16);ctx.globalAlpha=1;}
  for(const item of room.furniture){
    if (stage.damage.some(shape => damageContains(shape, (item.x+item.w/2)*16, (item.y+item.h/2)*16))) continue;
    for(const px of furniturePixels(item)){ctx.fillStyle='#'+px.color.toString(16).padStart(6,'0');ctx.fillRect(px.x,px.y,px.w,px.h);}
  }
  const draw = (pixels: typeof stage.floor) => { for (const p of pixels) { ctx.globalAlpha = p.alpha; ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); } ctx.globalAlpha = 1; };
  const hero = () => { for (const p of eventPixels(episode)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(stage.hero.x + p.x * stage.hero.scale, stage.hero.y + p.y * stage.hero.scale, p.w * stage.hero.scale, p.h * stage.hero.scale); } };
  draw(stage.floor); if (stage.hero.y + 43 * stage.hero.scale < 210) hero(); draw(stage.scenery); if (stage.hero.y + 43 * stage.hero.scale >= 210) hero(); draw(stage.effects);
  if (episode.direction.beat === 'outside' && getRoom(roomId).outlook !== 'none') {
    ctx.fillStyle = '#445b73'; ctx.fillRect(16, 0, 448, 56);
    for (const pixel of outsideEventPixels(episode)) { ctx.fillStyle = '#' + pixel.color.toString(16).padStart(6, '0'); ctx.fillRect(pixel.x, pixel.y, pixel.w, pixel.h); }
    ctx.fillStyle = '#cbb998'; for (const x of [16, 165, 314, 460]) ctx.fillRect(x, 0, 4, 56); ctx.fillRect(16, 53, 448, 3);
  }
  ctx.restore();
}
export function outsideEventPixels(event: DailyEpisode, width = 480, height = 56, frame = 0): Pixel[] {
  if (event.direction.beat !== 'outside') return [];
  const out: Pixel[] = [];
  const p = (color: number, x: number, y: number, w: number, h: number) => {
    const left=Math.max(0,Math.round(x*2)/2),top=Math.max(0,Math.round(y*2)/2),right=Math.min(width,Math.round((x+w)*2)/2),bottom=Math.min(height,Math.round((y+h)*2)/2);
    if(right>left&&bottom>top)out.push({color,x:left,y:top,w:right-left,h:bottom-top});
  };
  const size=Math.min(64,height-4),x=Math.round(width*.59-size/2)+(frame%3-1),y=Math.max(1,height-size-2);
  const prop=(kind: Parameters<typeof eventPropPixels>[0], xx:number, yy:number, w:number, h=w) => {for(const px of eventPropPixels(kind))p(px.color,xx+px.x*w/8,yy+px.y*h/8,px.w*w/8,px.h*h/8);};
  const kind = event.scene.props[0];
  const cast=event.direction.cast[0];
  if(cast==='rainbow'){prop('rainbow',width*.2,1,width*.6,height*.8);prop('rainbow',width*.3,height*.2,width*.4,height*.6);}
  else if(cast==='catbus'){prop('bus',x-10,y+10,size*1.4,size*.6);prop('cat',x-15,y+2,27,30);for(let i=0;i<6;i++){p(0x7e684b,x+i*10,y+size*.65,4,8);}}
  else if(cast==='train'){for(let i=0;i<3;i++)prop('train',x-42+i*34,y+8,32,30);p(0xd6d4b1,x-45,y+38,115,1);}
  else if(cast==='zeppelin'){
    for(let yy=0;yy<24;yy+=.5){const half=Math.sqrt(Math.max(0,1-((yy-12)/12)**2))*43;p(0xdac58e,x+size/2-half,y+yy,half*2,.5);}
    p(0x5a7480,x+size/2-16,y+24,32,10);for(let i=0;i<4;i++)p(0xc9dfd6,x+size/2-12+i*7,y+26,4,4);
  }else if(cast==='laputa'){
    // Floating island: tapered rock underside, hanging roots, terraces and a crown tree.
    const cx=x+size/2,top=y+size*.45;
    for(let row=0;row<22;row++){const half=38-row*1.25;p(row%4?0x776f58:0x9c9671,cx-half,top+row,half*2,1);}
    p(0x93a878,cx-38,top-3,76,4);p(0xc2ba8c,cx-25,top-8,48,5);
    for(let i=0;i<5;i++){p(0xd5c69b,cx-25+i*10,top-16+i%2*3,7,11);p(0x4b6565,cx-23+i*10,top-13+i%2*3,2,4);}
    p(0x71664c,cx-2,top-25,5,17);
    for(const [dx,dy,w]of[[-18,-29,38],[-29,-23,54],[-24,-17,47]]){p(0x4f795f,cx+dx,top+dy,w,7);p(0x78976a,cx+dx+3,top+dy,w-6,2);}
    for(let i=0;i<5;i++)p(0x657850,cx-13+i*6,top+12,1,10-i%3*2);
    for(const dx of[-48,36]){p(0xdbe6d9,cx+dx,top+17,23,3);p(0xdbe6d9,cx+dx+4,top+14,13,3);}
  }else if(cast==='godzilla'){
    // A side-on silhouette with a long tail and saw-toothed dorsal plates.
    const cx=x+size/2,bottom=height-2;
    for(let i=0;i<26;i++){const half=Math.sqrt(Math.max(0,1-((i-13)/13)**2))*17;p(0x405e52,cx-half,bottom-34+i,half*2,1);}
    p(0x496c5a,cx+4,bottom-45,16,25);p(0x496c5a,cx+12,bottom-49,20,13);p(0x496c5a,cx+26,bottom-43,12,7);
    p(0xd7c488,cx+26,bottom-46,2,1);p(0x293f3c,cx+28,bottom-38,10,1);
    for(let i=0;i<7;i++){p(0x3a594e,cx-17-i*5,bottom-17+i,8,Math.max(2,11-i));}
    for(let i=0;i<6;i++){p(i%2?0x9bb7a4:0x7c9d89,cx-18+i*4,bottom-31-i*3,5,5);}
    p(0x345547,cx-8,bottom-12,10,12);p(0x4c705a,cx+8,bottom-12,11,12);p(0x345547,cx+12,bottom-28,14,5);
  }else if(cast==='haku'){
    for(let i=0;i<25;i++){const yy=y+size*.5+Math.sin(i/4)*8;p(0x80aaa5,x-25+i*4,yy-3,8,9);p(0xe4e8d7,x-25+i*4,yy-2,8,5);}
    p(0xb8d3c6,x+68,y+size*.5-9,18,10);p(0xe4e8d7,x+72,y+size*.5-7,20,6);p(0x445e5c,x+82,y+size*.5-6,1,1);
    p(0xa9c8ba,x+70,y+size*.5-15,2,9);p(0xa9c8ba,x+78,y+size*.5-16,2,10);
  }
  else {prop(kind,x,y,size,size);if(cast==='kong')prop('paper',x+size*.55,y+size*.6,12,9);}

  return out;
}
