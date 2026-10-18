import { birthdayDay, birthdayOnDay, parseBirthdayAction } from './birthdays.ts';
import type { BirthdayAction, BirthdaySnapshot, BirthdayThread } from './birthdays.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
export class BirthdaysUI {
  private state?: BirthdaySnapshot;
  private connected = false;
  private version = 0;
  private pending?: { id: string; type: BirthdayAction['type'] };
  private timeout?: ReturnType<typeof setTimeout>;
  private effect?: ReturnType<typeof setTimeout>;
  private timer: ReturnType<typeof setInterval>;
  private day = '';
  private offset = 0;
  private thread?: BirthdayThread;
  private target?: { id: string; date: string };
  constructor(signal: AbortSignal, private send: (action: BirthdayAction) => boolean, private beforeOpen: () => boolean) {
    el('birthday-open').addEventListener('click', () => {
      if (!this.beforeOpen()) return;
      const mine = this.state?.entries.find((entry) => entry.id === this.state?.selfId);
      this.version = mine?.version ?? 0;
      el<HTMLSelectElement>('birthday-month').value = String(mine?.month ?? 1); el<HTMLSelectElement>('birthday-day').value = String(mine?.day ?? 1);
      this.status(''); el<HTMLDialogElement>('birthday-dialog').showModal();
    }, { signal });
    el('birthday-close').addEventListener('click', () => el<HTMLDialogElement>('birthday-dialog').close(), { signal });
    el('birthday-dialog').addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    el('birthday-form').addEventListener('submit', (event) => {
      event.preventDefault(); this.request({ type: 'birthday-save', month: Number(el<HTMLSelectElement>('birthday-month').value), day: Number(el<HTMLSelectElement>('birthday-day').value), expectedVersion: this.version, actionId: crypto.randomUUID() });
    }, { signal });
    el('birthday-delete').addEventListener('click', () => this.request({ type: 'birthday-delete', expectedVersion: this.version, actionId: crypto.randomUUID() }), { signal });
    el('birthday-people').addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-birthday-cheer]');
      if (button && !button.disabled) this.request({ type: 'birthday-cheer', id: button.dataset.birthdayCheer!, actionId: crypto.randomUUID() });
    }, { signal });
    document.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-birthday-comments]');
      if (button) this.openComments(button.dataset.birthdayComments!, button.dataset.birthdayDate!);
    }, { signal });
    el('birthday-comments-close').addEventListener('click', () => el<HTMLDialogElement>('birthday-comments-dialog').close(), { signal });
    el('birthday-comments-dialog').addEventListener('close', () => {
      if (el<HTMLDialogElement>('office-calendar-dialog').open) el('calendar-selected-date').focus({ preventScroll: true });
      else document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true });
    }, { signal });
    el('birthday-comment-form').addEventListener('submit', (event) => {
      event.preventDefault(); if (this.target && this.thread) this.request({ type: 'birthday-comment', ...this.target, text: el<HTMLTextAreaElement>('birthday-comment-text').value, actionId: crypto.randomUUID() });
    }, { signal });
    this.timer = setInterval(() => { const day = birthdayDay(Date.now() + this.offset); if (day !== this.day) this.render(); }, 1000);
    this.render();
  }
  receive(state: BirthdaySnapshot): void { this.state = state; this.offset = state.serverNow - Date.now(); this.render(); }
  receiveThread(thread: BirthdayThread): void {
    if (thread.id !== this.target?.id || thread.date !== this.target.date) return;
    this.thread = thread;
    if (this.pending?.type === 'birthday-thread') { this.pending = undefined; clearTimeout(this.timeout); this.status(''); }
    this.renderThread();
  }
  private openComments(id: string, date: string): void {
    if (!this.connected || !this.state || this.pending) return;
    if (!document.querySelector('dialog[open]:not(.chat-docked)') && !this.beforeOpen()) return;
    const entry = this.state.entries.find(e => e.id === id); if (!entry) return;
    this.target = { id, date }; this.thread = undefined;
    el('birthday-comments-title').textContent = `${entry.name}さん、お誕生日おめでとう！`;
    el('birthday-comments-date').textContent = `${date} のお誕生日`;
    el<HTMLTextAreaElement>('birthday-comment-text').value = '';
    this.request({ type: 'birthday-thread', id, date, actionId: crypto.randomUUID() });
    el<HTMLDialogElement>('birthday-comments-dialog').showModal(); this.renderThread();
  }
  setConnected(value: boolean): void { this.connected = value; if (!value) { this.state = undefined; this.pending = undefined; clearTimeout(this.timeout); } this.render(); }
  result(id: string, error?: string): void {
    if (this.pending?.id !== id) return;
    const type = this.pending.type; this.pending = undefined; clearTimeout(this.timeout);
    if (!error) this.version = this.state?.entries.find((entry) => entry.id === this.state?.selfId)?.version ?? 0;
    this.status(error ?? (type === 'birthday-comment' ? 'お祝いコメントを届けました！' : type === 'birthday-cheer' ? '🎉 お祝いを届けました！' : type === 'birthday-delete' ? '誕生日の登録を取り消しました。' : '誕生日を保存しました。みんなのカレンダーにも表示されます。'));
    if (!error && type === 'birthday-comment') el<HTMLTextAreaElement>('birthday-comment-text').value = '';
    if (!error && type === 'birthday-cheer') { el('birthday-banner').classList.add('is-celebrating'); clearTimeout(this.effect); this.effect = setTimeout(() => el('birthday-banner').classList.remove('is-celebrating'), 1200); }
    this.render();
  }
  destroy(): void { clearInterval(this.timer); clearTimeout(this.timeout); clearTimeout(this.effect); }
  private status(text: string): void { el('birthday-form-status').textContent = text; el('birthday-status').textContent = text; el('birthday-comment-status').textContent = text; }
  private request(action: BirthdayAction): void {
    if (!this.connected || !this.state || this.pending) return;
    if (!parseBirthdayAction(action as unknown as Record<string, unknown>)) { this.status('存在する月日を選んでください。'); return; }
    if (!this.send(action)) { this.status('再接続してから操作してください。'); return; }
    this.pending = { id: action.actionId, type: action.type }; this.status(action.type === 'birthday-thread' ? 'コメントを読み込んでいます…' : '保存しています…');
    this.timeout = setTimeout(() => { this.pending = undefined; this.status('応答を確認できません。一度閉じて登録内容を確認してください。'); this.render(); }, 8000); this.render();
  }
  private render(): void {
    const now = Date.now() + this.offset; this.day = birthdayDay(now);
    const entries = this.state?.entries ?? [], today = entries.filter((entry) => birthdayOnDay(entry, now)), disabled = !this.connected || !this.state || !!this.pending;
    el<HTMLButtonElement>('birthday-open').disabled = !this.connected || !this.state;
    const mine = entries.find(entry => entry.id === this.state?.selfId);
    el('birthday-profile-value').textContent = !this.connected ? '再接続を待っています' : mine ? `${mine.month}月${mine.day}日` : '未登録';
    el('birthday-banner').hidden = !this.connected || !today.length;
    const people = el('birthday-people'); people.replaceChildren();
    for (const entry of today) {
      const card = document.createElement('article'); card.className = 'birthday-person'; card.dataset.birthdayId = entry.id;
      const title = document.createElement('strong'); title.textContent = `${entry.id === this.state?.selfId ? 'あなた' : entry.name + 'さん'}、お誕生日おめでとう！`;
      const count = document.createElement('span'); count.textContent = `🎉 ${entry.cheers}人からのお祝い`;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.birthdayCheer = entry.id; button.disabled = disabled || entry.cheered;
      button.textContent = entry.cheered ? '✓ お祝い済み' : '🎉 おめでとう！'; button.setAttribute('aria-label', `${entry.name}さんにお祝いを送る`);
      const comments = document.createElement('button'); comments.type = 'button'; comments.dataset.birthdayComments = entry.id; comments.dataset.birthdayDate = this.day; comments.textContent = 'お祝いコメント'; comments.disabled = disabled;
      card.append(title, count, button, comments); people.append(card);
    }
    el('birthday-storage-help').textContent = this.state?.persistent ? 'ログインしたアカウントに紐づけて保存します。登録した月日と名前は館内で共有され、ログインしていない日もお祝いに表示されます。' : 'ゲストのお試し登録です。月日と名前は滞在中だけ館内で共有され、退出すると消えます。MicrosoftまたはSlackログインで毎年の登録を保存できます。';
    for (const id of ['birthday-month', 'birthday-day', 'birthday-save', 'birthday-delete']) el<HTMLInputElement | HTMLButtonElement>(id).disabled = disabled;
    el('birthday-delete').hidden = !entries.some((entry) => entry.id === this.state?.selfId);
    this.renderThread();
  }
  private renderThread(): void {
    const list = el('birthday-comments-list'); list.replaceChildren();
    for (const comment of this.thread?.comments ?? []) {
      const li = document.createElement('li'), name = document.createElement('strong'), text = document.createElement('p'), date = document.createElement('small');
      name.textContent = comment.authorName + (comment.authorId === this.state?.selfId ? '（あなた）' : 'さん'); text.textContent = comment.text;
      date.textContent = new Date(comment.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' JST'; li.append(name, text, date); list.append(li);
    }
    el('birthday-comments-empty').hidden = !this.thread || !!this.thread.comments.length;
    el<HTMLButtonElement>('birthday-comment-send').disabled = !this.connected || !this.thread || !!this.pending || !this.state?.entries.some(e => e.id === this.target?.id);
    el('birthday-comment-storage').textContent = this.state?.persistent && !this.target?.id.startsWith('guest:') ? 'コメントはサーバーに保存され、相手が後からログインしても読めます。200文字まで。' : 'ゲスト参加中のお祝いはお試しです。退出すると消えます。MicrosoftまたはSlackログインで保存できます。';
  }
}
