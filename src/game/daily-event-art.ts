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
  if (event.theme === 'comic') return comicVisitorPixels(event.variant);
  if (event.scene.special === 'meteor') return meteorIllustration();
  if (event.scene.special && isVisitorCostume(event.scene.special)) return eventVisitorPixels(event.scene.special);
  const kind = event.scene.special === 'flood' ? 'duck' : event.scene.props[0];
  return eventPropPixels(kind).map(p=>({...p,x:4+p.x*5,y:4+p.y*5,w:p.w*5,h:p.h*5}));
}
// Canvas and Phaser share exactly the same pixel geometry.
export function drawEventPreview(canvas: HTMLCanvasElement, episode: DailyEpisode, roomId: RoomId = 'meeting', backingWidth: 384 | 960 = 960): void {
  const backingHeight = backingWidth * 2 / 3;
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) { canvas.width = backingWidth; canvas.height = backingHeight; }
  const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
  const stage = roomEventStage(episode, roomId, [], -1), scale = Math.min(canvas.width / 480, canvas.height / 320);
  ctx.fillStyle = '#eee3c8'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save(); ctx.translate((canvas.width - 480 * scale) / 2, (canvas.height - 320 * scale) / 2); ctx.scale(scale, scale);
  ctx.fillStyle = '#c9bca3'; ctx.fillRect(0, 0, 480, 320);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) { ctx.fillStyle = (x + y) % 2 ? '#ddd0b6' : '#d6c6a9'; ctx.fillRect(x * 16, y * 16, 15, 15); }
  ctx.fillStyle = '#b6a686'; ctx.fillRect(0, 0, 480, 13); ctx.fillRect(0, 0, 14, 320); ctx.fillRect(466, 0, 14, 320); ctx.fillRect(0, 306, 480, 14);
  for (const item of getRoom(roomId).furniture) {
    const x = item.x * 16, y = item.y * 16, w = item.w * 16, h = item.h * 16;
    if (stage.damage.some(shape => damageContains(shape, x + w / 2, y + h / 2))) continue;
    ctx.fillStyle = '#8c7e69'; ctx.fillRect(x, y, w, h); ctx.fillStyle = ['board', 'monitor', 'calendar'].includes(item.kind) ? '#e7e9d4' : '#b9a784'; ctx.fillRect(x + 3, y + 2, Math.max(1, w - 6), Math.max(1, h - 5));
  }
  const draw = (pixels: typeof stage.floor) => { for (const p of pixels) { ctx.globalAlpha = p.alpha; ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); } ctx.globalAlpha = 1; };
  const hero = () => { for (const p of eventPixels(episode)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(stage.hero.x + p.x * stage.hero.scale, stage.hero.y + p.y * stage.hero.scale, p.w * stage.hero.scale, p.h * stage.hero.scale); } };
  draw(stage.floor); if (stage.hero.y + 43 * stage.hero.scale < 210) hero(); draw(stage.scenery); if (stage.hero.y + 43 * stage.hero.scale >= 210) hero(); draw(stage.effects);
  if (episode.theme === 'kaiju' && getRoom(roomId).outlook !== 'none') {
    ctx.fillStyle = '#445b73'; ctx.fillRect(16, 0, 448, 56);
    for (const pixel of outsideEventPixels(episode)) { ctx.fillStyle = '#' + pixel.color.toString(16).padStart(6, '0'); ctx.fillRect(pixel.x, pixel.y, pixel.w, pixel.h); }
    ctx.fillStyle = '#cbb998'; for (const x of [16, 165, 314, 460]) ctx.fillRect(x, 0, 4, 56); ctx.fillRect(16, 53, 448, 3);
  }
  ctx.restore();
}
export function outsideEventPixels(event: DailyEpisode, width = 480, height = 56, frame = 0): Pixel[] {
  if (event.theme !== 'kaiju') return [];
  const out: Pixel[] = [], v = event.variant;
  const p = (color: number, x: number, y: number, w: number, h: number) => {
    const left=Math.max(0,Math.round(x*2)/2),top=Math.max(0,Math.round(y*2)/2),right=Math.min(width,Math.round((x+w)*2)/2),bottom=Math.min(height,Math.round((y+h)*2)/2);
    if(right>left&&bottom>top)out.push({color,x:left,y:top,w:right-left,h:bottom-top});
  };
  const size=Math.min(64,height-4),x=Math.round(width*.59-size/2)+(frame%3-1),y=Math.max(1,height-size-2);
  const prop=(kind: Parameters<typeof eventPropPixels>[0], xx:number, yy:number, w:number, h=w) => {for(const px of eventPropPixels(kind))p(px.color,xx+px.x*w/8,yy+px.y*h/8,px.w*w/8,px.h*h/8);};
  const kind = v===2 ? 'monkey' : event.scene.props[0];
  if(v===3){
    // A zeppelin: tapered gas envelope, ribs, suspension cables and a gondola.
    for(let yy=0;yy<24;yy+=.5){const half=Math.sqrt(Math.max(0,1-((yy-12)/12)**2))*43;p(0x9e8870,x+size/2-half,y+yy,half*2,.5);}
    for(let yy=1;yy<21;yy+=.5){const half=Math.sqrt(Math.max(0,1-((yy-11)/10)**2))*41;p(0xe5c996,x+size/2-half,y+yy,half*2,.5);}
    for(const dy of[5,10,16])p(0xbba37d,x+size/2-37,y+dy,74,.5);
    p(0x9e8870,x+size/2-15,y+22,1,8);p(0x9e8870,x+size/2+15,y+22,1,8);
    p(0x6c8997,x+size/2-16,y+28,33,10);for(let i=0;i<4;i++)p(0xc3d8cc,x+size/2-12+i*7,y+30,4,4);
    prop('sign',x+size/2-11,y+8,22,15);
  }else if(v===10){prop('rainbow',x-size*.45,y,size*1.9,size*.8);prop('rainbow',x-size*.1,y+size*.22,size*1.3,size*.65);}
  else if(v===13){
    for(let i=0;i<3;i++){prop('cloud',x-45+i*35,y+size*.55,44,22);prop('train',x-45+i*35,y+size*.28,36,30);}
  }else{
    if(v===6){p(0x6b886d,x-8,y+size*.68,size+16,size*.15);p(0x8a7d64,x,y+size*.83,size,size*.08);}
    prop(kind,x,y,size,size);
    if(v===2)prop('helmet',x+size*.26,y,size*.48,size*.3);
    if(v===5){p(0xdfb66d,x+size*.8,y+size*.36,size*.12,size*.31);p(0xfff7df,x+size*.81,y+size*.36,size*.04,size*.12);}
    if(v===6){p(0x9c724e,x+size*.15,y+size*.77,size*.7,.5);prop('shirt',x+size*.3,y+size*.73,8,9);prop('sock',x+size*.6,y+size*.73,7,9);}
    if(v===7)prop('sign',x+size*.7,y+size*.3,14,17);
    if(v===8)prop('envelope',x+size*.5,y+size*.7,15,10);
    if(v===11||v===14)for(let i=0;i<4;i++)prop('star',x-14-i*10,y+5+(i*11)%Math.max(1,Math.floor(size-10)),5);
    if(v===12)prop('sign',x+size*.72,y+size*.55,13,15);
  }
  return out;
}
