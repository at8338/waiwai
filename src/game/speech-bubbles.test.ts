import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SpeechBubbles, SPEECH_MS, speechPosition, speechPreview } from './speech-bubbles.ts';
import type { ChatMessage } from './chat.ts';
import type { Player } from '../network/protocol.ts';
const player: Player = { id: '00000000-0000-4000-a000-000000000001', slot: 1, name: 'Hana', outfit: 0, roomId: 'office', x: 15, y: 12, facing: 'down', accountId: 'slack:T12345678:U12345678' };
const message = (conversation: string, id = conversation): ChatMessage => ({ id, seq: 1, authorId: player.accountId!, authorName: 'Hana', text: 'おはようございます', conversation, createdAt: 1000, source: 'waiwai' });
test('live public and group messages use the current-room sender; DMs and other floors never become speech', () => {
  const model = new SpeechBubbles();
  for (const [conversation, channel] of [['global','全館'],['room:office','フロア'],['group:example','グループ']]) {
    assert.deepEqual(model.receive(message(conversation),'office',[player],1000),[player.id]); assert.equal(model.get(player.id,1001)!.channel,channel);
  }
  model.clear();
  for (const conversation of ['dm:["a","b"]','room:library','unknown']) assert.deepEqual(model.receive(message(conversation),'office',[player],1000),[]);
  assert.equal(model.get(player.id,1001),undefined);
  assert.deepEqual(model.receive(message('global'),'library',[player],1000),[]);
  assert.equal(model.get(player.id,1001),undefined);
});
test('speech expires, repeated delivery does not extend it, and the latest message replaces the previous one', () => {
  const model = new SpeechBubbles(), first=message('global','first');
  model.receive(first,'office',[player],1000);
  assert.deepEqual(model.receive(first,'office',[player],2000),[]);
  assert.equal(model.get(player.id,1000+SPEECH_MS),undefined);
  model.receive(message('global','second'),'office',[player],10000);
  model.receive({...message('global','third'),text:'次の話題'},'office',[player],11000);
  assert.equal(model.get(player.id,11000)!.text,'次の話題');
  model.remove(player.id); assert.equal(model.get(player.id,11001),undefined);
  model.receive(message('global','fourth'),'office',[player],12000); model.clear(); assert.equal(model.get(player.id,12001),undefined);
});
test('identity matching supports tabs but cannot attach messages to another person with the same display name', () => {
  const model = new SpeechBubbles(), other = {...player,id:'other',accountId:'slack:T12345678:U99999999'}, tab={...player,id:'tab'};
  assert.deepEqual(model.receive(message('global'),'office',[player,other,tab],1000),[player.id,tab.id]);
  assert.equal(model.get(other.id,1001),undefined);
  const guest={...player,id:'guest-avatar',accountId:undefined,slack:null};
  assert.deepEqual(model.receive({...message('global','guest'),authorId:'guest:guest-avatar'},'office',[guest],1000),[guest.id]);
});
test('speech previews preserve emoji graphemes, wrap to three lines and truncate long posts safely', () => {
  assert.equal(speechPreview('  hello\nworld  '),'hello world');
  const family='👨‍👩‍👧‍👦', preview=speechPreview(family.repeat(60));
  assert.equal(preview.split('\n').length,3); assert.ok(preview.endsWith('…'));
  const segments=[...new Intl.Segmenter('ja',{granularity:'grapheme'}).segment(preview.replaceAll('\n',''))];
  assert.equal(segments.length,48); assert.equal(segments[0].segment,family);
});
test('edge avatars keep their speech inside the floor canvas', () => {
  for(const x of [0,8,240,480]) for(const y of [-30,10,100,320]) {
    const p=speechPosition(x,y,145,60); assert.ok(p.x>=4 && p.x+145<=476);assert.ok(p.y>=4 && p.y+60+6<=320);
  }
});
