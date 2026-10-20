import { MAX_OBJECT_LINKS, parseFavorite } from './object-links.ts';
import type { LinkEdit, LinkState, LinkTarget } from './object-links.ts';
import type { ServerMessage } from '../network/protocol.ts';
import { filterFavorites, linkService } from './link-services.ts';
import type { LinkService } from './link-services.ts';

function serviceBadge(service: LinkService): HTMLSpanElement {
  const badge = document.createElement('span'); badge.className = 'link-service-badge'; badge.dataset.service = service.id;
  const mark = document.createElement('span'); mark.className = 'link-service-mark'; mark.textContent = service.mark; mark.setAttribute('aria-hidden', 'true');
  badge.append(mark, document.createTextNode(service.name)); badge.title = service.host;
  return badge;
}

export class ObjectLinksEditor {
  private state: LinkState = { favorites: [], bindings: [] };
  private target?: LinkTarget;
  private selected = new Set<string>();
  private dirty = false;
  private ready = false;
  private editingId?: string;
  private deletingId?: string;
  private menuId?: string;
  private query = '';
  private serviceFilter = '';
  private selectedOnly = false;
  private pending?: { id: string; type: LinkEdit['type']; timer: ReturnType<typeof setTimeout> };
  private cooldown?: ReturnType<typeof setTimeout>;
  private dialog = document.querySelector<HTMLDialogElement>('#object-links-dialog')!;
  private list = document.querySelector<HTMLUListElement>('#object-link-list')!;
  private favorites = document.querySelector<HTMLElement>('#link-favorites')!;
  private form = document.querySelector<HTMLFormElement>('#favorite-form')!;

