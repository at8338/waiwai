import type { DummyControl, DummyState } from './dummy-avatars.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';

export class DummyAvatarsUI {
  private section = document.createElement('section');
  private hint = document.createElement('p');
  private state?: DummyState;
  private connected = false;
  private pending?: string;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(signal: AbortSignal, private send: (action: DummyControl) => boolean, private room: () => RoomId) {
    this.section.className = 'dummy-admin'; this.section.hidden = true;
    this.section.innerHTML = '<h3>テスト用アバター</h3><p>3体がDM・部屋チャットに自動返信します。音声には参加しません。</p><p id="dummy-admin-summary"></p><div class="dialog-actions"><button type="button" id="dummy-show">このフロアで表示</button><button type="button" id="dummy-hide">非表示にする</button></div><p id="dummy-admin-status" role="status"></p>';
    const tabs = document.querySelector('#admin-dialog .admin-tabs')!; tabs.before(this.section);
    this.hint.className = 'dummy-avatar-hint'; this.hint.hidden = true;
    document.querySelector('#participants-title')?.after(this.hint);
    this.section.querySelector('#dummy-show')!.addEventListener('click', () => this.change(true), { signal });
    this.section.querySelector('#dummy-hide')!.addEventListener('click', () => this.change(false), { signal });
  }
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) { this.state = undefined; this.pending = undefined; clearTimeout(this.timer); }
    this.render();
  }
  receive(state: DummyState): void { this.state = state; this.render(); }
  private change(enabled: boolean): void {
    if (!this.connected || !this.state?.editable || this.pending) return;
    const action: DummyControl = { type: 'dummy-control', enabled, actionId: crypto.randomUUID(), ...(enabled ? { roomId: this.room() } : {}) };
    if (!this.send(action)) return;
    this.pending = action.actionId; this.status('変更しています…'); this.render();
    this.timer = setTimeout(() => { this.pending = undefined; this.status('変更結果を確認できません。再接続して確認してください。'); this.render(); }, 8000);
  }
  result(id: string, error?: string): void {
    if (id !== this.pending) return;
    this.pending = undefined; clearTimeout(this.timer);
    this.status(error ?? '変更しました。テスト状態は再起動すると初期設定に戻ります。'); this.render();
  }
  private status(text: string): void { this.section.querySelector('#dummy-admin-status')!.textContent = text; }
  private render(): void {
    this.section.hidden = !this.state?.editable;
    this.hint.hidden = !this.state?.enabled;
    this.hint.textContent = '「テスト」付きの人は自動応答アバターです。クリックしてDMを送れます。滞在人数にも含みます。';
    this.section.querySelector('#dummy-admin-summary')!.textContent = this.state?.roomId ? `${getRoom(this.state.roomId).name}に${this.state.count}体を表示中` : '現在は非表示です。';
    for (const button of this.section.querySelectorAll<HTMLButtonElement>('button')) button.disabled = !this.connected || !!this.pending || !this.state?.editable || button.id === 'dummy-hide' && !this.state?.enabled;
  }
  destroy(): void { clearTimeout(this.timer); this.section.remove(); this.hint.remove(); }
}
