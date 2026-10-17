import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EVENT_PROP_NAMES, eventPropPixels } from './event-props.ts';
import { EVENT_PROP_LABELS } from './event-prop-labels.ts';
import { DAILY_EPISODES } from './daily-event-catalog.ts';
import { eventVisitorPixels, isVisitorCostume, meteorIllustration } from './event-visitors.ts';
import { eventPixels, outsideEventPixels, drawEventPreview } from './daily-event-art.ts';
import { roomEventStage } from './daily-event-stage.ts';

test('all 207 incident props have distinct, bounded 32-dot drawings and human-readable names', () => {
  assert.equal(EVENT_PROP_NAMES.length,207);
  const geometries = new Set<string>();
  for(const kind of EVENT_PROP_NAMES){
    assert.ok(EVENT_PROP_LABELS[kind].length>0,kind);
    const art=eventPropPixels(kind);assert.ok(art.length>30&&art.length<400,kind);
    assert.ok(art.every(p=>p.x>=0&&p.y>=0&&p.w>0&&p.h===.25&&p.x+p.w<=8&&p.y+p.h<=8),kind);
    // Horizontal runs must land on the new source grid, including subpixel edges.
    assert.ok(art.every(p=>[p.x,p.y,p.w,p.h].every(n=>Number.isInteger(n*4))),kind);
    assert.ok(art.some(p=>!Number.isInteger(p.x)||!Number.isInteger(p.w)),kind);
    geometries.add(createHash('sha256').update(JSON.stringify(art.map(p=>[p.x,p.y,p.w,p.h]))).digest('hex'));
  }
  assert.equal(geometries.size,207,'recolouring a shared silhouette is not a distinct object');
});
test('new detailed source runs retain their dimensions in the scene, hero and outdoor paths', () => {
  for(const episode of DAILY_EPISODES){
    const stage=roomEventStage(episode,'meeting',[],-1);
    assert.ok([...stage.floor,...stage.scenery,...stage.effects].every(p=>[p.x,p.y,p.w,p.h].every(n=>Number.isInteger(n*2))),episode.id);
    if(!episode.scene.special && episode.theme !== 'comic') assert.ok(eventPixels(episode).every(p=>p.h===1.25),episode.id);
    for(const p of outsideEventPixels(episode,256,56))assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=256&&p.y+p.h<=56,episode.id);
  }
});
test('all special visitors and meteor use their finer pixel grid within the existing 48-unit hit area', () => {
  for(const costume of ['santa','waldo','ghost','thief','terminator','momotaro','kaguya','alice','oz','magic','festival']){
    assert.ok(isVisitorCostume(costume));
    const art=eventVisitorPixels(costume);assert.ok(art.length>200,costume);
    assert.ok(art.every(p=>p.x>=0&&p.y>=0&&p.x+p.w<=48&&p.y+p.h<=48&&p.h===.5),costume);
  }
  assert.ok(meteorIllustration().every(p=>p.h===.5));
});
test('journal and thumbnail canvases stay bounded over repeated redraws', () => {
  const fn=()=>{};
  const context=new Proxy({},{get:()=>fn,set:()=>true});
  const canvas={width:256,height:144,getContext:()=>context} as unknown as HTMLCanvasElement;
  for(const episode of DAILY_EPISODES.slice(0,20)){
    drawEventPreview(canvas,episode);assert.equal(canvas.width,960);assert.equal(canvas.height,640);
    drawEventPreview(canvas,episode,'meeting',384);assert.equal(canvas.width,384);assert.equal(canvas.height,256);
  }
});
