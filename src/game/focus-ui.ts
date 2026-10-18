import type { ChatUI } from './chat-ui.ts';
import type { AnnouncementSnapshot } from './announcements.ts';
export class FocusUI {
  private shell = document.createElement('section');
  private button = document.createElement('button');
  private mouse = document.createElement('button');
  private toolbar = document.createElement('div');
  private placements: { node: HTMLElement; marker: Comment }[] = [];
  private active = false;
  private connected = false;
  private broadcasts: AnnouncementSnapshot = { announcements: [], schedules: [], serverNow: Date.now() };
  private offset = 0;
  private tickerKey = '';
  private timer: ReturnType<typeof setInterval>;
  private resize: ResizeObserver;
  constructor(signal: AbortSignal, private chat: ChatUI, private refreshMap: () => void, private clearMovement: () => void, mouseMode: (enabled: boolean) => void) {
    this.toolbar.className = 'office-view-modes';
    this.mouse.id = 'mouse-move-toggle'; this.mouse.type = 'button'; this.mouse.textContent = 'クリックで移動'; this.mouse.setAttribute('aria-pressed', 'false');
    this.button.id = 'office-focus-toggle'; this.button.type = 'button'; this.button.textContent = '⛶ フォーカスモード'; this.button.setAttribute('aria-pressed', 'false');
    const help = document.createElement('span'); help.id = 'click-move-status'; help.setAttribute('role', 'status'); help.textContent = '矢印キー / WASDで移動';
    this.toolbar.append(this.mouse, this.button, help); document.querySelector('.game-frame')!.before(this.toolbar);
    this.mouse.addEventListener('click', () => {
      const enabled = this.mouse.getAttribute('aria-pressed') !== 'true'; this.mouse.setAttribute('aria-pressed', String(enabled)); mouseMode(enabled);
      help.textContent = enabled ? '床をクリックで歩く · ダブルクリックで最大5マスダッシュ' : '矢印キー / WASDで移動';
    }, { signal });
    this.button.addEventListener('click', () => this.toggle(), { signal });
    this.shell.id = 'office-focus'; this.shell.hidden = true; this.shell.setAttribute('aria-label', 'オフィスのフォーカスモード');
    this.shell.innerHTML = '<header class="focus-heading"><strong>WAIWAI<span data-room-name>ひだまりオフィス</span></strong><span id="focus-network" role="status"></span><div id="focus-utilities"></div><button type="button" id="focus-exit">通常表示に戻る</button></header><section class="focus-broadcast" aria-label="全館放送"><strong>館内放送</strong><div class="focus-broadcast-window"><p id="focus-broadcast-text" aria-live="polite"></p></div><button type="button" id="focus-broadcast-pause" aria-pressed="false">一時停止</button><button type="button" data-focus-proxy="broadcast-open">放送する</button></section><div class="focus-workspace"><aside id="focus-chat-host" aria-label="チャット"></aside><main id="focus-map-host"></main></div><footer id="focus-footer"></footer>';
    document.body.append(this.shell);
    this.shell.querySelector('#focus-exit')!.addEventListener('click', () => this.toggle(false), { signal });
    const chatToggle = document.createElement('button'); chatToggle.type = 'button'; chatToggle.textContent = 'チャットを表示／隠す';
    this.shell.querySelector('.focus-heading')!.append(chatToggle);
    chatToggle.addEventListener('click', () => { this.shell.classList.toggle('chat-hidden'); this.refreshMap(); }, { signal });
    const utilities = this.shell.querySelector('#focus-utilities')!;
    for (const [id, label] of [['chat-open', 'チャット'], ['people-open', '人を探す'], ['office-calendar-open', 'カレンダー'], ['spells-open', '魔法'], ['vehicle-open', '乗りもの']]) {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.focusProxy = id; button.textContent = label; utilities.append(button);
    }
    this.shell.addEventListener('click', event => {
      const id = (event.target as Element).closest<HTMLElement>('[data-focus-proxy]')?.dataset.focusProxy;
      if (id) document.getElementById(id)?.click();
    }, { signal });
    this.shell.querySelector('#focus-broadcast-pause')!.addEventListener('click', event => {
      const button = event.currentTarget as HTMLButtonElement, paused = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(paused)); button.textContent = paused ? '再生' : '一時停止'; this.shell.classList.toggle('ticker-paused', paused);
    }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.active && !document.querySelector('dialog[open]:not(.chat-docked)') && !(event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))) this.toggle(false);
    }, { signal });
    this.timer = setInterval(() => this.renderTicker(), 1000);
    this.resize = new ResizeObserver(() => this.refreshMap()); this.resize.observe(document.querySelector('#game')!);
    this.renderTicker();
  }
  private move(node: HTMLElement, host: HTMLElement): void { const marker = document.createComment('focus-return'); node.before(marker); this.placements.push({ node, marker }); host.append(node); }
  private toggle(enabled = !this.active): void {
    if (enabled === this.active) return;
    this.clearMovement(); this.active = enabled;
    if (enabled) {
      this.shell.hidden = false;
      this.move(this.toolbar, this.shell.querySelector('#focus-map-host')!);
      this.move(document.querySelector('.game-frame')!, this.shell.querySelector('#focus-map-host')!);
      this.move(document.querySelector('#voice-controls')!, this.shell.querySelector('#focus-footer')!);
      this.move(document.querySelector('.magic-toolbar')!, this.shell.querySelector('#focus-footer')!);
      this.shell.classList.toggle('chat-hidden', window.matchMedia('(max-width: 900px)').matches);
      document.body.classList.add('office-focused'); this.chat.setDocked(this.shell.querySelector<HTMLElement>('#focus-chat-host')!, () => this.shell.classList.remove('chat-hidden'));
    } else {
      this.chat.setDocked();
      for (const { node, marker } of this.placements) marker.replaceWith(node); this.placements = [];
      document.body.classList.remove('office-focused'); this.shell.hidden = true;
    }
    this.button.setAttribute('aria-pressed', String(enabled)); this.button.textContent = enabled ? '⛶ 通常表示' : '⛶ フォーカスモード';
    this.refreshMap(); document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true });
  }
  setConnected(connected: boolean): void { this.connected = connected; this.shell.querySelector('#focus-network')!.textContent = connected ? '● オンライン' : '再接続中'; this.renderTicker(); }
  receive(snapshot: AnnouncementSnapshot): void { this.broadcasts = snapshot; this.offset = snapshot.serverNow - Date.now(); this.renderTicker(); }
  private renderTicker(): void {
    const active = this.broadcasts.announcements.filter(a => a.expiresAt > Date.now() + this.offset).sort((a,b) => b.createdAt - a.createdAt);
    const text = active.map(a => `【${a.author || '館内放送'}】${a.title} ― ${a.message}`).join('　　◆　　') || (this.connected ? 'ただいま館内放送はありません。今日も、よい一日を。' : '接続を確認しています。館内放送は再接続後に更新します。');
    if (text === this.tickerKey) return; this.tickerKey = text;
    const line = this.shell.querySelector<HTMLElement>('#focus-broadcast-text')!; line.textContent = text;
    line.classList.toggle('is-scrolling', !!active.length); line.style.setProperty('--ticker-seconds', `${Math.max(18, text.length * 0.35)}s`);
  }
  destroy(): void { this.toggle(false); clearInterval(this.timer); this.resize.disconnect(); this.shell.remove(); this.toolbar.remove(); }
}
