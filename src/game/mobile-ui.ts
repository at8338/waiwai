import type { ChatUI } from './chat-ui.ts';
import { focusIcon } from './focus-icons.ts';
import { COLS, ROWS } from './world.ts';
import { mapScrollTarget, mobileMapWidth, setupMobileViewport } from './mobile-layout.ts';

/** Phone navigation reuses existing commands and their server-controlled state. */
export class MobileOfficeUI {
  private media = window.matchMedia('(max-width: 900px), (pointer: coarse)');
  private active = false;
  private dockMode = '';
  private zoom = 2;
  private following = true;
  private frame = 0;
  private lastPosition = '';
  private menus: HTMLDialogElement[] = [];
  private copies: { source: HTMLButtonElement; copy: HTMLButtonElement }[] = [];
  private observer: MutationObserver;
  private mapObserver: MutationObserver;
  private resize: ResizeObserver;
  private viewport = document.createElement('div');
  private controls = document.createElement('section');
  private nav = document.createElement('nav');
  private mapTools = document.createElement('div');
  private arrows = document.querySelector<HTMLElement>('.touch-controls')!;
  private arrowMarker = document.createComment('mobile-controls-return');
  private surround = document.querySelector<HTMLElement>('.map-surround')!;
  private canvas = document.querySelector<HTMLCanvasElement>('#game canvas')!;
  constructor(private shell: HTMLElement, private chat: ChatUI, signal: AbortSignal, private refresh: () => void, private stop: () => void) {
    setupMobileViewport(signal);
    this.arrows.before(this.arrowMarker);
    this.viewport.className = 'mobile-map-viewport'; this.viewport.setAttribute('aria-label', 'マップ表示。拡大中は指でスクロールできます');
    this.surround.before(this.viewport); this.viewport.append(this.surround);
    this.mapTools.className = 'mobile-map-tools'; this.mapTools.setAttribute('aria-label', 'マップの表示');
    this.mapTools.innerHTML = '<span>タップで移動</span><button type="button" data-map-fit>全体</button><button type="button" data-map-zoom="-1" aria-label="マップを縮小">−</button><output aria-live="polite"></output><button type="button" data-map-zoom="1" aria-label="マップを拡大">＋</button><button type="button" data-map-center>自分へ</button>';
    this.shell.querySelector('.focus-workspace')!.before(this.mapTools);
    for (const button of this.mapTools.querySelectorAll<HTMLButtonElement>('[data-map-zoom]')) button.addEventListener('click', () => { this.zoom = Math.max(1, Math.min(3, this.zoom + Number(button.dataset.mapZoom) * .5)); this.following = true; this.layoutMap(); }, { signal });
    this.mapTools.querySelector('[data-map-fit]')!.addEventListener('click', () => { this.zoom = 1; this.layoutMap(); }, { signal });
    this.mapTools.querySelector('[data-map-center]')!.addEventListener('click', () => { this.following = true; this.center(); }, { signal });
    let start: { x: number; y: number } | undefined;
    this.viewport.addEventListener('pointerdown', event => { start = { x: event.clientX, y: event.clientY }; }, { signal, passive: true });
    this.viewport.addEventListener('pointermove', event => { if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) this.following = false; }, { signal, passive: true });
    this.viewport.addEventListener('pointerup', () => { start = undefined; }, { signal, passive: true });
    this.viewport.addEventListener('pointercancel', () => { this.following = false; start = undefined; }, { signal, passive: true });
    this.viewport.addEventListener('wheel', () => { this.following = false; }, { signal, passive: true });

