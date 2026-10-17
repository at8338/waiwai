import type { DailyEpisode } from './daily-event-catalog.ts';
import type { EventStage, StagePixel } from './daily-event-stage.ts';
import type { RoomId } from './rooms.ts';
import { ANCHOR_LABELS } from './incident-script.ts';
import { getRoom } from './rooms.ts';
import type { Furniture } from './world.ts';
import { walkableWithObjects, objectContains } from './objects.ts';
import type { RoomObject } from './objects.ts';
import { seatSpots } from './seating.ts';
import { touchingVehicleDock } from './transport.ts';
import { eventPropPixels } from './event-props.ts';
import type { EventProp } from './event-props.ts';
import { incidentCastPixels } from './incident-cast.ts';

export type IncidentPlacement = { role:'visitor'|'prop'; x:number;y:number;w:number;h:number; support?:Furniture['kind'] };
export function incidentAnchor(episode:DailyEpisode,roomId:RoomId):Furniture|undefined {
  const room=getRoom(roomId), kind=episode.direction.anchor;
  let choices=room.furniture.filter(f=>f.kind===kind);
  const named=choices.filter(f=>f.label&&(episode.title+episode.discovery).includes(f.label));if(named.length)choices=named;
  const section=room.sections?.find(s=>(episode.title+episode.discovery).includes(s.name));
  if(section){const local=choices.filter(f=>f.x>=section.x&&f.x<section.x+section.w&&f.y>=section.y&&f.y<section.y+section.h);if(local.length)choices=local;}
  return choices[episode.variant%choices.length];
}
const sizeFor=(kind:EventProp)=>kind==='door'?26:['car','boat','castle','train','tent','dinosaur','helicopter','robot'].includes(kind)?18:['peach','cup','coin','seed','clip','stamp','key','fork','egg','card'].includes(kind)?8:12;
export function directedIncidentStage(episode:DailyEpisode,roomId:RoomId,objects:readonly RoomObject[],frame:number):EventStage {
  const room=getRoom(roomId), anchor=incidentAnchor(episode,roomId);
  const stage:EventStage={floor:[],scenery:[],effects:[],damage:[],inspectAreas:[],placements:[],hero:{x:0,y:0,scale:0},caption:`${room.name}の${anchor?.label??(anchor&&ANCHOR_LABELS[anchor.kind])??'空いた場所'}で起きた一幕。${episode.discovery}`};
  if(!anchor)return stage; // A developer's incompatible room override must never invent furniture.
  const placements=stage.placements!, seats=seatSpots(roomId,objects);
  let layer:StagePixel[]=stage.scenery;
  const p=(color:number,x:number,y:number,w:number,h:number,alpha=1)=>{
    const l=Math.max(0,Math.round(x*2)/2),t=Math.max(0,Math.round(y*2)/2),r=Math.min(480,Math.round((x+w)*2)/2),b=Math.min(320,Math.round((y+h)*2)/2);
    if(r>l&&b>t)layer.push({color,x:l,y:t,w:r-l,h:b-t,alpha});
  };
  const line=(c:number,x:number,y:number,xx:number,yy:number,a=1)=>{const n=Math.ceil(Math.max(Math.abs(xx-x),Math.abs(yy-y))*2);for(let i=0;i<=n;i++)p(c,x+(xx-x)*i/Math.max(1,n),y+(yy-y)*i/Math.max(1,n),.5,.5,a);};
  const ring=(c:number,x:number,y:number,w:number,h:number,a=1)=>{for(let i=0;i<80;i++){const angle=i/80*Math.PI*2;p(c,x+Math.cos(angle)*w/2,y+Math.sin(angle)*h/2,1,1,a);}};
  const ink=0x3a505b,gold=0xd9b974,white=0xfff2d5,blue=0x8fc8cf,pink=0xc997ae;
  const ax=anchor.x*16,ay=anchor.y*16,aw=anchor.w*16,ah=anchor.h*16;
  const clearTile=(x:number,y:number)=>walkableWithObjects(x,y,roomId,objects)&&!objects.some(o=>o.roomId===roomId&&objectContains(o,x,y))
    &&!touchingVehicleDock({roomId,x,y})&&!seats.has(`${x},${y}`)&&[room.spawn,room.door].every(q=>Math.abs(q.x-x)+Math.abs(q.y-y)>2);
  const signs=room.furniture.filter(f=>f.label).map(f=>({x:(f.x+f.w/2)*16-(f.label!.length*8+6)/2,y:(f.y+f.h)*16+3,w:f.label!.length*8+6,h:14}));
  const clearRect=(x:number,y:number,w:number,h:number)=>{
    if(x<16||y<18||x+w>464||y+h>296)return false;
    for(let ty=Math.floor(y/16);ty<=Math.floor((y+h-.01)/16);ty++)for(let tx=Math.floor(x/16);tx<=Math.floor((x+w-.01)/16);tx++)if(!clearTile(tx,ty))return false;
    if(signs.some(q=>x<q.x+q.w&&x+w>q.x&&y<q.y+q.h&&y+h>q.y))return false;
    return !placements.some(q=>x<q.x+q.w+2&&x+w+2>q.x&&y<q.y+q.h+2&&y+h+2>q.y);
  };
  let focusX=ax+aw/2,focusY=ay+ah+20;
  const floorPosition=(w:number,h:number)=>{
    const candidates:{x:number;y:number;distance:number}[]=[];
    for(let y=2;y<18;y++)for(let x=1;x<29;x++){const px=x*16+1,py=y*16+1;if(clearRect(px,py,w,h))candidates.push({x:px,y:py,distance:Math.abs(px+w/2-focusX)+Math.abs(py+h-focusY)});}
    const section=room.sections?.find(s=>anchor.x>=s.x&&anchor.x<s.x+s.w&&anchor.y>=s.y&&anchor.y<s.y+s.h);
    const local=section?candidates.filter(q=>q.x>=section.x*16&&q.x+w<=(section.x+section.w)*16&&q.y>=section.y*16&&q.y+h<=(section.y+section.h)*16):[];
    return (local.length?local:candidates).sort((a,b)=>a.distance-b.distance||a.y-b.y||a.x-b.x)[0];
  };
  const drawProp=(kind:EventProp,x:number,y:number,w:number,h=w,supported=false)=>{
    for(const px of eventPropPixels(kind))p(px.color,x+px.x*w/8,y+px.y*h/8,px.w*w/8,px.h*h/8);
    placements.push({role:'prop',x,y,w,h,...(supported?{support:anchor.kind}:{})});stage.inspectAreas!.push({kind:'rect',x,y,w,h});
  };
  const surface=['table','counter','buffet','desk','workbench','shelf','board','monitor','easel','console','viewport'].includes(anchor.kind);
  const screen=['board','monitor','easel','viewport'].includes(anchor.kind);
  // All props have real-world sizes: a peach/cup is half a tile, a door is human height.
  // Use existing tabletops, shelf ledges and screens; never draw a replacement table.
  let cursor=ax+Math.max(4,(aw-episode.scene.props.reduce((n,k)=>n+sizeFor(k)+4,0))/2), top=screen?ay+(anchor.kind==='board'?-10:4):ay+3;
  if(['desk','workbench'].includes(anchor.kind))cursor=ax+aw-17;
  if(anchor.kind==='buffet')top=ay+12;
  if(anchor.kind==='shelf')top=ay-3;
  const props:readonly EventProp[]=episode.id==='delorean-13'?['helicopter']:episode.direction.beat==='outside'?[]:episode.id==='comic-02'?['plate','plate','plate']:episode.scene.props;
  if(episode.id==='delorean-13'){cursor=ax+aw/2-20;top=ay+ah/2-20;ring(white,ax+aw/2,ay+ah/2,64,54);p(white,ax+aw/2-6,ay+ah/2-8,1,16);p(white,ax+aw/2+5,ay+ah/2-8,1,16);p(white,ax+aw/2-6,ay+ah/2,12,1);}
  for(const [index,kind]of props.entries()){
    const size=episode.id==='delorean-13'?40:sizeFor(kind),w=kind==='door'?15:size,h=kind==='door'?26:size;
    if(episode.id==='comic-02'){drawProp(kind,ax+aw/2-w/2,ay+4+index*3,w,h,true);continue;}
    if(surface&&kind!=='door'&&cursor+w<=ax+aw-3&&top+h<=ay+ah-3+(anchor.kind==='board'?12:0)){
      drawProp(kind,cursor,top,w,h,true);cursor+=w+4;
    }else{
      const q=floorPosition(w,h);if(q)drawProp(kind,q.x,q.y,w,h);
    }
    // Short pieces stay a single prop; repetitions have explicit narrative roles.
    if(index>=2)break;
  }
  const mainProp=placements.find(q=>q.role==='prop');if(mainProp){focusX=mainProp.x+mainProp.w/2;focusY=Math.max(ay+ah+20,mainProp.y+mainProp.h+22);}
  if(episode.direction.beat!=='outside')for(const cast of episode.direction.cast){
    const scale=cast==='issun'?.12:cast==='arrietty'?.22:.6,w=48*scale,h=48*scale;
    const afloat=cast==='issun'&&mainProp?.support;
    const q=afloat?{x:mainProp!.x+1,y:mainProp!.y-h*.35}:floorPosition(w,h);if(!q)continue;
    placements.push({role:'visitor',x:q.x,y:q.y,w,h,...(afloat?{support:anchor.kind}:{})});
    for(const px of incidentCastPixels(cast))p(px.color,q.x+px.x*scale,q.y+px.y*scale,px.w*scale,px.h*scale);
    stage.inspectAreas!.push({kind:'rect',x:q.x,y:q.y,w,h});
    if(episode.id==='comic-04'||episode.id==='thief-06'){
      const twin=floorPosition(w,h);if(twin){placements.push({role:'visitor',x:twin.x,y:twin.y,w,h});for(const px of incidentCastPixels(cast))p(px.color,twin.x+px.x*scale,twin.y+px.y*scale,px.w*scale,px.h*scale,.65);}
    }
  }
  const first=placements.find(q=>q.role==='prop'), x=first?first.x+first.w/2:ax+aw/2,y=first?first.y+first.h/2:ay+ah/2;
  // Effects have a local origin and a small footprint. Nothing repaints the room.
  switch(episode.direction.beat){
    case 'scan':case 'screen':
      for(let i=0;i<5;i++){p(0x8fc7a5,ax+5,ay+5+i*2,Math.min(aw-10,12+(i*7)%25),.5,.9);}break;
    case 'chalk':for(let i=0;i<3;i++){p([blue,pink,gold][i],ax+Math.min(aw-15,25),Math.max(2,ay-6+i*4),Math.min(aw*.3,20),1);}break;
    case 'paper':case 'cards':
      if(first)for(let i=0;i<3;i++)line(ink,x-3,y-2+i*2,x+3-i,y-2+i*2,.5);break;
    case 'orbit':ring(gold,x,y,first?first.w+15:28,14,.7);break;
    case 'portal':ring(pink,x,y,20,26,.85);ring(blue,x,y,16,22,.7);break;
    case 'beam':for(let i=0;i<5;i++)p(blue,x-9+i*4,y-16,1,24,.5);break;
    case 'ribbon':for(let i=0;i<4;i++)line(pink,x-12+i*8,y-5,x-8+i*8,y+3,.8);break;
    case 'webs':for(let i=0;i<4;i++)line(white,ax+aw-3,ay+1,ax+aw-22+i*6,ay+12,.8);break;
    case 'mirror':line(white,x-4,y-5,x+4,y+3);line(white,x+1,y-6,x+5,y-2);break;
    case 'vine':for(let i=0;i<8;i++){p(0x658c67,ax+aw/2+Math.sin(i)*3,ay-i*3,1,4);if(i%2)p(0x91ad74,ax+aw/2+3,ay-i*3,4,1);}break;
    case 'shadow':{const guest=placements.find(q=>q.role==='visitor');if(guest){layer=stage.floor;ring(ink,guest.x+guest.w/2,guest.y+guest.h-2,guest.w,6,.7);}break;}
    case 'trace':case 'footprints':case 'trail':case 'suction':{
      layer=stage.floor;const guest=placements.find(q=>q.role==='visitor');if(guest)for(let i=0;i<4;i++){const xx=guest.x+guest.w/2+i*4,yy=guest.y+guest.h+3;if(clearTile(Math.floor(xx/16),Math.floor(yy/16)))p(0x927e64,xx,yy,2,1,.6);}break;
    }
    case 'frost':case 'snow':for(let i=0;i<5;i++){p(0xd6e9e3,x-9+i*4,y+7+(i%2),3,1);p(0xeaf4e8,x-8+i*4,y+4,1,4);}break;
    case 'sand':for(let i=0;i<9;i++)p(0xd6bd85,x-10+i*3,y+8+(i%3),1,1);break;
    case 'rainbow':for(let i=0;i<5;i++)ring([0xd68d88,gold,0x91b186,blue,0xa89bbb][i],x,y+7,20-i*2,16-i*2,.7);break;
    case 'ghosts':for(let i=0;i<2;i++){const q=floorPosition(12,12);if(q){for(const px of eventPropPixels('ghost'))p(px.color,q.x+px.x*1.5,q.y+px.y*1.5,px.w*1.5,px.h*1.5,.8);placements.push({role:'prop',x:q.x,y:q.y,w:12,h:12});stage.inspectAreas!.push({kind:'rect',x:q.x,y:q.y,w:12,h:12});}}break;
    default:break;
  }
  if(frame>=0){
    layer=stage.effects;const step=frame%4;
    switch(episode.direction.beat){
      case 'steam':case 'smoke':for(let i=0;i<3;i++)p(white,x-4+i*4,y-5-step*2-i,1,3,.55);break;
      case 'sparks':case 'stars':case 'pixels':case 'heart':case 'blossom':for(let i=0;i<4;i++){const xx=x-12+i*8,yy=y-9+(i+step)%3*3;p(i%2?gold:pink,xx,yy,1,3,.8);p(white,xx-1,yy+1,3,1,.8);}break;
      case 'bubbles':for(let i=0;i<3;i++)ring(blue,x-8+i*7,y-4-step*2,3,3,.6);break;
      case 'rain':for(let i=0;i<4;i++)line(blue,x-8+i*5,y-12+step,x-9+i*5,y-9+step,.6);break;
      case 'feathers':for(let i=0;i<3;i++)line(white,x-8+i*7,y-9+step,x-5+i*7,y-11+step,.7);break;
      case 'music':for(let i=0;i<2;i++){p(gold,x+8+i*5,y-12-step,1,5);p(gold,x+6+i*5,y-8-step,3,2);}break;
      default:break;
    }
  }
  return stage;
}
