import { birthdayDay, birthdayOnDay, parseBirthdayAction } from './birthdays.ts';
import type { BirthdayAction, BirthdaySnapshot } from './birthdays.ts';
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
    this.timer = setInterval(() => { const day = birthdayDay(Date.now() + this.offset); if (day !== this.day) this.render(); }, 1000);
    this.render();
  }
  receive(state: BirthdaySnapshot): void { this.state = state; this.offset = state.serverNow - Date.now(); this.render(); }
  setConnected(value: boolean): void { this.connected = value; if (!value) { this.state = undefined; this.pending = undefined; clearTimeout(this.timeout); } this.render(); }
  result(id: string, error?: string): void {
    if (this.pending?.id !== id) return;
    const type = this.pending.type; this.pending = undefined; clearTimeout(this.timeout);
    if (!error) this.version = this.state?.entries.find((entry) => entry.id === this.state?.selfId)?.version ?? 0;
    this.status(error ?? (type === 'birthday-cheer' ? '🎉 お祝いを届けました！' : type === 'birthday-delete' ? '誕生日の登録を取り消しました。' : '誕生日を登録しました。当日はみんなでお祝いしましょう！'));
    if (!error && type === 'birthday-cheer') { el('birthday-banner').classList.add('is-celebrating'); clearTimeout(this.effect); this.effect = setTimeout(() => el('birthday-banner').classList.remove('is-celebrating'), 1200); }
    this.render();
  }
  destroy(): void { clearInterval(this.timer); clearTimeout(this.timeout); clearTimeout(this.effect); }
  private status(text: string): void { el('birthday-form-status').textContent = text; el('birthday-status').textContent = text; }
  private request(action: BirthdayAction): void {
    if (!this.connected || !this.state || this.pending) return;
    if (!parseBirthdayAction(action as unknown as Record<string, unknown>)) { this.status('存在する月日を選んでください。'); return; }
    if (!this.send(action)) { this.status('再接続してから操作してください。'); return; }
    this.pending = { id: action.actionId, type: action.type }; this.status('保存しています…');
    this.timeout = setTimeout(() => { this.pending = undefined; this.status('応答を確認できません。一度閉じて登録内容を確認してください。'); this.render(); }, 8000); this.render();
  }
  private render(): void {
    const now = Date.now() + this.offset; this.day = birthdayDay(now);
    const entries = this.state?.entries ?? [], today = entries.filter((entry) => birthdayOnDay(entry, now)), disabled = !this.connected || !this.state || !!this.pending;
    el<HTMLButtonElement>('birthday-open').disabled = !this.connected || !this.state;
    el('birthday-banner').hidden = !this.connected || !today.length;
    const people = el('birthday-people'); people.replaceChildren();
    for (const entry of today) {
      const card = document.createElement('article'); card.className = 'birthday-person'; card.dataset.birthdayId = entry.id;
      const title = document.createElement('strong'); title.textContent = `${entry.id === this.state?.selfId ? 'あなた' : entry.name + 'さん'}、お誕生日おめでとう！`;
      const count = document.createElement('span'); count.textContent = `🎉 ${entry.cheers}人からのお祝い`;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.birthdayCheer = entry.id; button.disabled = disabled || entry.cheered;
      button.textContent = entry.cheered ? '✓ お祝い済み' : '🎉 おめでとう！'; button.setAttribute('aria-label', `${entry.name}さんにお祝いを送る`);
      card.append(title, count, button); people.append(card);
    }
    el('birthday-storage-help').textContent = this.state?.persistent ? 'Slackアカウントに紐づけて保存します。登録した月日と名前は館内で共有され、ログインしていない日もお祝いに表示されます。' : 'ゲストのお試し登録です。月日と名前は滞在中だけ館内で共有され、退出すると消えます。Slackログインで毎年の登録を保存できます。';
    for (const id of ['birthday-month', 'birthday-day', 'birthday-save', 'birthday-delete']) el<HTMLInputElement | HTMLButtonElement>(id).disabled = disabled;
    el('birthday-delete').hidden = !entries.some((entry) => entry.id === this.state?.selfId);
    const list = el('birthday-list'); list.replaceChildren();
    for (const entry of [...entries].sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name, 'ja'))) {
      const item = document.createElement('li'); item.textContent = `${entry.month}月${entry.day}日 · ${entry.name}${entry.id === this.state?.selfId ? '（あなた）' : 'さん'}${birthdayOnDay(entry, now) ? ' 🎂 今日！' : ''}`; list.append(item);
    }
    el('birthday-empty').hidden = !!entries.length;
  }
}
