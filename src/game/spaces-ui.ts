import type { SpaceSnapshot, SpaceAction } from './spaces.ts';
import { finishPersonalWrites } from './personal-storage.ts';

export class SpacesUI {
  private dialog = document.createElement('dialog');
  private snapshot?: SpaceSnapshot;
  private selected?: string;
  private busy = false;
  private controller = new AbortController();
  private query = '';
  private tab: 'spaces' | 'members' = 'spaces';
  private page = 0;
  private message = '';
  constructor() {
    this.dialog.id = 'spaces-dialog'; this.dialog.className = 'spaces-dialog dialog-list-layout';
    this.dialog.setAttribute('aria-labelledby', 'spaces-title');
    this.dialog.innerHTML = '<h2 id="spaces-title" tabindex="-1" autofocus>サーバーを選ぶ</h2><p>同じサーバーのメンバーだけが会える、チームごとのオフィスです。</p><div class="space-tabs" data-spaces-tabs role="group" aria-label="サーバー管理の項目" hidden><button type="button" data-space-tab="spaces">サーバー</button><button type="button" data-space-tab="members">メンバーの所属</button></div><p data-spaces-status role="status"></p><div class="dialog-scroll" data-spaces-body></div><div class="dialog-actions"><button type="button" data-spaces-refresh>再読み込み</button><button type="button" data-spaces-close>閉じる</button></div>';
    document.body.append(this.dialog);
    const { signal } = this.controller;
    document.getElementById('server-open')!.addEventListener('click', () => { this.dialog.showModal(); void this.refresh(); }, { signal });
    document.getElementById('server-admin-open')!.addEventListener('click', () => { this.dialog.showModal(); void this.refresh(); }, { signal });
    this.dialog.querySelector('[data-spaces-refresh]')!.addEventListener('click', () => { void this.refresh(); }, { signal });
    this.dialog.querySelector('[data-spaces-close]')!.addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('click', event => {
      const tab = (event.target as Element).closest<HTMLButtonElement>('[data-space-tab]');
      if (tab) { this.tab = tab.dataset.spaceTab as 'spaces' | 'members'; this.render(); }
      const target = (event.target as Element).closest<HTMLButtonElement>('[data-enter-space]');
      if (target) void this.enter(target.dataset.enterSpace!);
    }, { signal });
    this.dialog.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
  }
  async initialize(): Promise<boolean> {
    await this.refresh();
    const requested = new URL(location.href).searchParams.get('space');
    const available = this.snapshot?.spaces.filter(s => s.enabled) ?? [];
    const current = requested ? available.find(s => s.id === requested) : available[0];
    if (!current) {
      if (this.snapshot) this.message = requested ? 'このサーバーは利用できません。所属先を管理者に確認するか、別の入室先を選んでください。' : '所属するサーバーがありません。ログイン後、管理者に所属設定を依頼してください。';
      this.render(); this.dialog.showModal(); return false;
    }
    this.selected = current.id;
    const url = new URL(location.href); url.searchParams.set('space', current.id); history.replaceState(null, '', url);
    this.render(); return true;
  }
  private async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.message = 'サーバーを確認しています…'; this.render();
    try {
      const response = await fetch('/api/spaces', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('サーバーの一覧を取得できません。');
      this.snapshot = await response.json() as SpaceSnapshot; this.message = '';
    } catch { this.message = 'サーバーの一覧を取得できません。再読み込みしてください。'; }
    finally { this.busy = false; this.render(); }
  }
  private async save(action: SpaceAction): Promise<void> {
    if (this.busy) return;
    this.busy = true; this.message = '保存しています…'; this.render();
    try {
      const response = await fetch('/api/spaces', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action), signal: AbortSignal.timeout(10000) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? '保存できませんでした。');
      this.snapshot = body; this.message = '保存しました。所属から外れた人は、そのサーバーから退室します。';
    } catch (error) { this.message = error instanceof Error ? error.message : '保存できませんでした。'; }
    finally { this.busy = false; this.render(); }
  }
  private async enter(id: string): Promise<void> {
    if (this.busy) return;
    if (id === this.selected) { this.dialog.close(); return; }
    if (!await finishPersonalWrites()) { this.message = '未保存の個人設定があります。保存を再試行してください。'; this.render(); return; }
    const url = new URL(location.href); url.searchParams.set('space', id); url.hash = ''; location.assign(url.href);
  }
  private render(): void {
    const snapshot = this.snapshot, body = this.dialog.querySelector<HTMLElement>('[data-spaces-body]')!;
    this.dialog.querySelector('[data-spaces-status]')!.textContent = this.message;
    this.dialog.querySelector<HTMLButtonElement>('[data-spaces-refresh]')!.disabled = this.busy;
    const adminButton = document.getElementById('server-admin-open') as HTMLButtonElement;
    adminButton.hidden = !snapshot?.administrator;
    const current = snapshot?.spaces.find(s => s.id === this.selected);
    const button = document.getElementById('server-open')!; button.textContent = current ? `サーバー：${current.name}` : 'サーバーを選ぶ';
    for (const label of document.querySelectorAll('[data-server-name]')) label.textContent = current?.name ?? '未入室';
    const tabs = this.dialog.querySelector<HTMLElement>('[data-spaces-tabs]')!; tabs.hidden = !snapshot?.administrator;
    for (const button of tabs.querySelectorAll<HTMLButtonElement>('button')) button.setAttribute('aria-pressed', String(button.dataset.spaceTab === this.tab));
    body.replaceChildren();
    for (const space of snapshot?.spaces ?? []) {
      if (snapshot?.administrator && this.tab === 'members') break;
      const row = document.createElement('div'); row.className = 'space-row';
      const name = document.createElement('strong'); name.textContent = space.name;
      const enter = document.createElement('button'); enter.type = 'button'; enter.dataset.enterSpace = space.id;
      enter.textContent = !space.enabled ? '非公開' : space.id === this.selected ? '入室中' : '入室する'; enter.disabled = this.busy || !space.enabled;
      row.append(name, enter); body.append(row);
      if (snapshot?.administrator) {
        const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = `${space.name} の設定`;
        const form = document.createElement('form'); form.className = 'space-settings';
        const label = document.createElement('label'); label.textContent = 'サーバー名';
        const input = document.createElement('input'); input.value = space.name; input.maxLength = 40; input.required = true; label.append(input);
        const enabled = document.createElement('input'); enabled.type = 'checkbox'; enabled.checked = space.enabled;
        const enabledLabel = document.createElement('label'); enabledLabel.append(enabled, ' このサーバーを公開する');
        const save = document.createElement('button'); save.textContent = '設定を保存'; save.disabled = this.busy;
        form.append(label, enabledLabel, save); details.append(summary, form); body.append(details);
        form.addEventListener('submit', event => { event.preventDefault(); void this.save({ type: 'update', revision: snapshot.revision, id: space.id, name: input.value.trim(), enabled: enabled.checked }); });
      }
    }
    if (!snapshot?.administrator) return;
    if (this.tab === 'spaces') {
    const create = document.createElement('form'); create.className = 'space-create';
    const label = document.createElement('label'); label.textContent = '新しいサーバー名';
    const name = document.createElement('input'); name.maxLength = 40; name.required = true; name.placeholder = '例：開発チーム'; label.append(name);
    const submit = document.createElement('button'); submit.textContent = 'サーバーを追加'; submit.disabled = this.busy;
    create.append(label, submit); body.append(create);
    create.addEventListener('submit', event => { event.preventDefault(); void this.save({ type: 'create', revision: snapshot.revision, name: name.value.trim() }); });
    return;
    }
    const hint = document.createElement('p'); hint.textContent = '入室先を選んで保存します。複数選択できます。新規ログインの人は所属未設定です。'; body.append(hint);
    const searchLabel = document.createElement('label'); searchLabel.textContent = 'メンバーを探す';
    const search = document.createElement('input'); search.type = 'search'; search.value = this.query; search.placeholder = '名前・アカウントID'; searchLabel.append(search); body.append(searchLabel);
    const members = document.createElement('div'); members.className = 'space-members'; body.append(members);
    const renderMembers = () => {
      members.replaceChildren();
      const found = (snapshot.members ?? []).filter(member => `${member.name} ${member.id}`.toLowerCase().includes(this.query.toLowerCase().trim()));
      this.page = Math.min(this.page, Math.max(0, Math.ceil(found.length / 20) - 1));
      const pager = document.createElement('div'); pager.className = 'space-pager';
      const previous = document.createElement('button'), next = document.createElement('button'), count = document.createElement('span');
      previous.type = next.type = 'button'; previous.textContent = '前の20人'; next.textContent = '次の20人';
      previous.disabled = this.page === 0; next.disabled = (this.page + 1) * 20 >= found.length;
      count.textContent = found.length ? `${this.page * 20 + 1}〜${Math.min((this.page + 1) * 20, found.length)} / ${found.length}人` : '0人';
      previous.addEventListener('click', () => { this.page--; renderMembers(); }); next.addEventListener('click', () => { this.page++; renderMembers(); });
      pager.append(...(found.length > 20 ? [previous, count, next] : [count])); members.append(pager);
      for (const member of found.slice(this.page * 20, (this.page + 1) * 20)) {
        const form = document.createElement('form'), title = document.createElement('strong'), id = document.createElement('small');
        form.className = 'space-member'; title.textContent = member.name; id.textContent = member.id; form.append(title, id);
        const choices: HTMLInputElement[] = [];
        for (const space of snapshot.spaces) {
          const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = space.id; input.checked = member.spaceIds.includes(space.id); input.disabled = this.busy;
          label.append(input, ` ${space.name}${space.enabled ? '' : '（非公開）'}`); choices.push(input); form.append(label);
        }
        const save = document.createElement('button'); save.textContent = `${member.name}の所属を保存`; save.disabled = this.busy; form.append(save);
        form.addEventListener('submit', event => { event.preventDefault(); void this.save({ type: 'membership', revision: snapshot.revision, accountId: member.id, spaceIds: choices.filter(c => c.checked).map(c => c.value) }); });
        members.append(form);
      }
      if (!found.length) { const empty = document.createElement('p'); empty.textContent = '該当するメンバーはいません。本人に一度ログインしてもらってください。'; members.append(empty); }
    };
    search.addEventListener('input', () => { this.query = search.value; this.page = 0; renderMembers(); }); renderMembers();
  }
  destroy(): void { this.controller.abort(); this.dialog.remove(); }
}
