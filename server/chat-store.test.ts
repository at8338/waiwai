import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ChatStore } from './chat-store.ts';
import type { ChatActor } from './chat-store.ts';
import { parseClientMessage } from '../src/network/protocol.ts';
const a: ChatActor = { id: 'entra:11111111-1111-1111-1111-111111111111:22222222-2222-2222-2222-222222222222', name: 'Alice', persistent: true, roomId: 'office' };
const b: ChatActor = { ...a, id: 'slack:T012ABCDEF:U012ABCDEF', name: 'Bob' }, c: ChatActor = { ...b, id: 'slack:T012ABCDEF:U112ABCDEF', name: 'Carol' };
test('DM history, offline unread and receipts persist across restart without exposing another pair', t => {
  const dir = mkdtempSync(join(tmpdir(), 'waiwai-chat-')); t.after(() => rmSync(dir, { recursive: true, force: true })); const path = join(dir, 'chat.sqlite');
  let store = new ChatStore(path); for (const p of [a,b,c]) store.account(p.id,p.name,true);
  const actionId = randomUUID(), dm = { kind: 'dm' as const, peerId: b.id };
  const sent = store.append(a, dm, 'あとで読んでね', actionId); assert.equal(sent.fresh, true);
  assert.equal(store.append(a, dm, 'あとで読んでね', actionId).fresh, false);
  assert.equal(store.inbox(b).find(t => t.target.kind === 'dm')!.unread, 1);
  assert.equal(store.visible(c, sent.message), false); assert.equal(store.visible(b, sent.message), true);
  assert.deepEqual(store.history(c, { kind: 'dm', peerId: a.id }).messages, []);
  assert.throws(() => store.history(b, { kind: 'room', roomId: 'cafe' }));
  store.close(); store = new ChatStore(path);
  assert.equal(store.history(b, { kind: 'dm', peerId: a.id }).messages[0].text, 'あとで読んでね');
  store.read(b, { kind: 'dm', peerId: a.id }, sent.message.seq); store.close(); store = new ChatStore(path);
  assert.equal(store.inbox(b).find(t => t.target.kind === 'dm' && t.target.peerId === a.id)!.unread, 0); store.close();
});
test('history paginates stably, receipt watermarks cannot erase unseen future arrivals, and replay cannot change content', () => {
  const store = new ChatStore(); for (const p of [a,b]) store.account(p.id,p.name,true);
  for (let i=0;i<75;i++) store.append(a,{kind:'dm',peerId:b.id},String(i),randomUUID());
  const page = store.history(b,{kind:'dm',peerId:a.id}); assert.equal(page.messages.length,50); assert.equal(page.hasMore,true);
  const older = store.history(b,{kind:'dm',peerId:a.id},page.messages[0].seq); assert.equal(older.messages.length,25); assert.equal(older.hasMore,false);
  const last = page.messages.at(-1)!;
  store.append(a,{kind:'dm',peerId:b.id},'new',randomUUID());
  store.read(b,{kind:'dm',peerId:a.id},last.seq); assert.equal(store.inbox(b).find(t=>t.target.kind==='dm')!.unread,1);
  assert.throws(()=>store.read(b,{kind:'dm',peerId:a.id},999999));
  assert.throws(()=>store.append(a,{kind:'dm',peerId:b.id},'changed',last.id.split(':').at(-1)!)); store.close();
});
test('only the global conversation can queue Slack exports and forged author/identity fields are discarded', () => {
  const store = new ChatStore(); for(const p of [a,b]) store.account(p.id,p.name,true);
  assert.throws(()=>store.append(a,{kind:'dm',peerId:b.id},'private',randomUUID(),true));
  store.append(a,{kind:'room',roomId:'office'},'room only',randomUUID()); assert.equal(store.nextSlack(),undefined);
  const id=randomUUID(); const result=store.append(a,{kind:'global'},'share',id,true);store.append(a,{kind:'global'},'share',id,true);
  assert.equal(store.nextSlack()!.seq,result.message.seq);store.slackDone(result.message.seq);assert.equal(store.nextSlack(),undefined);
  const parsed=parseClientMessage(JSON.stringify({type:'chat-send',target:{kind:'dm',peerId:b.id},text:'hello',shareSlack:false,actionId:id,authorId:c.id,email:'forged@example.com'}));
  assert.ok(parsed && !('authorId' in parsed) && !('email' in parsed));
  for(const text of ['', 'x'.repeat(1001), '\u0000bad']) assert.equal(parseClientMessage(JSON.stringify({type:'chat-send',target:{kind:'global'},text,shareSlack:false,actionId:randomUUID()})),undefined);
  assert.equal(parseClientMessage(JSON.stringify({type:'chat-send',target:{kind:'dm',peerId:b.id},text:'private',shareSlack:true,actionId:randomUUID()})),undefined);store.close();
});

test('a SQLite backup captures live WAL messages and refuses to overwrite an existing backup', async t => {
  const { execFileSync } = await import('node:child_process');
  const dir=mkdtempSync(join(tmpdir(),'waiwai-chat-backup-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const file=join(dir,'source.sqlite'),destination=join(dir,'snapshot.sqlite');const store=new ChatStore(file);store.account(a.id,a.name,true);store.append(a,{kind:'global'},'in WAL',randomUUID());
  execFileSync(process.execPath,['scripts/chat/backup.mjs',file,destination],{stdio:'pipe'});
  const copy=new ChatStore(destination);assert.equal(copy.history(a,{kind:'global'}).messages[0].text,'in WAL');copy.close();
  assert.throws(()=>execFileSync(process.execPath,['scripts/chat/backup.mjs',file,destination],{stdio:'pipe'}));store.close();
});
