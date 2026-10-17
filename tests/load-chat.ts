import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { attachOffice } from '../server/office.ts';
import { ChatService } from '../server/chat.ts';
import type { ServerMessage } from '../src/network/protocol.ts';
const dir = await mkdtemp(join(tmpdir(), 'waiwai-chat-load-'));
const chat = new ChatService(join(dir,'chat.sqlite'));
const server = createServer(); const stop = attachOffice(server, undefined, { chat });
const clients: WebSocket[] = [], pending = new Map<string, { start: number; resolve: () => void }>();
const acks: number[] = []; let deliveries=0, unexpectedCloses=0, measuring=false;
const loop = monitorEventLoopDelay({resolution:10}); loop.enable();
try {
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as AddressInfo).port;
  for(let i=0;i<150;i++) await new Promise<void>((resolve,reject)=>{
    const ws=new WebSocket(`ws://127.0.0.1:${port}/office`,{origin:`http://127.0.0.1:${port}`});clients.push(ws);ws.on('error',reject);ws.on('close',()=>{if(measuring)unexpectedCloses++;});
    ws.on('message',raw=>{const m=JSON.parse(String(raw)) as ServerMessage;if(m.type==='chat-state'&&!measuring)resolve();if(m.type==='chat-message')deliveries++;if(m.type==='chat-result'){assert.equal(m.error,undefined);const p=pending.get(m.actionId);if(p){acks.push(performance.now()-p.start);pending.delete(m.actionId);p.resolve();}}});
  });
  measuring=true;loop.reset();
  await Promise.race([Promise.all(clients.map((ws,i)=>new Promise<void>(resolve=>{const actionId=randomUUID();pending.set(actionId,{start:performance.now(),resolve});ws.send(JSON.stringify({type:'chat-send',target:{kind:'global'},text:`Load message ${i}`,shareSlack:false,actionId}));}))),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Chat load timeout')),15_000);timer.unref();})]);
  // Allow the final broadcasts to reach all receivers after the last sender ACK.
  const until=Date.now()+5000;while(deliveries<150*150&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
  await new Promise(r=>setTimeout(r,25));
  measuring=false;assert.equal(unexpectedCloses,0);assert.equal(deliveries,22500);assert.equal(acks.length,150);acks.sort((a,b)=>a-b);
  const result={clients:150,concurrentSends:150,deliveries,unexpectedCloses,ackP95Ms:acks[Math.ceil(acks.length*.95)-1],ackMaxMs:acks.at(-1),eventLoopP99Ms:loop.percentile(99)/1e6,storage:'SQLite WAL, local disk',audioMediaMeasured:false};
  assert.ok(result.ackP95Ms<2000,`p95 exceeds 2 seconds: ${result.ackP95Ms}`);
  console.log(JSON.stringify(result,null,2));if(process.env.CHAT_LOAD_OUTPUT)await writeFile(process.env.CHAT_LOAD_OUTPUT,JSON.stringify(result,null,2)+'\n');
} finally {measuring=false;loop.disable();clients.forEach(ws=>ws.terminate());stop();await new Promise<void>(r=>server.close(()=>r()));await rm(dir,{recursive:true,force:true});}
