import { MAX_OBJECT_LINKS, parseFavorite } from './object-links.ts';
import type { LinkEdit, LinkState, LinkTarget } from './object-links.ts';
import type { ServerMessage } from '../network/protocol.ts';

export class ObjectLinksEditor {
  private state: LinkState = { favorites: [], bindings: [] };
  private target?: LinkTarget;
  private selected = new Set<string>();
  private dirty = false;
  private ready = false;
  private pending?: { id: string; type: LinkEdit['type']; timer: ReturnType<typeof setTimeout> };
  private cooldown?: ReturnType<typeof setTimeout>;
  private dialog = document.querySelector<HTMLDialogElement>('#object-links-dialog')!;
  private list = document.querySelector<HTMLUListElement>('#object-link-list')!;
  private favorites = document.querySelector<HTMLElement>('#link-favorites')!;
  private form = document.querySelector<HTMLFormElement>('#favorite-form')!;

  constructor(private options: { signal: AbortSignal; owner: () => string; resolve: (id: string) => LinkTarget | undefined; send: (edit: LinkEdit) => void; open: () => void }) {
    const { signal } = options;
    document.querySelector('#object-links-close')!.addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('close', () => { this.cancelPending(); this.target = undefined; this.form.reset(); }, { signal });
    this.favorites.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.dataset.favoriteId) return;
      if (input.checked) this.selected.add(input.dataset.favoriteId); else this.selected.delete(input.dataset.favoriteId);
      this.dirty = true; this.controls();
    }, { signal });
    document.querySelector('#object-links-save')!.addEventListener('click', () => {
      if (!this.editable() || !this.target || this.pending || this.cooldown || this.selected.size > MAX_OBJECT_LINKS) return;
      this.send({ type: 'object-links-set', objectId: this.target.id, linkIds: [...this.selected], editId: crypto.randomUUID() });
    }, { signal });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!this.editable() || this.pending || this.cooldown) return;
      const data = new FormData(this.form);
      const favorite = parseFavorite({ title: data.get('title'), url: data.get('url') });
      if (!favorite) { this.status('名前とHTTPSのURLを入力してください。'); return; }
      this.send({ type: 'favorite-add', ...favorite, editId: crypto.randomUUID() });
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
    this.refreshTarget();
    if (!this.target) return;
    if (!this.dirty) this.selected = new Set(this.assigned());
    this.render();
  }
  hasLinks(id: string): boolean { return this.state.bindings.some((b) => b.objectId === id && b.linkIds.length > 0); }
  open(target: LinkTarget): void {
    if (this.dialog.open || document.querySelector('dialog[open]')) return;
    this.target = target; this.selected = new Set(this.assigned()); this.dirty = false;
    this.form.reset();
    document.querySelector<HTMLDetailsElement>('#object-links-settings')!.open = false;
    document.querySelector<HTMLDetailsElement>('#favorite-add-section')!.open = false;
    this.status('リンクを選ぶと別タブで開きます。'); this.render(); this.options.open(); this.dialog.showModal();
  }
  result(message: Extract<ServerMessage, { type: 'link-result' }>): void {
    if (this.pending?.id !== message.editId) return;
    const type = this.pending.type;
    this.cancelPending();
    this.cooldown = setTimeout(() => { this.cooldown = undefined; this.controls(); }, 350);
    if (message.error) this.status(message.error);
    else if (type === 'favorite-add') {
      if (message.favoriteId && this.selected.size < MAX_OBJECT_LINKS) { this.selected.add(message.favoriteId); this.dirty = true; }
      this.form.reset(); this.status('お気に入りを追加しました。選択を確認し、「この選択を保存」を押してください。');
    } else { this.dirty = false; this.selected = new Set(this.assigned()); this.status('リンクの設定をみんなに共有・保存しました。'); }
    this.render();
  }
  private assigned(): string[] { return this.state.bindings.find((b) => b.objectId === this.target?.id)?.linkIds ?? []; }
  private editable(): boolean { return this.ready && !!this.target && (!this.target.owner || this.target.owner === this.options.owner()); }
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
    for (const control of this.dialog.querySelectorAll<HTMLInputElement | HTMLButtonElement>('#link-favorites input, #favorite-form input, #favorite-form button')) control.disabled = disabled;
    const save = document.querySelector<HTMLButtonElement>('#object-links-save')!;
    save.disabled = disabled || !this.dirty || this.selected.size > MAX_OBJECT_LINKS;
    for (const input of this.favorites.querySelectorAll<HTMLInputElement>('input')) if (!input.checked && this.selected.size >= MAX_OBJECT_LINKS) input.disabled = true;
    document.querySelector('#object-links-selection')!.textContent = `${this.selected.size} / ${MAX_OBJECT_LINKS}件を選択`;
    document.querySelector('#object-links-permission')!.textContent = this.target?.owner && this.target.owner !== this.options.owner()
      ? 'この家具のリンクは、配置した本人が設定できます。登録済みのリンクは誰でも開けます。'
      : 'このオブジェクトのリンクを、共有のお気に入りから複数選べます。設定は参加者に共有されます。';
  }
  private render(): void {
    document.querySelector('#object-links-title')!.textContent = `${this.target?.name ?? 'オブジェクト'}のリンク`;
    this.list.replaceChildren();
    for (const id of this.assigned()) {
      const favorite = this.state.favorites.find((f) => f.id === id); if (!favorite) continue;
      const li = document.createElement('li'); const a = document.createElement('a');
      a.href = favorite.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.referrerPolicy = 'no-referrer';
      const title = document.createElement('strong'); title.textContent = favorite.title;
      const domain = document.createElement('span'); domain.textContent = new URL(favorite.url).hostname + ' ↗';
      a.append(title, domain); li.append(a); this.list.append(li);
    }
    document.querySelector<HTMLElement>('#object-links-empty')!.hidden = this.list.children.length > 0;
    this.favorites.replaceChildren();
    for (const favorite of this.state.favorites) {
      const label = document.createElement('label'); const input = document.createElement('input');
      input.type = 'checkbox'; input.dataset.favoriteId = favorite.id; input.checked = this.selected.has(favorite.id);
      const info = document.createElement('span'); const name = document.createElement('strong'); name.textContent = favorite.title;
      const url = document.createElement('small'); url.textContent = new URL(favorite.url).hostname;
      info.append(name, url); label.append(input, info); this.favorites.append(label);
    }
    if (!this.state.favorites.length) this.favorites.textContent = 'まだお気に入りがありません。下から追加できます。';
    this.controls();
  }
}