  constructor(private options: { signal: AbortSignal; owner: () => string; resolve: (id: string) => LinkTarget | undefined; send: (edit: LinkEdit) => void; open: () => void }) {
    const { signal } = options;
    document.querySelector('#object-links-close')!.addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('close', () => { this.cancelPending(); this.target = undefined; this.resetForm(); this.deletingId = undefined; }, { signal });
    this.favorites.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.dataset.favoriteId) return;
      if (input.checked) this.selected.add(input.dataset.favoriteId); else this.selected.delete(input.dataset.favoriteId);
      this.dirty = true; if (this.selectedOnly) this.render(); else this.controls();
    }, { signal });
    this.favorites.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-favorite-action]');
      if (!button || !this.manageable() || this.pending || this.cooldown) return;
      const favorite = this.state.favorites.find((f) => f.id === button.dataset.favoriteId);
      if (!favorite) return;
      if (button.dataset.favoriteAction === 'menu') {
        this.menuId = this.menuId === favorite.id ? undefined : favorite.id; this.deletingId = undefined; this.render();
      } else if (button.dataset.favoriteAction === 'edit') {
        this.editingId = favorite.id; this.deletingId = undefined;
        this.form.querySelector<HTMLInputElement>('[name="title"]')!.value = favorite.title;
        this.form.querySelector<HTMLInputElement>('[name="url"]')!.value = favorite.url;
        document.querySelector<HTMLDetailsElement>('#favorite-add-section')!.open = true;
        this.render(); this.form.scrollIntoView({ block: 'nearest' });
        this.form.querySelector<HTMLInputElement>('[name="title"]')!.focus({ preventScroll: true });
      } else if (button.dataset.favoriteAction === 'confirm-delete') {
        this.send({ type: 'favorite-delete', favoriteId: favorite.id, editId: crypto.randomUUID() });
      } else {
        this.deletingId = button.dataset.favoriteAction === 'delete' ? favorite.id : undefined;
        this.render();
      }
    }, { signal });
    document.querySelector('#favorite-query')!.addEventListener('input', (event) => {
      this.query = (event.target as HTMLInputElement).value; this.render(); this.favorites.scrollTop = 0;
    }, { signal });
    document.querySelector('#favorite-service')!.addEventListener('change', (event) => {
      this.serviceFilter = (event.target as HTMLSelectElement).value; this.render(); this.favorites.scrollTop = 0;
    }, { signal });
    document.querySelector('#favorite-selected-only')!.addEventListener('change', (event) => {
      this.selectedOnly = (event.target as HTMLInputElement).checked; this.render(); this.favorites.scrollTop = 0;
    }, { signal });
    document.querySelector('#favorite-selection-preview')!.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button[data-remove-favorite]');
      if (!button || !this.editable() || this.pending || this.cooldown) return;
      this.selected.delete(button.dataset.removeFavorite!); this.dirty = true; this.render();
    }, { signal });
    this.form.querySelector('[name="url"]')!.addEventListener('input', () => this.previewService(), { signal });
    document.querySelector('#favorite-edit-cancel')!.addEventListener('click', () => { this.resetForm(); this.render(); }, { signal });
    document.querySelector('#object-links-save')!.addEventListener('click', () => {
      if (!this.editable() || !this.target || this.pending || this.cooldown || this.selected.size > MAX_OBJECT_LINKS) return;
      this.send({ type: 'object-links-set', objectId: this.target.id, linkIds: [...this.selected], editId: crypto.randomUUID() });
    }, { signal });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.manageable() || this.pending || this.cooldown) return;
      const data = new FormData(this.form);
      const favorite = parseFavorite({ title: data.get('title'), url: data.get('url') });
      if (!favorite) { this.status('名前とHTTPSのURLを入力してください。'); return; }
      this.send(this.editingId
        ? { type: 'favorite-update', favoriteId: this.editingId, ...favorite, editId: crypto.randomUUID() }
        : { type: 'favorite-add', ...favorite, editId: crypto.randomUUID() });
    }, { signal });
    signal.addEventListener('abort', () => this.cancelPending(), { once: true });
  }
  setReady(ready: boolean): void { this.ready = ready; if (!ready) { this.cancelPending(); this.status('接続を確認しています。再接続後に設定できます。'); } this.controls(); }
  reset(): void { this.dialog.close(); this.target = undefined; this.state = { favorites: [], bindings: [] }; this.ready = false; this.cancelPending(); }
  refreshTarget(): void {
    if (!this.target) return;
    const target = this.options.resolve(this.target.id);
    if (!target) { this.dialog.close(); this.target = undefined; this.cancelPending(); return; }
    this.target = target; this.controls();
  }
  snapshot(state: LinkState): void {
    this.state = state;
    this.selected = new Set([...this.selected].filter((id) => state.favorites.some((f) => f.id === id)));
    if (this.editingId && !state.favorites.some((f) => f.id === this.editingId)) {
      this.resetForm(); this.status('編集中のお気に入りが削除されました。');
    }
    if (this.deletingId && !state.favorites.some((f) => f.id === this.deletingId)) this.deletingId = undefined;
    this.refreshTarget();
    if (!this.target) return;
    if (!this.dirty) this.selected = new Set(this.assigned());
    this.render();
  }
  hasLinks(id: string): boolean { return this.state.bindings.some((b) => b.objectId === id && b.linkIds.length > 0); }
  open(target: LinkTarget): void {
    if (this.dialog.open || document.querySelector('dialog[open]:not(.chat-docked)')) return;
    this.target = target; this.selected = new Set(this.assigned()); this.dirty = false;
    this.resetForm(); this.deletingId = undefined;
    this.query = ''; this.serviceFilter = ''; this.selectedOnly = false; this.menuId = undefined;
    document.querySelector<HTMLInputElement>('#favorite-query')!.value = '';
    document.querySelector<HTMLInputElement>('#favorite-selected-only')!.checked = false;
    document.querySelector<HTMLDetailsElement>('#favorite-selected-details')!.open = window.matchMedia('(min-width: 601px)').matches;
    document.querySelector<HTMLDetailsElement>('#object-links-settings')!.open = false;
    document.querySelector<HTMLDetailsElement>('#favorite-add-section')!.open = false;
    this.status(this.isShelf() ? '資料名を選ぶと、Confluenceなどの資料を別タブで開きます。' : 'リンクを選ぶと別タブで開きます。'); this.render(); this.favorites.scrollTop = 0; this.options.open(); this.dialog.showModal();
  }
  result(message: Extract<ServerMessage, { type: 'link-result' }>): void {
    if (this.pending?.id !== message.editId) return;
    const type = this.pending.type;
    this.cancelPending();
    this.cooldown = setTimeout(() => { this.cooldown = undefined; this.controls(); }, 350);
    if (message.error) this.status(message.error);
    else if (type === 'favorite-add') {
      if (message.favoriteId && this.selected.size < MAX_OBJECT_LINKS) { this.selected.add(message.favoriteId); this.dirty = true; }
      this.resetForm(); this.status('お気に入りを追加しました。選択を確認し、「この選択を保存」を押してください。');
    } else if (type === 'favorite-update') {
      this.resetForm(); this.status('お気に入りを変更しました。設定済みの家具のリンクにも反映しました。');
    } else if (type === 'favorite-delete') {
      this.deletingId = undefined; this.status('お気に入りを削除し、設定済みの家具からも取り外しました。');
    } else { this.dirty = false; this.selected = new Set(this.assigned()); this.status('リンクの設定をみんなに共有・保存しました。'); }
    this.render();
  }
  private isShelf(): boolean { return this.target?.kind === 'shelf' || this.target?.kind === 'bookshelf'; }
  private assigned(): string[] { return this.state.bindings.find((b) => b.objectId === this.target?.id)?.linkIds ?? []; }
  private editable(): boolean { return this.ready && !!this.target && (!this.target.owner || this.target.owner === this.options.owner()); }
  private manageable(): boolean { return this.ready && !!this.target; }
  private resetForm(): void { this.editingId = undefined; this.form.reset(); this.previewService(); }
  private previewService(): void {
    const value = this.form.querySelector<HTMLInputElement>('[name="url"]')!.value;
    const service = linkService(value);
    document.querySelector('#favorite-service-preview')!.textContent = value && service.host
      ? `表示するツール：${service.name}${service.kind ? ` · ${service.kind}` : ''}` : '';
  }
  private status(text: string): void { document.querySelector('#object-links-status')!.textContent = text; }
  private cancelPending(): void {
    if (this.pending) clearTimeout(this.pending.timer);
    if (this.cooldown) clearTimeout(this.cooldown);
    this.pending = undefined; this.cooldown = undefined;
  }
  private send(edit: LinkEdit): void {
    this.pending = { id: edit.editId, type: edit.type, timer: setTimeout(() => {
      this.pending = undefined; this.status('保存の確認が届きませんでした。接続を確認して、もう一度試してください。'); this.controls();
    }, 8000) };
    this.options.send(edit); this.status('保存しています…'); this.controls();
  }
  private controls(): void {
    const disabled = !this.editable() || !!this.pending || !!this.cooldown;
    for (const control of this.favorites.querySelectorAll<HTMLInputElement>('input')) control.disabled = disabled;
    for (const control of this.dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('#link-favorites button, #favorite-form input, #favorite-form button')) control.disabled = !this.manageable() || !!this.pending || !!this.cooldown;
    const save = document.querySelector<HTMLButtonElement>('#object-links-save')!;
    save.disabled = disabled || !this.dirty || this.selected.size > MAX_OBJECT_LINKS;
    for (const input of this.favorites.querySelectorAll<HTMLInputElement>('input')) if (!input.checked && this.selected.size >= MAX_OBJECT_LINKS) input.disabled = true;
    document.querySelector('#object-links-selection')!.textContent = `${this.selected.size} / ${MAX_OBJECT_LINKS}件を選択`;
    const preview = document.querySelector('#favorite-selection-preview')!; preview.replaceChildren();
    for (const favorite of this.state.favorites.filter(f => this.selected.has(f.id))) {
      const chip = document.createElement('span'); chip.className = 'favorite-selection-chip';
      const title = document.createElement('span'); title.textContent = `${linkService(favorite.url).name} · ${favorite.title}`;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '外す';
      remove.dataset.removeFavorite = favorite.id; remove.setAttribute('aria-label', `${favorite.title}の選択を解除`); remove.disabled = disabled;
      chip.append(title, remove); preview.append(chip);
    }
    preview.scrollTop = 0;
    const caption = document.querySelector<HTMLElement>('#favorite-selection-caption')!;
    document.querySelector<HTMLElement>('#favorite-selected-details')!.hidden = this.selected.size === 0;
    caption.textContent = `選択中のリンク（${this.selected.size}）`;
    document.querySelector('#object-links-permission')!.textContent = this.target?.owner && this.target.owner !== this.options.owner()
      ? 'この家具のリンクは、配置した本人が設定できます。登録済みのリンクは誰でも開けます。'
      : `共有リンクを最大${MAX_OBJECT_LINKS}件選び、この家具に設定できます。`;
  }
  private render(): void {
    const shelf = this.isShelf();
    document.querySelector('#object-links-title')!.textContent = this.target?.kind === 'bookshelf'
      ? '本棚の資料一覧' : `${this.target?.name ?? 'オブジェクト'}の${shelf ? '資料一覧' : 'リンク'}`;
    document.querySelector('#object-links-help')!.textContent = shelf
      ? 'この棚に並んだ手順書やマニュアルをひらこう。Confluenceなど、いつもの資料をまとめて置けます。'
      : '使いたいリンクを選んで、作業をはじめよう。';
    this.list.setAttribute('aria-label', shelf ? 'この棚の資料' : '登録済みのリンク');
    document.querySelector('#object-links-empty')!.textContent = shelf
      ? 'この棚にはまだ資料がありません。「リンクを設定」を開き、資料名とURLを追加して、この棚に保存しましょう。'
      : 'まだリンクがありません。「リンクを設定」から追加できます。';
    document.querySelector('#favorite-add-title')!.textContent = this.editingId ? 'お気に入りを編集' : shelf ? '資料を追加 · 名前とURLを登録' : '共有のお気に入りを追加';
    this.form.querySelector<HTMLButtonElement>('[type="submit"]')!.textContent = this.editingId ? '変更を保存' : 'お気に入りに追加';
    document.querySelector<HTMLButtonElement>('#favorite-edit-cancel')!.hidden = !this.editingId;
    document.querySelector('#favorite-form-help')!.textContent = this.editingId
      ? '変更は、このサーバー内のすべての設定済み家具に反映されます。'
      : 'ツール名はURLから表示するので、名前には資料の内容だけでOKです。このサーバー内で共有されます。';
    this.previewService();
    this.form.querySelector<HTMLInputElement>('[name="title"]')!.placeholder = shelf ? '例：本番リリース手順書' : '例：上位プランの構成図';
    this.list.replaceChildren();
    for (const id of this.assigned()) {
      const favorite = this.state.favorites.find((f) => f.id === id); if (!favorite) continue;
      const li = document.createElement('li'); const a = document.createElement('a');
      a.href = favorite.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
      const title = document.createElement('strong'); title.textContent = favorite.title;
      const service = linkService(favorite.url), info = document.createElement('span'); info.className = 'object-link-info';
      const detail = document.createElement('small'); detail.textContent = service.kind || service.host;
      const arrow = document.createElement('span'); arrow.className = 'object-link-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden', 'true');
      info.append(title, detail); a.title = favorite.url;
      a.append(serviceBadge(service), info, arrow); li.append(a); this.list.append(li);
    }
    document.querySelector<HTMLElement>('#object-links-empty')!.hidden = this.list.children.length > 0;
    this.favorites.replaceChildren();
    const services = new Map(this.state.favorites.map(f => { const s = linkService(f.url); return [s.id, s.id === 'web' ? 'その他のWebリンク' : s.name]; }));
    if (this.serviceFilter && !services.has(this.serviceFilter)) this.serviceFilter = '';
    const select = document.querySelector<HTMLSelectElement>('#favorite-service')!;
    select.replaceChildren(new Option('すべてのツール', ''), ...[...services].sort((a, b) => a[1].localeCompare(b[1], 'ja')).map(([id, name]) => new Option(name, id)));
    select.value = this.serviceFilter;
    const visible = filterFavorites(this.state.favorites, this.query, this.serviceFilter, this.selectedOnly ? this.selected : undefined);
    document.querySelector('#favorite-result-count')!.textContent = `${visible.length} / ${this.state.favorites.length}件を表示`;
    for (const favorite of visible) {
      const label = document.createElement('label'); const input = document.createElement('input');
      input.type = 'checkbox'; input.dataset.favoriteId = favorite.id; input.checked = this.selected.has(favorite.id);
      const info = document.createElement('span'); const name = document.createElement('strong'); name.textContent = favorite.title;
      const service = linkService(favorite.url);
      const url = document.createElement('small'); url.textContent = [service.kind, service.host].filter(Boolean).join(' · '); url.title = favorite.url;
      info.append(serviceBadge(service), name, url); label.append(input, info);
      const row = document.createElement('div'); row.className = 'favorite-row';
      const actions = document.createElement('div'); actions.className = 'favorite-row-actions';
      const action = (kind: string, text: string) => {
        const button = document.createElement('button'); button.type = 'button';
        button.dataset.favoriteAction = kind; button.dataset.favoriteId = favorite.id;
        button.textContent = text; button.setAttribute('aria-label', `${favorite.title}：${text}`);
        actions.append(button);
      };
      if (this.deletingId === favorite.id) {
        const warning = document.createElement('p'); warning.className = 'favorite-delete-warning';
        warning.textContent = '削除すると、このサーバー内のすべての家具からこのリンクが外れます。削除しますか？';
        row.append(label, warning); action('confirm-delete', '削除する'); action('cancel-delete', 'やめる');
      } else {
        row.append(label); action('menu', '⋯');
        const menu = actions.lastElementChild!; menu.setAttribute('aria-label', `${favorite.title}の操作`); menu.setAttribute('aria-expanded', String(this.menuId === favorite.id));
        if (this.menuId === favorite.id) { action('edit', '編集'); action('delete', '削除'); }
      }
      row.append(actions); this.favorites.append(row);
    }
    if (!visible.length) this.favorites.textContent = this.state.favorites.length ? '条件に合うリンクがありません。検索や絞り込みを変えてください。' : 'まだお気に入りがありません。下から追加できます。';
    this.controls();
  }
}
