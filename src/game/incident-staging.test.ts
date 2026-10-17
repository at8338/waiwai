import {test}from'node:test';
import assert from'node:assert/strict';
import {DAILY_EPISODES,episodeById}from'./daily-event-catalog.ts';
import {roomEventStage}from'./daily-event-stage.ts';
import {incidentAnchor}from'./incident-staging.ts';
import {getRoom}from'./rooms.ts';
import {walkableWithObjects}from'./objects.ts';
import type{RoomObject}from'./objects.ts';

test('every script uses a real landmark; all 356 replacements keep visitors and floor props clear of furniture',()=>{
  for(const episode of DAILY_EPISODES){
    if(episode.direction.approved)continue;
    const room=episode.direction.room,anchor=incidentAnchor(episode,room);
    assert.ok(anchor,episode.id);assert.ok(getRoom(room).furniture.includes(anchor));
    const stage=roomEventStage(episode);
    assert.equal(stage.damage.length,0,episode.id);
    if(episode.direction.beat!=='outside')assert.ok(stage.placements?.some(p=>p.role==='visitor'),episode.id);
    for(const p of stage.placements??[]){
      if(p.role==='visitor')assert.ok(p.w<=28.8&&p.h<=28.8,episode.id);
      else assert.ok(p.w<=26&&p.h<=26,episode.id);
      if(p.support){assert.ok(p.x>=anchor.x*16&&p.x+p.w<=(anchor.x+anchor.w)*16);continue;}
      for(let y=Math.floor(p.y/16);y<=Math.floor((p.y+p.h-.01)/16);y++)for(let x=Math.floor(p.x/16);x<=Math.floor((p.x+p.w-.01)/16);x++)assert.ok(walkableWithObjects(x,y,room,[]),`${episode.id} at ${x},${y}`);
    }
  }
});
test('placed furniture relocates visitors rather than covering it, including completely crowded rooms',()=>{
  const episode=episodeById('momotaro-01')!, first=roomEventStage(episode).placements!.find(p=>p.role==='visitor')!;
  const objects:RoomObject[]=[{id:'qa',owner:'qa',kind:'desk',rotation:0,roomId:'canteen',x:Math.floor(first.x/16),y:Math.floor(first.y/16)}];
  const moved=roomEventStage(episode,'canteen',objects).placements!.find(p=>p.role==='visitor')!;
  assert.notDeepEqual(moved,first);
  for(let y=Math.floor(moved.y/16);y<=Math.floor((moved.y+moved.h-.01)/16);y++)for(let x=Math.floor(moved.x/16);x<=Math.floor((moved.x+moved.w-.01)/16);x++)assert.ok(walkableWithObjects(x,y,'canteen',objects));
  const full:RoomObject[]=[];for(let y=1;y<19;y++)for(let x=1;x<29;x++)full.push({id:`${x}-${y}`,owner:'qa',kind:'box',rotation:0,roomId:'canteen',x,y});
  assert.ok(!roomEventStage(episode,'canteen',full).placements!.some(p=>p.role==='visitor'));
});
test('peach fits on the existing serving counter; helipad uses the real conference table',()=>{
  const peach=roomEventStage(episodeById('momotaro-01')!).placements!.find(p=>p.role==='prop')!;
  assert.equal(peach.support,'buffet');assert.equal(peach.w,8);
  const pad=roomEventStage(episodeById('delorean-13')!);
  assert.equal(pad.placements!.filter(p=>p.role==='prop').length,1);
  assert.equal(pad.placements![0].support,'table');
});
test('outdoor stories use open air or windows, indoor monitoring stories use actual screens',()=>{
  for(const e of DAILY_EPISODES){if(e.direction.beat==='outside')assert.notEqual(getRoom(e.direction.room).outlook,'none');}
  assert.equal(episodeById('kaiju-05')!.direction.room,'ops');
  assert.equal(episodeById('kaiju-05')!.direction.anchor,'monitor');
  assert.equal(episodeById('kaiju-13')!.direction.anchor,'viewport');
});
