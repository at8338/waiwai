import { ROOMS } from './rooms.ts';
import { ROAMING_RESIDENTS, BUDDIES } from './buddies.ts';
import { DAILY_EPISODES } from './daily-event-catalog.ts';
import { POKEMON_KINDS, POKEMON, pokemonMatches } from './pokemon.ts';
import { POKEMON_GENERATIONS, pokemonGeneration, pokemonGenerationMembers } from './pokemon-generations.ts';
import type { WorldPolicy } from './world-policy.ts';
import { policyAllows } from './world-policy.ts';
import type { PolicyAction, PolicyGroup, PolicySnapshot } from './world-policy.ts';
const labels: Record<PolicyGroup, string> = { rooms: 'フロア', residents: 'うろちょろ', incidents: '365事件', pokemon: 'ポケモン' };
export class AdminUI {
  private dialog = document.createElement('dialog');
  private button = document.querySelector<HTMLButtonElement>('#admin-open')!;
  private snapshot?: PolicySnapshot;
  private connected = false;
  private group: PolicyGroup = 'rooms';
  private pending?: string;
  private desired?: PolicyAction;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(signal: AbortSignal, private send: (action: PolicyAction) => boolean, beforeOpen: () => boolean) {
    this.dialog.id = 'admin-dialog'; this.dialog.className = 'admin-dialog'; this.dialog.setAttribute('aria-labelledby', 'admin-title');
    this.dialog.innerHTML = `<span class="eyebrow">OFFICE ADMINISTRATION</span><h2 id="admin-title" tabindex="-1" autofocus>オフィスの管理</h2><p>許可したものだけが館内に登場します。変更は全員に反映され、サーバーに保存されます。</p><div class="admin-tabs" role="group" aria-label="管理する種類">${Object.entries(labels).map(([id, name]) => `<button type="button" data-admin-group="${id}" aria-pressed="false">${name}</button>`).join('')}</div><label class="admin-search">名前・番号で探す<input id="admin-query" type="search" maxlength="80" placeholder="部屋名・キャラクター名など"></label><label class="admin-category"><input id="admin-category-enabled" type="checkbox"> <span></span></label><p id="admin-summary"></p><div id="admin-items" class="admin-items"></div><p id="admin-status" role="status"></p><p id="admin-updated" class="field-hint"></p><div class="dialog-actions"><button type="button" id="admin-close">閉じる</button></div>`;
    document.body.append(this.dialog);
    const generations = document.createElement('fieldset'); generations.id = 'admin-pokemon-generations'; generations.hidden = true;
    generations.innerHTML = '<legend>世代ごとに表示をON / OFF</legend><p>チェックした世代を館内に表示します。世代をOFFにしても、個別の禁止設定・図鑑の発見記録は保持します。</p><div class="admin-generation-grid"></div>';
    for (const generation of POKEMON_GENERATIONS) {
      const row = document.createElement('label'), input = document.createElement('input'), text = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
      input.type = 'checkbox'; input.dataset.pokemonGeneration = generation.id; name.textContent = generation.name;
      detail.id = `admin-generation-${generation.id.replace(':', '-')}`;
      text.append(name, detail); row.append(input, text); generations.querySelector('.admin-generation-grid')!.append(row);
    }
    this.dialog.querySelector('.admin-search')!.before(generations);
    generations.addEventListener('change', event => { const input = event.target as HTMLInputElement; if (input.dataset.pokemonGeneration) this.change(input.dataset.pokemonGeneration, input.checked); }, { signal });
    this.button.addEventListener('click', () => { if (this.connected && this.snapshot?.administrator && beforeOpen()) { this.render(); this.dialog.showModal(); } }, { signal });
    this.get('admin-close').addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    this.dialog.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-admin-group]'); if (!button) return;
      this.group = button.dataset.adminGroup as PolicyGroup; this.get<HTMLInputElement>('admin-query').value = ''; this.render();
    }, { signal });
    this.get('admin-query').addEventListener('input', () => this.renderItems(), { signal });
    this.get('admin-category-enabled').addEventListener('change', event => this.change('*', (event.target as HTMLInputElement).checked), { signal });
    this.get('admin-items').addEventListener('change', event => {
      const input = event.target as HTMLInputElement; if (input.dataset.adminItem) this.change(input.dataset.adminItem, input.checked);
    }, { signal });
  }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) { this.snapshot = undefined; this.pending = undefined; this.desired = undefined; clearTimeout(this.timer); this.dialog.close(); }
    this.render();
  }
  receive(snapshot: PolicySnapshot): void { this.snapshot = snapshot; if (!snapshot.administrator) this.dialog.close(); this.render(); }
  result(actionId: string, error?: string): void {
    if (this.pending !== actionId) return;
    this.pending = undefined; this.desired = undefined; clearTimeout(this.timer);
    this.get('admin-status').textContent = error ?? '保存しました。館内のみんなに反映しました。'; this.render();
  }
  private change(id: string, allowed: boolean): void {
    if (!this.snapshot?.administrator || !this.connected || this.pending) { this.render(); return; }
    const action: PolicyAction = { type: 'policy-set', group: this.group, id, allowed, revision: this.snapshot.policy.revision, actionId: crypto.randomUUID() };
    if (!this.send(action)) { this.render(); return; }
    this.pending = action.actionId; this.desired = action; this.get('admin-status').textContent = '保存しています…';
    this.timer = setTimeout(() => { this.pending = undefined; this.desired = undefined; this.get('admin-status').textContent = '保存結果を確認できません。再接続して最新の状態を確認してください。'; this.render(); }, 8000);
    this.render();
  }
  private items(): { id: string; name: string; detail: string }[] {
    if (this.group === 'rooms') return ROOMS.map((room, i) => ({ id: room.id, name: `${String(i + 1).padStart(2, '0')} ${room.name}`, detail: room.description }));
    if (this.group === 'residents') return ROAMING_RESIDENTS.map(p => ({ id: p.kind, name: BUDDIES[p.kind].name, detail: `${ROOMS.find(r => r.id === p.roomId)!.name}を散歩。個人のバディ設定は変えません。` }));
    if (this.group === 'incidents') return DAILY_EPISODES.map((e, i) => ({ id: e.id, name: `${String(i + 1).padStart(3, '0')} ${e.title}`, detail: ROOMS.find(r => r.id === e.direction.room)!.name }));
    return POKEMON_KINDS.map(kind => ({ id: kind, name: `${POKEMON[kind].id ?? '—'} ${POKEMON[kind].name}`, detail: `${pokemonGeneration(kind).name} · 日々の出現とバディに適用。図鑑の発見記録は残ります。` }));
  }
  private displayPolicy(): WorldPolicy | undefined {
    if (!this.snapshot) return;
    const policy = structuredClone(this.snapshot.policy), desired = this.desired;
    if (desired) { policy.blocked[desired.group] = policy.blocked[desired.group].filter(id => id !== desired.id); if (!desired.allowed) policy.blocked[desired.group].push(desired.id); }
    return policy;
  }
  private renderGenerations(): void {
    const fieldset = this.get<HTMLFieldSetElement>('admin-pokemon-generations'), policy = this.displayPolicy();
    fieldset.hidden = this.group !== 'pokemon';
    fieldset.disabled = !this.connected || !!this.pending || !policy || policy.blocked.pokemon.includes('*');
    for (const generation of POKEMON_GENERATIONS) {
      const input = fieldset.querySelector<HTMLInputElement>(`[data-pokemon-generation="${generation.id}"]`)!;
      input.checked = !!policy && !policy.blocked.pokemon.includes(generation.id);
      const members = pokemonGenerationMembers(generation.id), allowed = policy ? members.filter(kind => policyAllows(policy, 'pokemon', kind)).length : 0;
      const range = generation.first === null ? '図鑑番号は未公表' : `No.${String(generation.first).padStart(3, '0')}〜${generation.last}`;
      input.nextElementSibling!.querySelector('small')!.textContent = `${range} · ${allowed} / ${members.length}種類を許可`;
    }
  }
  private renderItems(): void {
    const list = this.get('admin-items'); list.replaceChildren();
    if (!this.snapshot?.administrator) return;
    const policy = this.displayPolicy()!, query = this.get<HTMLInputElement>('admin-query').value.normalize('NFKC').toLowerCase().trim();
    const items = this.items(), visible = items.filter(item => this.group === 'pokemon' ? pokemonMatches(item.id as import('./pokemon.ts').PokemonKind, query) : `${item.name} ${item.detail}`.normalize('NFKC').toLowerCase().includes(query));
    const enabled = this.desired?.group === this.group && this.desired.id === '*' ? this.desired.allowed : !policy.blocked[this.group].includes('*');
    this.get('admin-summary').textContent = `許可 ${items.filter(item => policyAllows(policy, this.group, item.id)).length} / ${items.length} · 検索結果 ${visible.length}件`;
    for (const item of visible) {
      const row = document.createElement('label'); row.className = 'admin-item';
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.adminItem = item.id;
      input.checked = !policy.blocked[this.group].includes(item.id); input.disabled = !this.connected || !!this.pending || !enabled || this.group === 'pokemon' && policy.blocked.pokemon.includes(pokemonGeneration(item.id as import('./pokemon.ts').PokemonKind).id);
      const text = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
      name.textContent = item.name; detail.textContent = item.detail; text.append(name, detail);
      const state = document.createElement('span'); state.className = 'admin-item-state'; state.textContent = policyAllows(policy, this.group, item.id) ? '許可' : '禁止';
      row.append(input, text, state); list.append(row);
    }
    if (!visible.length) list.textContent = '該当する項目はありません。';
  }
  private render(): void {
    this.button.hidden = !this.snapshot?.administrator; this.button.disabled = !this.connected || !this.snapshot?.administrator;
    for (const tab of this.dialog.querySelectorAll<HTMLButtonElement>('[data-admin-group]')) tab.setAttribute('aria-pressed', String(tab.dataset.adminGroup === this.group));
    const category = this.get<HTMLInputElement>('admin-category-enabled'); category.parentElement!.hidden = this.group === 'rooms';
    category.checked = this.desired?.group === this.group && this.desired.id === '*' ? this.desired.allowed : !this.snapshot?.policy.blocked[this.group].includes('*'); category.disabled = !this.connected || !!this.pending;
    category.nextElementSibling!.textContent = `${labels[this.group]}を館内に登場させる（個別の設定は保持）`;
    const time = this.snapshot?.policy.updatedAt;
    this.get('admin-updated').textContent = time ? `最終更新：${new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(time)} JST` : '未変更 · すべて許可しています。';
    this.renderItems();
    this.renderGenerations();
  }
  destroy(): void { clearTimeout(this.timer); this.dialog.remove(); }
}
