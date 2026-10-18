import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHmac, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import WebSocket from 'ws';
import { ChatService, validSlackSignature, readSlackChatConfig } from './chat.ts';
import type { ChatEvent } from '../src/game/chat.ts';
const config={ token:'xoxb-test-only', secret:'test-signing-secret', team:'T012ABCDEF', channel:'C012ABCDEF', label:'#waiwai' };
const actor=(n:number)=>({id:`slack:T012ABCDEF:U${String(n).padStart(9,'0')}`,name:`User${n}`,persistent:true,roomId:'office' as const});
test('three clients receive only their DM and current-room traffic; offline inbox is available on rejoin', async t=>{
  const chat=new ChatService();const server=createServer();const wss=new (await import('ws')).WebSocketServer({server});const logs:ChatEvent[][]=[[],[],[]]; const clients:WebSocket[]=[];
  const serverClients:WebSocket[]=[];
  wss.on('connection',(ws,req)=>{const index=Number(req.url!.slice(1));serverClients[index]=ws;chat.join(ws,()=>actor(index));});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{clients.forEach(c=>c.terminate());serverClients.forEach(c=>c.terminate());chat.close();wss.close();await new Promise<void>(r=>server.close(()=>r()));});
  for(let i=0;i<3;i++){const ws=new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/${i}`);clients.push(ws);ws.on('message',raw=>logs[i].push(JSON.parse(String(raw))));await once(ws,'open');}
  chat.action(serverClients[0],{type:'chat-send',target:{kind:'dm',peerId:actor(1).id},text:'secret',shareSlack:false,actionId:randomUUID()});
  await new Promise(r=>setTimeout(r,40)); assert.equal(logs[0].some(e=>e.type==='chat-message' && e.message.text==='secret'),true);assert.equal(logs[1].some(e=>e.type==='chat-message' && e.message.text==='secret'),true);assert.equal(logs[2].some(e=>JSON.stringify(e).includes('secret')),false);
  chat.leave(serverClients[1]);chat.action(serverClients[0],{type:'chat-send',target:{kind:'dm',peerId:actor(1).id},text:'offline',shareSlack:false,actionId:randomUUID()});
  chat.join(serverClients[1],()=>actor(1)); await new Promise(r=>setTimeout(r,40));const state=logs[1].filter(e=>e.type==='chat-state').at(-1)!;assert.equal(state.type,'chat-state');if(state.type==='chat-state')assert.equal(state.threads.find(t=>t.target.kind==='dm')!.unread,2);
  const visitor={...actor(2),roomId:'cafe' as const}; chat.join(serverClients[2],()=>visitor);
  chat.action(serverClients[0],{type:'chat-send',target:{kind:'room',roomId:'office'},text:'office-only',shareSlack:false,actionId:randomUUID()});
  chat.action(serverClients[2],{type:'chat-history',target:{kind:'room',roomId:'office'},actionId:randomUUID()});await new Promise(r=>setTimeout(r,40));assert.equal(logs[2].some(e=>JSON.stringify(e).includes('office-only')),false);assert.equal(logs[2].some(e=>e.type==='chat-result' && e.error),true);
});
test('live group traffic and membership are delivered only to members across floors and reconnects', async t => {
  const chat = new ChatService(), server = createServer(), { WebSocketServer } = await import('ws'), wss = new WebSocketServer({server});
  const sockets: WebSocket[] = [], clients: WebSocket[] = [], logs: ChatEvent[][] = [[],[],[]];
  wss.on('connection',(ws,req) => {const i=Number(req.url!.slice(1)); sockets[i]=ws; chat.join(ws,()=>({...actor(i),roomId:i===1?'cafe':'office'}));});
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
  t.after(async()=>{clients.forEach(c=>c.terminate());sockets.forEach(c=>c.terminate());chat.close();wss.close();await new Promise<void>(r=>server.close(()=>r()));});
  for(let i=0;i<3;i++){const ws=new WebSocket(`ws://127.0.0.1:${(server.address() as AddressInfo).port}/${i}`); clients.push(ws);ws.on('message',raw=>logs[i].push(JSON.parse(String(raw))));await once(ws,'open');}
  const groupId=randomUUID();chat.action(sockets[0],{type:'chat-group-create',groupId,name:'private group',memberIds:[actor(1).id],actionId:randomUUID()});
  chat.action(sockets[0],{type:'chat-send',target:{kind:'group',groupId},text:'private group message',shareSlack:false,actionId:randomUUID()});
  await new Promise(r=>setTimeout(r,140));
  assert.equal(logs[1].some(m=>m.type==='chat-message' && m.message.text==='private group message'),true);
  assert.equal(logs[2].some(m=>JSON.stringify(m).includes('private group')),false);
  chat.action(sockets[2],{type:'chat-history',target:{kind:'group',groupId},actionId:randomUUID()});
  await new Promise(r=>setTimeout(r,30)); assert.ok(logs[2].some(m=>m.type==='chat-result' && m.error));
  chat.leave(sockets[1]);chat.action(sockets[0],{type:'chat-send',target:{kind:'group',groupId},text:'offline group message',shareSlack:false,actionId:randomUUID()});
  chat.join(sockets[1],()=>actor(1));await new Promise(r=>setTimeout(r,30));
  const state=logs[1].filter((m):m is Extract<ChatEvent,{type:'chat-state'}>=>m.type==='chat-state').at(-1)!;
  assert.equal(state.threads.find(t=>t.target.kind==='group')!.unread,2);
});

