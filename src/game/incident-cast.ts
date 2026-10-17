import type { Pixel } from './avatar.ts';
import { eventDrawing } from './event-drawing.ts';
import { eventVisitorPixels } from './event-visitors.ts';
import { comicVisitorPixels } from './event-comic-art.ts';
import { eventPropPixels } from './event-props.ts';
import type { EventProp } from './event-props.ts';

const comics: Record<string, number> = { doraemon:0,goku:1,luffy:2,naruto:3,arale:4,anpanman:5,kiki:6,totoro:7,conan:8,pikachu:9,kirby:10,mario:11,sailor:12,snoopy:13 };
const costumes = { thief:'thief', santa:'santa', buster:'ghost', waldo:'waldo', terminator:'terminator', momotaro:'momotaro', kaguya:'kaguya', alice:'alice', dorothy:'oz', wizard:'magic', festival:'festival', witch:'magic', harry:'magic', hermione:'magic', snape:'magic', mcgonagall:'magic' } as const;
// An individual wardrobe, silhouette and signature accessory for the visitors.
const wardrobe: Record<string, [number,number,EventProp?]> = {
  atom:[0xe9c39c,0x253b43],robocop:[0x8ea7b1,0x526d7a,'helmet'],eve:[0xf2f1e7,0x4b6c7e,'leaf'],luckycat:[0xd8c49a,0x9a785b,'cat'],jackpirate:[0x806b55,0x4d443b,'compass'],robot:[0x83999e,0x536b7b,'gear'],cat:[0xa8aaa0,0x687e7b,'cat'],ponyo:[0xc47660,0x9d624f,'fish'],spock:[0x689bb7,0x29333d],leia:[0xf5edd9,0x65513f],vader:[0x28343e,0x202a32,'helmet'],littleprince:[0x76a38b,0xd6b763,'flower'],astronaut:[0xeee7d3,0x667986,'helmet'],
  et:[0xb39a7a,0x947357,'flower'],doc:[0xece8d3,0xeee5ca,'clock'],maetel:[0x333e4e,0xe2c573,'hat'],lupin:[0xc45d54,0x293c44],zenigata:[0xa47d53,0x38414a,'hat'],kaito:[0xf1ead6,0x394552,'card'],neo:[0x2b3b42,0x27343c],
  ninja:[0x566d86,0x30404e,'star'],indiana:[0xa88a60,0x5f4e3d,'hat'],holmes:[0x91775c,0x665641,'magnifier'],phantom:[0x34414b,0x2e3741,'mask'],jigen:[0x39454b,0x29343b,'hat'],mary:[0x416279,0x5f4f41,'umbrella'],elsa:[0x8bc5d1,0xe6d7ab,'crystal'],
  snowqueen:[0xa5cad4,0xe7dcc1,'snow'],olaf:[0xf4ead7,0x815e45,'snowman'],chef:[0xf0e8d2,0x765844,'pan'],samurai:[0x5c839b,0x293941,'sword'],oni:[0xbf6f5f,0x37434b,'mask'],princess:[0xbe91ac,0xe2c680,'crown'],rabbit:[0xf4e8d1,0xe5d9c3,'rabbit'],wednesday:[0x303740,0x28333b],
  ghost:[0xc4c9ce,0xa1b3b7,'ghost'],dracula:[0x3b344a,0x2d3540],franken:[0x587868,0x2f3c3b,'gear'],sadako:[0xe7e4d4,0x29343c],jack:[0x303d49,0xf3ead7,'skull'],shogi:[0x6b7f90,0x65503c,'shogi'],queen:[0xb65f68,0x403740,'crown'],
  catbus:[0xb59c68,0x84734e,'cat'],porco:[0x9a7652,0xb19079,'plane'],carl:[0x8d7d68,0xe8dfc8,'glasses'],amuro:[0xe9e5d3,0x65503c,'helmet'],marty:[0xc56855,0x69513f,'guitar'],nausicaa:[0x6d9db1,0x805d44,'feather'],walle:[0xc0a154,0x536a74,'robot'],baymax:[0xf5eddc,0xf5eddc,'heart'],c3po:[0xc6a45d,0xb28e48,'gear'],r2d2:[0xe2e4d9,0x668da5,'robot'],ironman:[0xb8564d,0xdbc17c,'helmet'],hal:[0x353f4a,0xbf5e56,'camera'],
  kintaro:[0xc56451,0x3b3e3b,'hammer'],issun:[0x6a8ea1,0x4b4940,'sword'],crane:[0xe9e3d4,0x4c5253,'feather'],oldman:[0x748a9a,0xe5dfcf,'flower'],jizo:[0x8a9591,0x7e8d88,'hat'],tanuki:[0x9e896b,0x655946,'leaf'],mouse:[0x9faaa4,0x677a7b,'sushi'],jackbean:[0x73946e,0x9b7958,'seedling'],redhood:[0xbe655d,0x715244,'basket'],pig:[0xd4a08c,0xb18571,'hammer'],gretel:[0x9c87a1,0xb79465,'bread'],cinderella:[0x98bacc,0xd7bd7f,'shoe'],king:[0x956f93,0x77604a,'crown'],urashima:[0x799b9b,0x454943,'turtle'],mummy:[0xd5ceb8,0xc5bda6,'rope'],pharaoh:[0xd0b16c,0x34495a,'crown'],goemon:[0xe8ddc1,0x303c43,'sword'],cowboy:[0x9c8059,0x695644,'hat'],knight:[0x9daeb0,0x677b81,'shield'],alchemist:[0x876c9b,0xbda174,'potion'],caveman:[0xa68a63,0x615445,'bone'],belle:[0xdfbd70,0x7c5942,'flower'],arrietty:[0xbc675d,0x846247,'pin'],sunflower:[0x9cb16e,0xe1bb67,'flower'],sakura:[0xd69eaf,0x7d5a49,'wand'],san:[0x73908a,0x394c4e,'mask'],hatter:[0x7b9a77,0x865d43,'hat'],ralph:[0xbd8160,0x6d5442,'hammer'],howl:[0x9d9caf,0xe1c586,'castle'],antman:[0xab6058,0x6c7a81,'helmet'],aladdin:[0xb09ab8,0x514334,'lantern'],mime:[0xf2e6cf,0x303d48,'hand'],doctor:[0x886e58,0x6d5340,'hourglass'],popeye:[0x3f657b,0x374953,'anchor'],ariel:[0x9ab395,0xbd6855,'shell'],sanji:[0x3c4652,0xdbc77b,'fork'],shipwright:[0x819bab,0x5d5140,'hammer'],nami:[0x8fa77f,0xc7945c,'scroll'],daruma:[0xb85e56,0x4e4742,'mask'],miko:[0xf0e5cf,0x36414a,'bell'],lion:[0xa96353,0x467368,'mask'],
  dragon:[0x638d7b,0x475f58,'dragon'],unicorn:[0xf4eddc,0xb9abc4,'unicorn'],fawkes:[0xc47851,0xe2b96b,'feather'],gryphon:[0x9e8864,0xcab78e,'horse'],cerberus:[0x75665c,0x493f3c,'dog'],pegasus:[0xeae4d2,0xb7c1c0,'horse'],sphinx:[0xb49a66,0x746448,'cat'],golem:[0x94998a,0x717f73,'statue'],troll:[0x81956e,0x566c52,'statue'],fairy:[0xa3b4ab,0xdfcc8d,'feather'],minotaur:[0x9d805f,0x65513f,'cow'],arthur:[0x8fa8b0,0xc2a06c,'sword'],slime:[0x7daebe,0x567e99,'slime'],inventor:[0xe1daca,0xddd7c5,'glasses'],ditto:[0xc197b4,0xaf7f9d,'jelly'],invisible:[0xd8dfd5,0xc6d0cd],spongebob:[0xd9bf69,0xcdb35f],sonic:[0x658cad,0x466c95],calcifer:[0xdd9b56,0xb96a48,'fire'],alien:[0x91b898,0x6c8c74],newton:[0x7b7d92,0xe1d6bd,'apple'],flash:[0xbe6459,0xdeb76b,'lightning'],grant:[0x7c9caa,0x8a7255,'hat'],dinosaur:[0x88a078,0x637c59,'dinosaur'],mammoth:[0x9b8064,0x715943,'elephant'],fossil:[0xb1a68c,0x8c826e,'fossil'],remy:[0x98a7aa,0x748a91,'cheese'],donkey:[0x9b7959,0x695440,'banana'],homer:[0xf0e6ce,0xd7b867,'donut'],chihiro:[0x9bb5a0,0x5c4e43],pooh:[0xdab56c,0xc49c52,'bottle'],noface:[0x303e49,0xe6e4d7,'mask'],usopp:[0xb09a68,0x695a44,'star'],fireworker:[0x5c7c95,0x6b5541,'star'],mulder:[0x536674,0x65513e,'camera'],godzilla:[0x607c6c,0x3d5c51,'dinosaur'],mothra:[0xc4a574,0x876e63,'butterfly'],kong:[0x88745d,0x5e5347,'monkey'],zeppelin:[0xc7b581,0x8a8a72,'balloon'],laputa:[0x94aa85,0x697c69,'castle'],haku:[0xcdd9c5,0x8ab4b7,'dragon'],gamera:[0x81967a,0x5d7768,'turtle'],penguin:[0xf0ead7,0x344d5a,'penguin'],rainbow:[0xd6b981,0x889fa5,'rainbow'],whale:[0x7a9fac,0x536f86,'whale'],gundam:[0xd9dfd6,0x6c8fa9,'robot'],train:[0x748d9d,0x4b6579,'train'],
};
export function isIncidentCast(id:string):boolean { return id in comics || id in costumes || id in wardrobe; }
const cache=new Map<string,Pixel[]>();
export function incidentCastPixels(id:string):Pixel[] {
  if(id in comics)return comicVisitorPixels(comics[id]);
  if(id in costumes)return eventVisitorPixels(costumes[id as keyof typeof costumes]);
  const cached=cache.get(id);if(cached)return cached;
  const [coat,hair,accessory]=wardrobe[id];
  const {rect:p,poly,oval,line,pixels}=eventDrawing(48,48);
  const ink=0x34434d,skin=0xe4bd99,white=0xf5edda,gold=0xd9b675;
  const object=(kind:EventProp,x:number,y:number,size:number)=>{for(const px of eventPropPixels(kind))p(px.color,x+px.x*size/8,y+px.y*size/8,px.w*size/8,px.h*size/8);};
  // Keep humanoids within the same 28-world-unit height as office avatars.
  poly(ink,[[14,24],[32,24],[36,35],[31,37],[29,44],[17,44],[15,36],[11,35]]);
  poly(coat,[[15,25],[31,25],[34,34],[29,34],[28,40],[18,40],[17,33],[13,34]]);
  p(ink,17,42,6,4);p(ink,26,42,6,4);p(skin,11,33,5,4);p(skin,31,33,5,4);
  oval(ink,14,5,20,21);oval(skin,15,7,18,17);poly(hair,[[14,14],[14,8],[18,3],[29,4],[34,10],[32,15],[29,10],[18,9]]);
  p(ink,19,14,1.5,2);p(ink,27,14,1.5,2);line(0x9f7966,22,20,27,20,.5);p(white,21,25,7,3);p(gold,24,29,1,1);
  if(['vader','neo','dracula','maetel','snape','queen','noface','wizard','doctor'].includes(id))poly(coat,[[14,24],[32,24],[38,43],[10,43]]);
  if(['neo','porco','doc','carl','homer','spock','mulder'].includes(id)){p(ink,16,13,8,4);p(ink,25,13,8,4);p(ink,23,14,3,1);}
  if(id==='spock'){poly(skin,[[14,12],[9,7],[12,17],[16,19]]);poly(skin,[[33,12],[39,7],[36,18],[32,19]]);p(gold,29,27,2,4);}
  if(id==='leia'){oval(hair,11,8,7,11);oval(hair,31,8,7,11);}
  if(id==='vader'){poly(ink,[[12,19],[15,5],[23,1],[31,5],[36,19],[29,23],[18,23]]);poly(0x607079,[[19,13],[29,13],[31,20],[17,20]]);line(white,20,16,28,16,.5);p(0xbd665c,22,29,2,2);p(0x7da6a1,26,29,2,2);}
  if(id==='et'){oval(0xa18b6d,10,5,27,15);oval(ink,15,10,6,5);oval(ink,27,10,6,5);p(white,17,10,2,1);p(white,29,10,2,1);line(skin,35,33,42,21,2);oval(gold,40,19,4,4);}
  if(id==='alien'){oval(0x9fc5a3,11,2,26,22);oval(ink,16,10,5,7);oval(ink,27,10,5,7);line(ink,22,21,27,21,.5);}
  if(['walle','r2d2','baymax','hal','c3po','ironman','robot','eve','robocop'].includes(id)){
    if(id==='eve'){oval(ink,11,18,25,27);oval(white,12,19,23,25);oval(ink,12,3,24,18);oval(white,13,4,22,16);p(0x243e4f,16,9,16,8);p(0x83c9d1,19,11,4,3);p(0x83c9d1,27,11,4,3);}
    else if(id==='baymax'){oval(ink,9,15,29,31);oval(white,10,16,27,29);oval(ink,16,4,17,14);oval(white,17,5,15,12);p(ink,20,10,2,2);p(ink,28,10,2,2);line(ink,21,11,28,11,.5);}
    else if(id==='walle'){p(ink,9,24,29,16);p(coat,10,25,27,14);p(ink,8,37,9,9);p(ink,30,37,9,9);p(hair,22,14,4,11);for(const x of[10,25]){p(hair,x,6,14,12);p(ink,x+2,8,10,8);p(0xa3c3c6,x+4,9,5,5);}p(ink,15,28,16,4);}
    else if(id==='r2d2'){oval(ink,10,8,27,20);oval(white,11,9,25,18);p(ink,9,19,29,24);p(white,10,20,27,22);p(hair,20,12,9,5);p(hair,15,23,18,4);p(hair,18,30,12,9);p(ink,6,24,5,21);p(ink,37,24,5,21);}
    else if(id==='hal'){p(ink,10,4,28,41);p(0x667981,12,6,24,37);oval(ink,15,13,18,18);oval(0xbd5e56,19,17,10,10);oval(gold,22,19,4,4);}
    else {p(hair,15,6,18,17);p(ink,18,13,12,3);p(0xbad6cf,19,13,10,1);p(hair,18,27,12,10);oval(gold,21,28,7,7);}
  }
  if(['indiana','holmes','jigen','zenigata','cowboy','maetel','hatter','pharaoh'].includes(id)){p(hair,12,8,24,4);p(hair,17,0,15,10);line(gold,17,7,32,7,1);}
  if(id==='lupin'){p(0x3c674e,20,25,8,11);line(gold,24,27,24,35,1);}
  if(id==='wednesday'||id==='sadako'){p(hair,13,9,4,24);p(hair,31,9,4,24);if(id==='sadako')p(hair,15,8,18,12);}
  if(id==='kintaro'){p(0xdcb591,15,25,18,15);p(coat,19,27,11,12);}
  if(id==='redhood'){poly(coat,[[11,22],[13,7],[24,0],[35,8],[37,24],[31,25],[31,10],[17,10],[17,25]]);}
  if(id==='noface'){oval(white,17,5,15,23);p(ink,20,12,2,2);p(ink,28,12,2,2);line(ink,22,23,27,23,1);p(0x9f88a0,19,17,2,4);p(0x9f88a0,29,17,2,4);}
  if(id==='mummy')for(let y=10;y<41;y+=5)line(0x958f7d,15,y,32,y+2,.5);
  if(id==='spongebob'){p(ink,11,7,26,30);p(coat,12,8,24,28);for(const x of[16,26]){oval(white,x,10,7,9);p(0x699dad,x+2,13,3,4);p(ink,x+3,14,1,2);}p(white,18,27,13,5);p(0x9e7a55,12,35,24,6);p(white,22,22,4,4);}
  if(id==='sonic'){poly(hair,[[13,8],[8,2],[21,5],[29,0],[35,10],[41,17],[33,18],[38,25],[30,24],[29,9]]);p(0xc9655b,15,42,9,4);p(0xc9655b,26,42,9,4);}
  if(id==='atom'){poly(ink,[[13,12],[11,4],[19,7],[22,1],[27,6],[34,4],[32,15],[29,9],[19,9]]);p(skin,17,25,13,10);p(0x6c9f83,17,35,13,6);p(0xc36559,15,41,9,5);p(0xc36559,26,41,9,5);}
  if(id==='jackpirate'){poly(hair,[[10,9],[16,2],[24,6],[33,2],[37,10]]);p(0xb56c59,16,10,17,2);line(ink,20,20,29,20);line(ink,24,22,24,25,1);p(hair,13,14,3,15);p(hair,32,13,3,18);}
  if(id==='holmes'){poly(hair,[[13,10],[18,2],[29,2],[35,11]]);for(let i=0;i<4;i++)p(0xc2ae83,16+i*4,5,1,6);p(hair,10,11,28,2);}
  if(id==='oldman'){poly(white,[[17,18],[24,21],[31,18],[29,26],[24,30],[19,26]]);}
  if(id==='dracula'){p(white,21,21,1,3);p(white,28,21,1,3);poly(0x9a5a64,[[12,24],[20,28],[24,35],[29,28],[36,24],[33,30],[27,37],[21,37],[15,30]]);}
  if(id==='issun')p(0xbd655a,18,11,15,2);
  if(id==='ponyo'){oval(0xcb725e,9,18,29,24);poly(0xcb725e,[[13,19],[7,9],[16,12],[22,4],[30,9],[38,8],[35,20]]);oval(skin,13,12,22,19);p(ink,18,19,2,3);p(ink,29,19,2,3);line(0x9d6252,22,26,27,26);}
  if(id==='olaf'){oval(white,14,25,20,20);oval(white,17,14,14,16);oval(white,18,2,13,17);p(ink,20,7,2,2);p(ink,27,7,2,2);poly(0xd19b60,[[23,10],[36,12],[23,14]]);for(const yy of[29,34,39])p(ink,23,yy,2,2);line(0x8e7358,14,30,6,23,1);line(0x8e7358,33,30,41,24,1);}
  if(id==='pooh'){oval(gold,12,23,24,23);p(0xc36b5d,13,23,22,9);oval(gold,12,6,24,21);oval(gold,10,3,8,9);oval(gold,30,3,8,9);p(ink,18,14,2,2);p(ink,28,14,2,2);oval(ink,22,18,5,3);}
  // Nonhuman guests keep their characteristic silhouette instead of a human head.
  const creatures:Record<string,EventProp>={ghost:'ghost',dragon:'dragon',unicorn:'unicorn',cerberus:'dog',pegasus:'horse',sphinx:'cat',golem:'statue',slime:'slime',ditto:'jelly',dinosaur:'dinosaur',mammoth:'elephant',fossil:'fossil',remy:'cat',cat:'cat',rabbit:'rabbit',mouse:'cat',tanuki:'fox',jizo:'statue'};
  if(id in creatures){const creature=creatures[id];
    const art=eventPropPixels(creature).map(px=>({...px,x:7+px.x*4.2,y:7+px.y*4.2,w:px.w*4.2,h:px.h*4.2}));cache.set(id,art);return art;}
  if(accessory && !['vader','hal','baymax','walle','r2d2'].includes(id))object(accessory,32,27,14);
  const out=pixels();cache.set(id,out);return out;
}