    const menu = this.makeDialog('mobile-menu-dialog', 'メニュー'), actions = this.makeDialog('mobile-actions-dialog', 'アクション');
    // The original one-row desktop toolbar remains the source of every feature.
    for (const source of this.shell.querySelectorAll<HTMLButtonElement>('#focus-utilities button')) {
      if (['mouse-move-toggle', 'office-focus-toggle'].includes(source.dataset.focusProxy ?? '')) continue;
      this.copyButton(source, menu.querySelector('.mobile-command-grid')!, signal);
    }
    for (const source of document.querySelectorAll<HTMLButtonElement>('[data-reaction],#toggle-rest,#spells-open,#spell-fire-quick,#spell-blizzard-quick,#vehicle-quick-drop')) this.copyButton(source, actions.querySelector('.mobile-command-grid')!, signal);
    this.controls.className = 'mobile-move-controls'; this.controls.setAttribute('aria-label', 'タップで移動');
    const halt = document.createElement('button'); halt.type = 'button'; halt.textContent = '■ 停止'; halt.setAttribute('aria-label', '移動を停止'); halt.addEventListener('click', this.stop, { signal }); this.controls.append(halt);
    this.nav.className = 'mobile-navigation'; this.nav.setAttribute('aria-label', 'メインナビゲーション');
    for (const [name, icon, run] of [
      ['オフィス', 'mouse-move-toggle', () => { this.stop(); this.following = true; this.center(); }],
      ['チャット', 'chat-open', () => document.getElementById('chat-open')!.click()],
      ['フロア', 'room-picker-open', () => document.getElementById('room-picker-open')!.click()],
      ['アクション', 'spells-open', () => actions.showModal()],
      ['メニュー', 'dev-world-open', () => menu.showModal()],
    ] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.innerHTML = `${focusIcon(icon)}<span>${name}</span>`;
      button.addEventListener('click', () => { this.stop(); run(); }, { signal }); this.nav.append(button);
    }
    this.shell.append(this.controls, this.nav);
    this.observer = new MutationObserver(() => this.syncCommands());
    for (const { source } of this.copies) this.observer.observe(source, { attributes: true, childList: true, characterData: true, subtree: true });
    this.syncCommands();
    this.mapObserver = new MutationObserver(() => {
      const position = `${this.canvas.dataset.roomId}:${this.canvas.dataset.tileX}:${this.canvas.dataset.tileY}`;
      if (position === this.lastPosition) return;
      const roomChanged = position.split(':')[0] !== this.lastPosition.split(':')[0]; this.lastPosition = position;
      if (roomChanged) { this.following = true; this.layoutMap(); }
      if (this.following) this.centerSoon();
    });
    this.mapObserver.observe(this.canvas, { attributes: true, attributeFilter: ['data-tile-x', 'data-tile-y', 'data-room-id'] });
    this.resize = new ResizeObserver(() => this.layoutMap()); this.resize.observe(this.viewport);
    this.media.addEventListener('change', () => this.applyLayout(), { signal });
  }
  private makeDialog(id: string, title: string): HTMLDialogElement {
    const dialog = document.createElement('dialog'); dialog.id = id; dialog.className = 'mobile-command-dialog dialog-list-layout'; dialog.setAttribute('aria-labelledby', `${id}-title`);
    dialog.innerHTML = `<h2 id="${id}-title" tabindex="-1" autofocus>${title}</h2><div class="mobile-command-grid dialog-scroll"></div>`;
    this.shell.after(dialog); this.menus.push(dialog); return dialog;
  }
  private copyButton(source: HTMLButtonElement, host: Element, signal: AbortSignal): void {
    const copy = document.createElement('button'); copy.type = 'button'; copy.dataset.mobileSource = source.id || source.dataset.focusProxy;
    copy.addEventListener('click', () => {
      if (source.disabled || source.hidden) return;
      copy.closest('dialog')?.close(); this.stop(); source.click();
    }, { signal }); host.append(copy); this.copies.push({ source, copy });
  }
  private syncCommands(): void {
    for (const { source, copy } of this.copies) {
      copy.disabled = source.disabled; copy.hidden = source.hidden;
      const label = source.cloneNode(true) as HTMLElement; label.querySelectorAll('kbd').forEach(key => key.remove());
      const text = (source.getAttribute('aria-label') ?? label.textContent?.trim() ?? '').replace('（Eキー）', '');
      if (copy.textContent !== text) copy.textContent = text;
      const pressed = source.getAttribute('aria-pressed');
      if (pressed !== null) copy.setAttribute('aria-pressed', pressed); else copy.removeAttribute('aria-pressed');
    }
  }
  setActive(active: boolean): void { this.active = active; this.applyLayout(); }
  private applyLayout(): void {
    const mobile = this.active && this.media.matches, mode = this.active ? mobile ? 'phone' : 'desktop' : 'normal';
    if (mode !== this.dockMode) {
      if (mode === 'desktop') this.shell.classList.remove('chat-hidden');
      this.chat.setDocked(mode === 'desktop' ? this.shell.querySelector<HTMLElement>('#focus-chat-host')! : undefined, () => this.shell.classList.remove('chat-hidden'));
      this.dockMode = mode;
      this.menus.forEach(dialog => dialog.close());
    }
    if (mobile) this.controls.prepend(this.arrows); else this.arrowMarker.after(this.arrows);
    this.layoutMap();
  }
  private layoutMap(): void {
    if (!this.active || !this.media.matches || !this.viewport.clientWidth) return;
    const width = mobileMapWidth({ width: this.viewport.clientWidth, height: this.viewport.clientHeight }, this.zoom);
    this.surround.style.setProperty('--mobile-map-width', `${width}px`);
    this.surround.style.setProperty('--mobile-map-offset', `${Math.max(0, (this.viewport.clientWidth - width) / 2)}px`);
    this.mapTools.querySelector('output')!.textContent = `${Math.round(this.zoom * 100)}%`;
    for (const button of this.mapTools.querySelectorAll<HTMLButtonElement>('[data-map-zoom]')) button.disabled = Number(button.dataset.mapZoom) < 0 ? this.zoom <= 1 : this.zoom >= 3;
    this.refresh(); if (this.following) this.centerSoon();
  }
  private centerSoon(): void { cancelAnimationFrame(this.frame); this.frame = requestAnimationFrame(() => this.center()); }
  private center(): void {
    if (!this.active || !this.media.matches) return;
    const x = Number(this.canvas.dataset.tileX), y = Number(this.canvas.dataset.tileY); if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const view = this.viewport.getBoundingClientRect(), map = this.canvas.getBoundingClientRect();
    this.viewport.scrollTo(mapScrollTarget({ width: this.viewport.clientWidth, height: this.viewport.clientHeight }, { left: map.left - view.left + this.viewport.scrollLeft, top: map.top - view.top + this.viewport.scrollTop, width: map.width, height: map.height }, { x, y }, { cols: COLS, rows: ROWS }, { width: this.viewport.scrollWidth, height: this.viewport.scrollHeight }));
  }
  destroy(): void {
    cancelAnimationFrame(this.frame); this.observer.disconnect(); this.mapObserver.disconnect(); this.resize.disconnect();
    this.arrowMarker.after(this.arrows); this.arrowMarker.remove(); this.viewport.before(this.surround); this.viewport.remove();
    this.menus.forEach(dialog => dialog.remove()); this.controls.remove(); this.nav.remove(); this.mapTools.remove();
  }
}
