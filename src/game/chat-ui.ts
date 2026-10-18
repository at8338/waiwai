import type { SlackIdentity } from '../slack/dm.ts';
import type { ChatAction, ChatEvent, ChatMessage, ChatState, ChatTarget } from './chat.ts';
import type { Person } from './directory.ts';
import { slackDMUrl } from '../slack/dm.ts';
import { getRoom } from './rooms.ts';
const key = (target: ChatTarget) => JSON.stringify(target);
const date = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export class ChatUI {
  private dialog = document.createElement('dialog');
  private button = document.createElement('button');
  private state?: ChatState;
  private people: Person[] = [];
  private target?: ChatTarget;
  private conversation?: string;
  private messages = new Map<number, ChatMessage>();
  private drafts = new Map<string, string>();
  private connected = false;
  private history?: string;
  private hasMore = false;
  private pending?: Extract<ChatAction, { type: 'chat-send' }>;
  private timeout?: ReturnType<typeof setTimeout>;
  private readThrough = 0;
  private readTimer?: ReturnType<typeof setTimeout>;
  constructor(signal: AbortSignal, private send: (action: ChatAction) => boolean, private beforeOpen: () => void, private resolveSlack?: (id: string) => SlackIdentity | null | undefined) {
    this.button.id = 'chat-open'; this.button.type = 'button'; this.button.textContent = 'チャット';
    document.querySelector('#people-open')!.before(this.button);
    this.dialog.id = 'chat-dialog'; this.dialog.className = 'chat-dialog'; this.dialog.setAttribute('aria-labelledby', 'chat-title');
    this.dialog.innerHTML = `<header class="chat-heading"><div><span class="eyebrow">A LITTLE HELLO</span><h2 id="chat-title">Waiwaiチャット</h2></div><button type="button" id="chat-close">閉じる</button></header><p id="chat-identity" class="field-hint"></p><div class="chat-layout"><nav aria-label="会話を選ぶ"><div id="chat-threads"></div><label>DMの相手を探す<input id="chat-people-query" type="search" maxlength="80" placeholder="名前で探す"></label><div id="chat-people"></div></nav><section class="chat-conversation" aria-labelledby="chat-target-title"><header><h3 id="chat-target-title">会話を選んでください</h3><p id="chat-target-detail"></p><a id="chat-slack-dm" hidden>SlackのDMを開く ↗</a></header><button type="button" id="chat-older" hidden>以前のメッセージを読む</button><ol id="chat-messages" aria-label="メッセージ履歴" tabindex="0"></ol><p id="chat-empty">まだメッセージがありません。ひとこと送ってみよう。</p><form id="chat-form"><label for="chat-text">メッセージ</label><textarea id="chat-text" maxlength="1000" rows="3" placeholder="こんにちは！"></textarea><label id="chat-share-label" hidden><input id="chat-share-slack" type="checkbox"> <span id="chat-share-name"></span>にも送る</label><div class="chat-send-row"><span class="field-hint">1,000文字まで · 改行できます</span><button id="chat-send" type="submit">送信</button></div></form><p id="chat-status" role="status" aria-live="polite"></p></section></div>`;
    document.body.append(this.dialog);
    this.button.addEventListener('click', () => this.open(), { signal });
    this.el('chat-close').addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('close', () => { this.saveDraft(); document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }); }, { signal });
    this.el('chat-people-query').addEventListener('input', () => this.renderNavigation(), { signal });
    this.el('chat-threads').addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-thread-index]');
      const thread = this.state?.threads[Number(button?.dataset.threadIndex)]; if (button && thread) this.select(thread.target);
    }, { signal });
    this.el('chat-people').addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-chat-person]');
      if (button) this.openDM(button.dataset.chatPerson!);
    }, { signal });
    this.el('chat-older').addEventListener('click', () => this.load(this.oldest()), { signal });
    this.el('chat-messages').addEventListener('scroll', () => this.markRead(), { signal });
    window.addEventListener('focus', () => this.markRead(), { signal });
    document.addEventListener('visibilitychange', () => this.markRead(), { signal });
    this.el('chat-text').addEventListener('input', () => this.saveDraft(), { signal });
    this.el('chat-form').addEventListener('submit', event => {
      event.preventDefault(); if (!this.target || !this.connected || this.pending && this.timeout) return;
      const text = this.el<HTMLTextAreaElement>('chat-text').value.trim(); if (!text) return;
      const shareSlack = this.target.kind === 'global' && this.el<HTMLInputElement>('chat-share-slack').checked;
      const action = this.pending && key(this.pending.target) === key(this.target) && this.pending.text === text && this.pending.shareSlack === shareSlack ? this.pending : { type: 'chat-send' as const, target: this.target, text, shareSlack, actionId: crypto.randomUUID() };
      if (!this.send(action)) { this.status('再接続してから送信してください。下書きは残っています。'); return; }
      this.pending = action; this.status('保存しています…');
      this.timeout = setTimeout(() => { this.timeout = undefined; this.status('応答を確認できません。同じ内容を再送しても重複しません。'); this.renderControls(); }, 12_000); this.renderControls();
    }, { signal });
    this.renderControls();
  }
  private el<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>('#' + id)!; }
  peopleChanged(people: Person[]): void { this.people = people; this.renderNavigation(); this.renderHeader(); }
  connection(connected: boolean): void { this.connected = connected; if (!connected) { clearTimeout(this.timeout); this.timeout = undefined; this.history = undefined; this.conversation = undefined; this.readThrough = 0; this.messages.clear(); this.renderMessages(); this.status('再接続を待っています。下書きはこの画面に残っています。'); } this.renderControls(); }
  openDM(peerId: string): void { if (!this.connected || peerId === this.state?.selfId) return; this.beforeOpen(); if (!this.dialog.open) this.dialog.showModal(); this.select({ kind: 'dm', peerId }); }
  private open(): void { this.beforeOpen(); if (!this.dialog.open) this.dialog.showModal(); if (this.target) this.select(this.target); else { const room = this.state?.threads.find(t => t.target.kind === 'room'); if (room) this.select(room.target); } }
  private saveDraft(): void { if (this.target) this.drafts.set(key(this.target), this.el<HTMLTextAreaElement>('chat-text').value); }
  private select(target: ChatTarget): void {
    this.saveDraft(); this.target = target; this.conversation = undefined; this.messages.clear(); this.readThrough = 0; this.hasMore = false;
    this.el<HTMLTextAreaElement>('chat-text').value = this.drafts.get(key(target)) ?? '';
    this.el<HTMLInputElement>('chat-share-slack').checked = false;
    this.renderHeader(); this.renderMessages(); this.renderControls(); this.load();
  }
  private load(before?: number): void {
    if (!this.target || !this.connected) return;
    const actionId = crypto.randomUUID(); this.history = actionId;
    if (!this.send({ type: 'chat-history', target: this.target, actionId, ...(before ? { before } : {}) })) { this.history = undefined; this.status('履歴を読み込めません。再接続してください。'); }
    else this.status('履歴を読み込んでいます…');
  }
  receive(event: ChatEvent): void {
    if (event.type === 'chat-state') {
      const previousRoom = this.state?.threads.find(t => t.target.kind === 'room')?.conversation;
      if (this.state && this.state.selfId !== event.selfId) { this.target = undefined; this.conversation = undefined; this.messages.clear(); this.drafts.clear(); this.pending = undefined; clearTimeout(this.timeout); this.timeout = undefined; this.history = undefined; this.el<HTMLTextAreaElement>('chat-text').value = ''; this.renderMessages(); }
      this.state = event; this.renderNavigation(); this.renderControls(); this.renderHeader();
      this.el('chat-identity').textContent = event.persistent ? '履歴・未読はアカウントに紐づけて保存されます。DMは本人と相手だけに表示されます。' : 'ゲスト参加中です。再ログイン後もDMを受け取るにはMicrosoftまたはSlackでログインしてください。';
      const room = event.threads.find(t => t.target.kind === 'room');
      if (this.target?.kind === 'room' && room && previousRoom !== room.conversation) this.select(room.target);
      if (this.dialog.open && !this.target && room) this.select(room.target);
      else if (this.dialog.open && this.target && !this.conversation && !this.history) this.load();
      return;
    }
    if (event.type === 'chat-history') {
      if (event.actionId !== this.history || !this.target || key(event.target) !== key(this.target)) return;
      this.history = undefined; this.conversation = event.conversation; this.hasMore = event.hasMore;
      const older = this.messages.size > 0, list = this.el('chat-messages'), oldHeight = list.scrollHeight;
      for (const message of event.messages) this.messages.set(message.seq, message);
      this.renderMessages(); if (!older) list.scrollTop = list.scrollHeight; else list.scrollTop = list.scrollHeight - oldHeight;
      this.status(''); this.markRead(); return;
    }
    if (event.type === 'chat-message') {
      if (!this.dialog.open || event.message.conversation !== this.conversation) return;
      const list = this.el('chat-messages'), bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      this.messages.set(event.message.seq, event.message); this.renderMessages(); if (bottom) list.scrollTop = list.scrollHeight;
      this.markRead(); return;
    }
    if (event.type === 'chat-result') {
      if (event.actionId === this.history) { this.history = undefined; if (event.error) this.status(event.error); }
      if (event.actionId !== this.pending?.actionId) return;
      clearTimeout(this.timeout); this.timeout = undefined;
      if (!event.error) {
        const targetKey = key(this.pending.target); this.drafts.delete(targetKey);
        if (this.target && key(this.target) === targetKey && this.el<HTMLTextAreaElement>('chat-text').value.trim() === this.pending.text) this.el<HTMLTextAreaElement>('chat-text').value = '';
        this.pending = undefined;
      }
      this.status(event.error ?? (event.delivery === 'slack-queued' ? '保存しました。Slackへの送信を受け付けました。' : '送信しました。')); this.renderControls();
    }
  }
  private status(text: string): void { this.el('chat-status').textContent = text; }
  private oldest(): number | undefined { return this.messages.size ? Math.min(...this.messages.keys()) : undefined; }
  private markRead(): void {
    if (!this.readTimer) this.readTimer = setTimeout(() => { this.readTimer = undefined; this.flushRead(); }, 180);
  }
  private flushRead(): void {
    if (!this.dialog.open || !this.connected || document.visibilityState !== 'visible' || !document.hasFocus() || !this.target || !this.conversation || !this.messages.size) return;
    const list = this.el('chat-messages'); if (list.scrollHeight - list.scrollTop - list.clientHeight > 60) return;
    const through = Math.max(...this.messages.keys()); if (through <= this.readThrough) return;
    if (this.send({ type: 'chat-read', target: this.target, through, actionId: crypto.randomUUID() })) this.readThrough = through;
  }
  private renderHeader(): void {
    if (!this.target) return;
    const target = this.target, person = target.kind === 'dm' ? this.people.find(p => p.id === target.peerId) : undefined;
    const thread = this.state?.threads.find(t => key(t.target) === key(target));
    this.el('chat-target-title').textContent = target.kind === 'global' ? '全体チャット' : target.kind === 'room' ? getRoom(target.roomId).name + 'のチャット' : (person?.name ?? thread?.name ?? 'メンバー') + 'さんとのDM';
    this.el('chat-target-detail').textContent = target.kind === 'global' ? '全フロアで共有する会話です。' : target.kind === 'room' ? 'この部屋にいる人と会話します。履歴はこの部屋への入室中に読めます。' : person?.dummy ? 'テスト用の自動返信です。「ジャンプ」「お辞儀」「寝て」「起きて」も試せます。音声には参加しません。' : person?.online ? 'オンライン · 別の部屋に移動しても会話できます。' : 'オフライン · メッセージは次回ログイン時に届きます。';
    const link = this.el<HTMLAnchorElement>('chat-slack-dm'), url = slackDMUrl(person?.slack ?? (target.kind === 'dm' ? this.resolveSlack?.(target.peerId) : null));
    link.hidden = target.kind !== 'dm' || !url; if (url) link.href = url; else link.removeAttribute('href');
    this.el('chat-share-label').hidden = target.kind !== 'global' || !this.state?.slackEnabled;
    this.el('chat-share-name').textContent = this.state?.slackChannel ?? '#waiwai';
  }
  private renderNavigation(): void {
    const unread = this.state?.threads.reduce((n, t) => n + t.unread, 0) ?? 0;
    this.button.textContent = `チャット${unread ? ` · 未読${unread}` : ''}`;
    const threads = this.el('chat-threads'); threads.replaceChildren();
    this.state?.threads.forEach((thread, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.threadIndex = String(index); button.textContent = `${thread.target.kind === 'dm' ? '✉ ' : '# '}${thread.target.kind === 'dm' ? this.people.find(p => p.id === (thread.target as { peerId: string }).peerId)?.name ?? thread.name : thread.name}${thread.unread ? ` · ${thread.unread}` : ''}`;
      button.setAttribute('aria-pressed', String(!!this.target && key(thread.target) === key(this.target))); threads.append(button);
    });
    const people = this.el('chat-people'); people.replaceChildren();
    const query = this.el<HTMLInputElement>('chat-people-query').value.normalize('NFKC').toLocaleLowerCase('ja');
    for (const person of this.people.filter(p => p.id !== this.state?.selfId && p.name.normalize('NFKC').toLocaleLowerCase('ja').includes(query))) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.chatPerson = person.id; button.textContent = `${person.online ? '●' : '○'} ${person.name}`; button.disabled = !this.connected; people.append(button);
    }
  }
  private renderMessages(): void {
    const list = this.el('chat-messages'); list.replaceChildren();
    for (const message of [...this.messages.values()].sort((a, b) => a.seq - b.seq)) {
      const item = document.createElement('li'); item.dataset.messageSeq = String(message.seq); item.className = message.authorId === this.state?.selfId ? 'is-self' : '';
      const meta = document.createElement('div'); meta.className = 'chat-message-meta'; meta.textContent = `${message.authorName} · ${date.format(message.createdAt)} JST${message.source === 'slack' ? ' · Slackから' : ''}`;
      const text = document.createElement('p'); text.textContent = message.text; item.append(meta, text); list.append(item);
    }
    this.el('chat-empty').hidden = !!this.messages.size; this.el('chat-older').hidden = !this.hasMore;
  }
  private renderControls(): void { this.button.disabled = !this.connected; this.el<HTMLButtonElement>('chat-send').disabled = !this.connected || !this.target || !!this.timeout; this.el<HTMLTextAreaElement>('chat-text').disabled = !this.connected || !this.target; }
  destroy(): void { clearTimeout(this.timeout); clearTimeout(this.readTimer); this.dialog.remove(); this.button.remove(); }
}
