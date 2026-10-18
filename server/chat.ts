import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import WebSocket from 'ws';
import { ChatStore, ChatError } from './chat-store.ts';
import type { ChatActor } from './chat-store.ts';
import type { ChatAction, ChatEvent, ChatMessage } from '../src/game/chat.ts';
import { chatText } from '../src/game/chat.ts';
import { normalizeName } from '../src/network/protocol.ts';
export type SlackChatConfig = { token: string; secret: string; team: string; channel: string; label: string };
export function readSlackChatConfig(env: Record<string, string | undefined>): SlackChatConfig | undefined {
  if (!env.SLACK_CHAT_ENABLED || env.SLACK_CHAT_ENABLED === 'false') return;
  if (env.SLACK_CHAT_ENABLED !== 'true' || !env.SLACK_BOT_TOKEN?.startsWith('xoxb-') || !env.SLACK_SIGNING_SECRET || !/^T[A-Z0-9]{8,39}$/.test(env.SLACK_CHAT_TEAM_ID ?? '') || !/^C[A-Z0-9]{8,39}$/.test(env.SLACK_CHAT_CHANNEL_ID ?? '')) throw new Error('Complete the server-only Slack chat settings before enabling the bridge.');
  return { token: env.SLACK_BOT_TOKEN, secret: env.SLACK_SIGNING_SECRET, team: env.SLACK_CHAT_TEAM_ID!, channel: env.SLACK_CHAT_CHANNEL_ID!, label: env.SLACK_CHAT_CHANNEL_NAME?.slice(0, 80) || '#waiwai' };
}
export function validSlackSignature(raw: Buffer, timestamp: string, signature: string, secret: string, now = Date.now()): boolean {
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^v0=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = 'v0=' + createHmac('sha256', secret).update(`v0:${timestamp}:`).update(raw).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export class ChatService {
  readonly store: ChatStore;
  private clients = new Map<WebSocket, () => ChatActor>();
  private rates = new Map<string, number[]>();
  private timer?: ReturnType<typeof setInterval>;
  private summaryTimer?: ReturnType<typeof setTimeout>;
  private dirty = new Set<WebSocket>();
  private sending = false;
  private closed = false;
  private abort = new AbortController();
  private slack?: SlackChatConfig;
  private http: typeof fetch;
  private testParticipants = new Map<string, { actor: () => ChatActor; reply: (text: string) => string | undefined }>();
  private testReplies = new Set<ReturnType<typeof setTimeout>>();
  setTestParticipants(participants: { actor: () => ChatActor; reply: (text: string) => string | undefined }[]): void {
    for (const timer of this.testReplies) clearTimeout(timer); this.testReplies.clear();
    this.testParticipants.clear();
    for (const participant of participants) {
      const actor = participant.actor(); this.store.account(actor.id, actor.name, false); this.testParticipants.set(actor.id, participant);
    }
  }
  private queueTestReply(actor: ChatActor, action: Extract<ChatAction, { type: 'chat-send' }>, message: ChatMessage): void {
    const target = action.target;
    const participant = target.kind === 'dm' ? this.testParticipants.get(target.peerId) : target.kind === 'room' ? [...this.testParticipants.values()].find(p => p.actor().roomId === target.roomId) : target.kind === 'group' ? [...this.testParticipants.values()].find(p => this.store.inGroup(target.groupId, p.actor().id)) : undefined;
    if (!participant || this.testReplies.size >= 256) return;
    const timer = setTimeout(() => {
      this.testReplies.delete(timer);
      if (this.closed || !this.testParticipants.has(participant.actor().id)) return;
      const bot = participant.actor(); if (target.kind === 'room' && bot.roomId !== target.roomId) return;
      try {
        const text = participant.reply(action.text); if (!text) return;
        const replyTarget = target.kind === 'dm' ? { kind: 'dm' as const, peerId: actor.id } : target;
        const result = this.store.append(bot, replyTarget, text, `test-reply:${message.id}`, false);
        if (result.fresh) this.publish(result.message);
      } catch { /* Test participants never interrupt delivery of a real message. */ }
    }, 650);
    timer.unref(); this.testReplies.add(timer);
  }
  constructor(file?: string, slack?: SlackChatConfig, http: typeof fetch = fetch) {
    this.slack = slack; this.http = http;
    this.store = new ChatStore(file);
    if (slack) { this.timer = setInterval(() => { void this.flush(); }, 1200); this.timer.unref(); }
  }
  join(ws: WebSocket, actor: () => ChatActor): void { this.clients.set(ws, actor); const a = actor(); this.store.account(a.id, a.name, a.persistent); this.state(ws); }
  leave(ws: WebSocket): void { this.clients.delete(ws); this.dirty.delete(ws); }
  profile(ws: WebSocket): void { const actor = this.clients.get(ws)?.(); if (actor) this.store.account(actor.id, actor.name, actor.persistent); }
  state(ws: WebSocket): void {
    const actor = this.clients.get(ws)?.(); if (!actor) return;
    this.send(ws, { type: 'chat-state', selfId: actor.id, persistent: actor.persistent, threads: this.store.inbox(actor), slackEnabled: !!this.slack, ...(this.slack ? { slackChannel: this.slack.label } : {}) });
  }
  private send(ws: WebSocket, data: ChatEvent): void { if (ws.readyState !== WebSocket.OPEN) return; if (ws.bufferedAmount > 1024 * 1024) { ws.terminate(); return; } ws.send(JSON.stringify(data)); }
  private publish(message: ChatMessage): void {
    for (const [ws, getActor] of this.clients) if (this.store.visible(getActor(), message)) { this.send(ws, { type: 'chat-message', message }); this.dirty.add(ws); }
    if (!this.summaryTimer) this.summaryTimer = setTimeout(() => { this.summaryTimer = undefined; const clients = [...this.dirty]; this.dirty.clear(); for (const ws of clients) this.state(ws); }, 100);
  }
  action(ws: WebSocket, action: ChatAction): void {
    const actor = this.clients.get(ws)?.(); if (!actor) return;
    try {
      if (action.type === 'chat-group-create') {
        const recent = (this.rates.get(actor.id) ?? []).filter(t => t > Date.now() - 5000);
        if (recent.length >= 6) throw new ChatError('少し待ってから操作してください。');
        recent.push(Date.now()); this.rates.set(actor.id, recent);
        for (const id of action.memberIds) if (id.startsWith('guest:') && !this.testParticipants.has(id) && ![...this.clients.values()].some(get => get().id === id)) throw new ChatError('退出済みのゲストは追加できません。');
        const target = this.store.createGroup(actor, action.groupId, action.name, action.memberIds);
        for (const client of this.clients.keys()) this.state(client);
        this.send(ws, { type: 'chat-group-created', actionId: action.actionId, target }); return;
      }
      if (action.type === 'chat-send' && action.target.kind === 'dm' && action.target.peerId.startsWith('guest:') && !this.testParticipants.has(action.target.peerId) && ![...this.clients.values()].some(get => get().id === (action.target as { peerId: string }).peerId)) throw new ChatError('ゲストは退出しています。継続したDMにはログインが必要です。');
      if (action.type === 'chat-history') { this.send(ws, { type: 'chat-history', actionId: action.actionId, target: action.target, ...this.store.history(actor, action.target, action.before) }); return; }
      if (action.type === 'chat-read') {
        this.store.read(actor, action.target, action.through);
        for (const [client, get] of this.clients) if (get().id === actor.id) this.state(client);
      } else {
        const now = Date.now(), recent = (this.rates.get(actor.id) ?? []).filter(t => t > now - 5000);
        if (recent.length >= 6) throw new ChatError('少し待ってから送信してください。');
        recent.push(now); this.rates.set(actor.id, recent);
        if (action.shareSlack && !this.slack) throw new ChatError('Slack連携は管理者の設定後に利用できます。');
        this.store.account(actor.id, actor.name, actor.persistent);
        const result = this.store.append(actor, action.target, action.text, action.actionId, action.shareSlack);
        if (result.fresh) { this.publish(result.message); this.queueTestReply(actor, action, result.message); }
      }
      this.send(ws, { type: 'chat-result', actionId: action.actionId, delivery: action.type === 'chat-send' && action.shareSlack ? 'slack-queued' : 'saved' });
    } catch (error) { this.send(ws, { type: 'chat-result', actionId: action.actionId, error: error instanceof ChatError ? error.message : '保存できませんでした。時間をおいて再送してください。' }); }
  }
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    if (request.url?.split('?')[0] !== '/api/slack/events') return false;
    if (!this.slack) { response.writeHead(404).end(); return true; }
    if (request.method !== 'POST') { response.writeHead(405).end(); return true; }
    const parts: Buffer[] = []; let size = 0;
    for await (const part of request) { size += part.length; if (size > 128 * 1024) { response.writeHead(413).end(); return true; } parts.push(Buffer.from(part)); }
    const raw = Buffer.concat(parts), timestamp = String(request.headers['x-slack-request-timestamp'] ?? ''), signature = String(request.headers['x-slack-signature'] ?? '');
    if (!validSlackSignature(raw, timestamp, signature, this.slack.secret)) { response.writeHead(401).end(); return true; }
    try {
      const body = JSON.parse(raw.toString());
      if (body.type === 'url_verification' && typeof body.challenge === 'string') { response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ challenge: body.challenge })); return true; }
      const event = body.event;
      if (body.team_id === this.slack.team && body.type === 'event_callback' && /^Ev[A-Za-z0-9]+$/.test(body.event_id) && event?.type === 'message' && !event.bot_id && !event.subtype && !event.thread_ts && event.channel === this.slack.channel && /^U[A-Z0-9]{8,39}$/.test(event.user) && chatText(event.text)) {
        const id = `slack:${body.team_id}:${event.user}`;
        // Names from signed payloads are plain text; never trust browser-supplied identities.
        const name = this.store.accountName(id) ?? normalizeName(typeof event.username === 'string' ? event.username : `Slack ${event.user}`);
        this.store.account(id, name, true);
        const result = this.store.append({ id, name, roomId: 'office', persistent: true }, { kind: 'global' }, event.text, 'slack:' + body.event_id, false, 'slack');
        if (result.fresh) this.publish(result.message);
      }
      response.writeHead(200).end();
    } catch { response.writeHead(503).end('Retry later'); }
    return true;
  }
  async flush(): Promise<void> {
    if (!this.slack || this.sending || this.closed) return;
    const message = this.store.nextSlack(); if (!message) return;
    this.sending = true;
    try {
      const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
      const response = await this.http('https://slack.com/api/chat.postMessage', { method: 'POST', headers: { Authorization: `Bearer ${this.slack.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel: this.slack.channel, text: `${escape(message.authorName)} · Waiwai\n${escape(message.text)}`, mrkdwn: false, parse: 'none', link_names: false, unfurl_links: false, unfurl_media: false, client_msg_id: message.id.split(':').at(-1) }), signal: AbortSignal.any([this.abort.signal, AbortSignal.timeout(10_000)]) });
      const data = response.ok ? await response.json() as { ok?: boolean } : undefined;
      if (this.closed) return;
      if (data?.ok) this.store.slackDone(message.seq);
      else this.store.slackRetry(message.seq, response.status === 429 ? Math.min(3600, Math.max(1, Number(response.headers.get('retry-after')) || 30)) : Math.min(3600, 5 * 2 ** Math.min(message.attempts, 9)));
    } catch { if (!this.closed) this.store.slackRetry(message.seq, Math.min(3600, 10 * 2 ** Math.min(message.attempts, 8))); }
    finally { this.sending = false; }
  }
  close(): void { this.closed = true; for (const timer of this.testReplies) clearTimeout(timer); this.testReplies.clear(); this.testParticipants.clear(); clearInterval(this.timer); clearTimeout(this.summaryTimer); this.abort.abort(); this.clients.clear(); this.store.close(); }
}
