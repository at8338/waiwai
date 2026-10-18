import type { ChatUI } from './chat-ui.ts';
import type { AnnouncementSnapshot } from './announcements.ts';
import { focusIcon } from './focus-icons.ts';
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
  private sourceObserver: MutationObserver;
  private personal = document.createElement('dialog');
  private lost = document.createElement('dialog');
  private proxies: { target: HTMLButtonElement; button: HTMLButtonElement }[] = [];
  private toolsResize: ResizeObserver;
  private tooltip = document.createElement('div');
  private lostExpanded = false;
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
    this.shell.innerHTML = '<header class="focus-heading"><strong>WAIWAI<span data-room-name>ひだまりオフィス</span></strong><span id="focus-network" role="status"></span><button type="button" id="focus-exit">通常表示に戻る</button></header><nav id="focus-utilities" aria-label="オフィスのすべての機能"></nav><section id="focus-furniture" aria-label="家具と小物の配置" hidden><button type="button" id="focus-furniture-close">配置パネルを閉じる</button><div id="focus-furniture-host"></div></section><section class="focus-broadcast" aria-label="全館放送"><strong>館内放送</strong><div class="focus-broadcast-window"><p id="focus-broadcast-text" aria-live="polite"></p></div><button type="button" id="focus-broadcast-pause" aria-pressed="false">一時停止</button><button type="button" data-focus-proxy="broadcast-open">放送する</button></section><div id="focus-content"></div><div class="focus-workspace"><aside id="focus-chat-host" aria-label="チャット"></aside><main id="focus-map-host"></main></div><footer id="focus-footer"></footer>';
    document.body.append(this.shell);
    this.personal.id = 'focus-personal-dialog'; this.personal.className = 'focus-personal-dialog'; this.personal.setAttribute('aria-labelledby', 'focus-personal-title');
    this.personal.innerHTML = '<h2 id="focus-personal-title" tabindex="-1" autofocus>個人設定・ログイン</h2><div id="focus-personal-host"></div><form method="dialog"><button type="submit">マップにもどる</button></form>';
    this.lost.id = 'focus-lost-dialog'; this.lost.setAttribute('aria-label', '床の落とし物');
    this.lost.innerHTML = '<h2>床の落とし物</h2><div id="focus-lost-host"></div><form method="dialog"><button type="submit">閉じる</button></form>';
    document.body.append(this.personal, this.lost);
    this.personal.addEventListener('click', event => {
      if ((event.target as Element).closest('#avatar-edit,#birthday-open,#buddy-edit,#pokemon-journal-open,[data-personal-open]')) this.personal.close();
    }, { signal, capture: true });
    this.lost.addEventListener('click', event => { if ((event.target as Element).closest('[data-lost-id]')) this.lost.close(); }, { signal, capture: true });
    for (const dialog of [this.personal, this.lost]) dialog.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    this.shell.querySelector('#focus-exit')!.addEventListener('click', () => this.toggle(false), { signal });
    const chatToggle = document.createElement('button'); chatToggle.type = 'button'; chatToggle.textContent = 'チャットを表示／隠す';
    this.shell.querySelector('.focus-heading')!.append(chatToggle);
    chatToggle.addEventListener('click', () => { this.shell.classList.toggle('chat-hidden'); this.refreshMap(); }, { signal });
    const utilities = this.shell.querySelector('#focus-utilities')!;
    for (const [id, label] of [['chat-open', 'チャット'], ['people-open', '人を探す'], ['daily-event-go', '今日の事件'], ['event-journal-open', '事件図鑑'], ['office-calendar-open', 'カレンダー'], ['broadcast-open', '館内放送'], ['schedule-open', '予定・定例'], ['avatar-edit', 'アバター'], ['buddy-edit', 'バディ'], ['pokemon-journal-open', 'ポケモン図鑑'], ['birthday-open', '誕生日'], ['spells-open', '魔法'], ['vehicle-open', '乗りもの'], ['room-picker-open', 'フロア一覧'], ['reset-position', '入口にもどる'], ['help-button', '操作ヘルプ'], ['admin-open', '管理者モード'], ['dev-world-open', '出現テスト']]) {
      const target = document.getElementById(id) as HTMLButtonElement | null; if (!target) continue;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.focusProxy = id; button.textContent = label; utilities.append(button); this.proxies.push({ target, button });
    }
    const personalButton = document.createElement('button'); personalButton.type = 'button'; personalButton.textContent = '個人設定・ログイン'; personalButton.id = 'focus-personal-open';
    personalButton.addEventListener('click', () => this.openPersonal(), { signal }); utilities.prepend(personalButton);
    const furniture = document.createElement('button'); furniture.id = 'focus-furniture-toggle'; furniture.type = 'button'; furniture.textContent = '家具・小物'; furniture.setAttribute('aria-expanded', 'false'); furniture.setAttribute('aria-controls', 'focus-furniture');
    utilities.querySelector('[data-focus-proxy="avatar-edit"]')!.before(furniture);
    furniture.addEventListener('click', () => this.showFurniture(this.shell.querySelector<HTMLElement>('#focus-furniture')!.hidden), { signal });
    this.shell.querySelector('#focus-furniture-close')!.addEventListener('click', () => this.showFurniture(false), { signal });
    const lost = document.createElement('button'); lost.type = 'button'; lost.textContent = '落とし物'; lost.id = 'focus-lost-open';
    lost.addEventListener('click', () => { this.clearMovement(); this.lost.showModal(); }, { signal }); utilities.querySelector('[data-focus-proxy="spells-open"]')!.before(lost);
    const syncProxies = () => { for (const { target, button } of this.proxies) { button.hidden = target.hidden; button.disabled = target.disabled; button.dataset.focusHint = target.textContent?.trim() ?? ''; } };
    this.sourceObserver = new MutationObserver(() => { syncProxies(); syncScroll(); });
    for (const { target } of this.proxies) this.sourceObserver.observe(target, { attributes: true, attributeFilter: ['hidden', 'disabled'], childList: true, characterData: true, subtree: true });
    syncProxies();
    const strip = document.createElement('div'); strip.className = 'focus-tools-row'; utilities.before(strip); strip.append(utilities);
    const previous = document.createElement('button'), next = document.createElement('button');
    previous.type = next.type = 'button'; previous.className = next.className = 'focus-tools-scroll';
    previous.setAttribute('aria-label', '前の機能を表示'); next.setAttribute('aria-label', '次の機能を表示'); previous.textContent = '‹'; next.textContent = '›';
    strip.prepend(previous); strip.append(next);
    const row = utilities as HTMLElement;
    const syncScroll = () => {
      const overflow = row.scrollWidth > strip.clientWidth + 2;
      previous.hidden = next.hidden = !overflow;
      previous.disabled = row.scrollLeft < 2; next.disabled = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
    };
    for (const [button, direction] of [[previous, -1], [next, 1]] as const) button.addEventListener('click', () => row.scrollBy({ left: direction * Math.max(120, row.clientWidth * .7), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), { signal });
    this.tooltip.id = 'focus-tool-tooltip'; this.tooltip.className = 'focus-tool-tooltip'; this.tooltip.setAttribute('role', 'tooltip'); this.tooltip.hidden = true; this.shell.append(this.tooltip);
    let tipButton: HTMLButtonElement | undefined;
    const hideTip = () => { this.tooltip.hidden = true; tipButton?.removeAttribute('aria-describedby'); tipButton = undefined; };
    const showTip = (button: HTMLButtonElement) => {
      hideTip(); tipButton = button; button.setAttribute('aria-describedby', this.tooltip.id);
      const label = button.getAttribute('aria-label') ?? '', hint = button.dataset.focusHint;
      this.tooltip.textContent = hint && hint !== label ? `${label} · ${hint}` : label;
      this.tooltip.hidden = false;
      const rect = button.getBoundingClientRect();
      this.tooltip.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - this.tooltip.offsetWidth - 8))}px`;
      this.tooltip.style.top = `${rect.bottom + 7}px`;
    };
    for (const button of utilities.querySelectorAll<HTMLButtonElement>('button')) {
      const label = button.textContent!; button.setAttribute('aria-label', label); button.innerHTML = focusIcon(button.dataset.focusProxy ?? button.id);
      button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') showTip(button); }, { signal });
      button.addEventListener('pointerleave', hideTip, { signal });
      button.addEventListener('focus', () => { button.scrollIntoView({ block: 'nearest', inline: 'nearest' }); showTip(button); }, { signal });
      button.addEventListener('blur', hideTip, { signal });
      button.addEventListener('click', hideTip, { signal });
    }
    utilities.addEventListener('keydown', event => {
      const key = (event as KeyboardEvent).key; if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
      const buttons = [...utilities.querySelectorAll<HTMLButtonElement>('button:not([hidden]):not(:disabled)')], index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return; event.preventDefault();
      buttons[key === 'Home' ? 0 : key === 'End' ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + (key === 'ArrowLeft' ? -1 : 1)))]?.focus();
    }, { signal });
    row.addEventListener('scroll', () => {
      if (tipButton && document.activeElement === tipButton) showTip(tipButton); else hideTip();
      syncScroll();
    }, { signal, passive: true });
    this.toolsResize = new ResizeObserver(syncScroll); this.toolsResize.observe(row);
    this.shell.addEventListener('click', event => {
      const id = (event.target as Element).closest<HTMLElement>('[data-focus-proxy]')?.dataset.focusProxy;
      if (id) { this.clearMovement(); document.getElementById(id)?.click(); }
    }, { signal });
    this.shell.querySelector('#focus-broadcast-pause')!.addEventListener('click', event => {
      const button = event.currentTarget as HTMLButtonElement, paused = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', String(paused)); button.textContent = paused ? '再生' : '一時停止'; this.shell.classList.toggle('ticker-paused', paused);
    }, { signal });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this.active && !document.querySelector('dialog[open]:not(.chat-docked)') && !(event.target instanceof HTMLElement && event.target.closest('input,textarea,select'))) {
        if (!this.shell.querySelector<HTMLElement>('#focus-furniture')!.hidden) this.showFurniture(false);
        else this.toggle(false);
      }
    }, { signal });
    this.timer = setInterval(() => this.renderTicker(), 1000);
    this.resize = new ResizeObserver(() => {
      const host = this.shell.querySelector<HTMLElement>('#focus-map-host')!;
      if (this.active) host.style.setProperty('--focus-map-space', `${Math.max(150, host.clientHeight - 155)}px`);
      this.refreshMap();
    }); this.resize.observe(document.querySelector('#game')!); this.resize.observe(this.shell.querySelector('#focus-map-host')!);
    this.renderTicker();
  }
  activateDefaults(loginRequired: boolean): void { this.mouse.click(); this.toggle(true); if (loginRequired) this.openPersonal(); }
  private openPersonal(): void { this.clearMovement(); if (!this.personal.open) this.personal.showModal(); }
  private showFurniture(enabled: boolean): void {
    this.clearMovement(); this.shell.querySelector<HTMLElement>('#focus-furniture')!.hidden = !enabled;
    this.shell.querySelector('#focus-furniture-toggle')!.setAttribute('aria-expanded', String(enabled)); this.refreshMap();
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
      for (const selector of ['.slack-login', '.profile-section', '.buddy-section', '.slack-settings', '.personal-data-section']) {
        const node = document.querySelector<HTMLElement>(selector); if (node) this.move(node, this.personal.querySelector('#focus-personal-host')!);
      }
      this.move(document.querySelector('#object-tools')!, this.shell.querySelector('#focus-furniture-host')!);
      const lost = document.querySelector<HTMLDetailsElement>('#lost-items-panel')!; this.lostExpanded = lost.open; lost.open = true; this.move(lost, this.lost.querySelector('#focus-lost-host')!);
      for (const id of ['daily-event-panel', 'birthday-banner', 'birthday-status', 'arena-panel', 'arcade-panel', 'cockpit-panel', 'connection-message']) this.move(document.getElementById(id)!, this.shell.querySelector('#focus-content')!);
      this.shell.classList.toggle('chat-hidden', window.matchMedia('(max-width: 900px)').matches);
      document.body.classList.add('office-focused'); this.chat.setDocked(this.shell.querySelector<HTMLElement>('#focus-chat-host')!, () => this.shell.classList.remove('chat-hidden'));
    } else {
      this.tooltip.hidden = true;
      this.personal.close(); this.lost.close(); this.showFurniture(false);
      this.chat.setDocked();
      for (const { node, marker } of this.placements) marker.replaceWith(node); this.placements = [];
      document.querySelector<HTMLDetailsElement>('#lost-items-panel')!.open = this.lostExpanded;
      document.body.classList.remove('office-focused'); this.shell.hidden = true;
    }
    this.button.setAttribute('aria-pressed', String(enabled)); this.button.textContent = enabled ? '⛶ 通常表示' : '⛶ フォーカスモード';
    this.refreshMap(); document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true });
  }
  setConnected(connected: boolean): void { this.connected = connected; this.shell.classList.toggle('focus-connected', connected); this.shell.querySelector('#focus-network')!.textContent = connected ? '● オンライン' : '再接続中'; this.renderTicker(); }
  receive(snapshot: AnnouncementSnapshot): void { this.broadcasts = snapshot; this.offset = snapshot.serverNow - Date.now(); this.renderTicker(); }
  private renderTicker(): void {
    const active = this.broadcasts.announcements.filter(a => a.expiresAt > Date.now() + this.offset).sort((a,b) => b.createdAt - a.createdAt);
    const text = active.map(a => `【${a.author || '館内放送'}】${a.title} ― ${a.message}`).join('　　◆　　') || (this.connected ? 'ただいま館内放送はありません。今日も、よい一日を。' : '接続を確認しています。館内放送は再接続後に更新します。');
    if (text === this.tickerKey) return; this.tickerKey = text;
    const line = this.shell.querySelector<HTMLElement>('#focus-broadcast-text')!; line.textContent = text;
    line.classList.toggle('is-scrolling', !!active.length); line.style.setProperty('--ticker-seconds', `${Math.max(18, text.length * 0.35)}s`);
  }
  destroy(): void { this.toggle(false); clearInterval(this.timer); this.resize.disconnect(); this.toolsResize.disconnect(); this.sourceObserver.disconnect(); this.personal.remove(); this.lost.remove(); this.shell.remove(); this.toolbar.remove(); }
}