test('Slack events require a fresh raw-body signature, correct workspace/channel, deduplicate and ignore bot loops',async t=>{
  const chat=new ChatService(undefined,config);const server=createServer((req,res)=>{void chat.handle(req,res).then(handled=>{if(!handled)res.writeHead(404).end();});});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{chat.close();await new Promise<void>(r=>server.close(()=>r()));});
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/slack/events`;
  const body={type:'event_callback',team_id:config.team,event_id:'EvTest123',event:{type:'message',channel:config.channel,user:'U012ABCDEF',text:'Slack hello'}};
  const post=async(payload:unknown,bad=false)=>{const raw=JSON.stringify(payload),ts=String(Math.floor(Date.now()/1000)),signature='v0='+createHmac('sha256',config.secret).update(`v0:${ts}:${raw}`).digest('hex');return fetch(url,{method:'POST',headers:{'x-slack-request-timestamp':ts,'x-slack-signature':bad?signature.replace(/.$/,'z'):signature},body:raw});};
  assert.equal((await post(body,true)).status,401);assert.equal((await post(body)).status,200);assert.equal((await post(body)).status,200);
  for(const event of [{...body,event_id:'EvWrong',team_id:'T999999999'},{...body,event_id:'EvBot',event:{...body.event,bot_id:'Btest'}},{...body,event_id:'EvOther',event:{...body.event,channel:'C999999999'}}])assert.equal((await post(event)).status,200);
  const entries=chat.store.history(actor(0),{kind:'global'}).messages;assert.equal(entries.length,1);assert.equal(entries[0].source,'slack');assert.equal(chat.store.nextSlack(),undefined);
  assert.equal(validSlackSignature(Buffer.from('x'),'1000000000','v0='+'0'.repeat(64),config.secret),false);
  assert.equal(readSlackChatConfig({}),undefined);assert.throws(()=>readSlackChatConfig({SLACK_CHAT_ENABLED:'true'}));
});
test('Slack export uses only opted-in global messages, escapes mentions, retries 429 and resumes its durable queue',async()=>{
  const calls:Array<Record<string,unknown>>=[];const chat=new ChatService(undefined,config,(async(_url,init)=>{calls.push(JSON.parse(String(init?.body)));return Response.json({ok:true});}) as typeof fetch);const a=actor(0);chat.store.account(a.id,a.name,true);
  chat.store.append(a,{kind:'global'},'<@U012ABCDEF> & <!channel>',randomUUID(),true);chat.store.append(a,{kind:'room',roomId:'office'},'not exported',randomUUID());await chat.flush();assert.equal(calls.length,1);assert.ok(String(calls[0].text).includes('&lt;@'));assert.equal(calls[0].mrkdwn,false);assert.equal(chat.store.nextSlack(),undefined);chat.close();
  const retry=new ChatService(undefined,config,(async()=>new Response('',{status:429,headers:{'retry-after':'60'}})) as typeof fetch);retry.store.account(a.id,a.name,true);retry.store.append(a,{kind:'global'},'later',randomUUID(),true);await retry.flush();assert.equal(retry.store.nextSlack(),undefined);assert.equal(retry.store.nextSlack(Date.now()+61_000)?.attempts,1);retry.close();
});
