import { DAILY_EPISODES } from './daily-event-catalog.ts';
import { POKEMON, POKEMON_KINDS, MAX_DAILY_POKEMON, pokemonMatches } from './pokemon.ts';
import type { PokemonKind } from './pokemon.ts';
import { LOST_ITEM_CATALOG, LOST_ITEM_KINDS, lostItemRarity } from './lost-items.ts';
import type { LostItemKind } from './lost-items.ts';
import { ROOMS, getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import type { DevWorldAction, DevWorldSnapshot } from './dev-world.ts';
type Payload<T = DevWorldAction> = T extends DevWorldAction ? Omit<T, 'type' | 'actionId'> : never;
export class DevWorldUI {
  private dialog = document.createElement('dialog');
  private state?: DevWorldSnapshot;
  private connected = false;
  private pending?: string;
  private timer?: ReturnType<typeof setTimeout>;
  private button = document.querySelector<HTMLButtonElement>('#dev-world-open')!;
  constructor(signal: AbortSignal, private send: (action: DevWorldAction) => boolean, private visit: (room: RoomId) => void, private beforeOpen: () => boolean) {
    this.dialog.id = 'dev-world-dialog'; this.dialog.className = 'dev-world-dialog'; this.dialog.setAttribute('aria-labelledby', 'dev-world-title');
    const rooms = ROOMS.map((room) => `<option value="${room.id}">${room.name}</option>`).join('');
    this.dialog.innerHTML = `<span class="eyebrow">LOCAL DEVELOPMENT · WORLD TEST CONTROLS</span><h2 id="dev-world-title" tabindex="-1" autofocus>事件と出現のテスト</h2><p>変更はこの開発サーバーの全員に共有されます。「通常に戻す」・サーバー再起動・JSTの日付切替で元に戻ります。</p><section><h3>365日の事件</h3><p id="dev-event-current"></p><div class="dev-world-row"><button type="button" data-command="previous">← 前の事件</button><button type="button" data-command="next">次の事件 →</button><button type="button" data-command="event-random">ランダム</button><button type="button" id="dev-event-visit">現場を見る ↗</button></div><label>事件を指定<select id="dev-event-select">${DAILY_EPISODES.map((episode, index) => `<option value="${episode.id}">${String(index+1).padStart(3,'0')} · ${episode.title}</option>`).join('')}</select></label><label>出す部屋<select id="dev-event-room"><option value="">自動で選ぶ</option>${rooms}</select></label><button type="button" data-command="event">この事件を表示</button><p class="field-hint">テスト事件は、事件の図鑑の発見記録を変更しません。窓が必要な事件は、窓のある部屋で表示します。</p></section><section><h3>ポケモン · 1日最大${MAX_DAILY_POKEMON}体</h3><p>同じ種類は館内に1体だけ。出やすさを使って毎日抽選します。バディはこの7体に含みません。</p><div id="dev-pokemon-choices">${POKEMON_KINDS.map((kind) => `<label><input type="checkbox" value="${kind}"><span>${POKEMON[kind].icon} ${POKEMON[kind].name}<small>${POKEMON[kind].rarity}</small></span></label>`).join('')}</div><label>出す部屋<select id="dev-pokemon-room"><option value="">全館に分散</option>${rooms}</select></label><div class="dev-world-row"><button type="button" data-command="pokemon-draw">出やすさで抽選し直す</button><button type="button" data-command="pokemon">選んだ種類を出す（最大7）</button></div><ul id="dev-pokemon-current"></ul><p class="field-hint">ポケモンをクリックしたときの図鑑への登録は通常どおり動作します。</p></section><section><h3>落とし物 · 全館で最大3個</h3><label>種類を指定<select id="dev-lost-select"><option value="">出やすさで抽選する</option>${LOST_ITEM_KINDS.map((kind) => `<option value="${kind}">${LOST_ITEM_CATALOG[kind].name} · ${lostItemRarity(kind)}</option>`).join('')}</select></label><label>指定した1個を出す部屋<select id="dev-lost-room"><option value="">自動で選ぶ</option>${rooms}</select></label><div class="dev-world-row"><button type="button" data-command="lost">この落とし物を含めて変更</button><button type="button" data-command="lost-draw">抽選し直す</button></div><ul id="dev-lost-current"></ul><p class="field-hint">同じ種類は1個だけ。残りも重複しないよう抽選し、通常は30分ごとに入れ替わります。</p></section><p id="dev-world-status" role="status"></p><div class="dialog-actions"><button type="button" data-command="reset">すべて通常に戻す</button><button type="button" id="dev-world-close">閉じる</button></div>`;
    const tabs = document.createElement('nav'); tabs.className = 'dev-world-tabs'; tabs.setAttribute('aria-label', 'テストする種類');
    const sections = [...this.dialog.querySelectorAll<HTMLElement>(':scope > section')];
    for (const [index, name] of ['事件', 'ポケモン', '落とし物'].entries()) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = name;
      button.setAttribute('aria-controls', `dev-world-section-${index}`); button.setAttribute('aria-pressed', String(index === 0));
      sections[index].id = `dev-world-section-${index}`; sections[index].classList.add('dialog-scroll'); sections[index].hidden = index !== 0;
      button.addEventListener('click', () => {
        sections.forEach((section, current) => { section.hidden = current !== index; section.scrollTop = 0; });
        [...tabs.children].forEach((tab, current) => tab.setAttribute('aria-pressed', String(current === index)));
      }, { signal });
      tabs.append(button);
    }
    sections[0].before(tabs);
    this.dialog.classList.add('dialog-list-layout');
    document.body.append(this.dialog);
    const search = document.createElement('label'); search.htmlFor = 'dev-pokemon-query'; search.textContent = `${POKEMON_KINDS.length}種類から名前・図鑑番号で探す`;
    const query = document.createElement('input'); query.id = 'dev-pokemon-query'; query.type = 'search'; query.maxLength = 40; query.placeholder = '例：ミュウツー、るぎあ、1025'; search.append(query);
    this.get('dev-pokemon-choices').before(search);
    const count = document.createElement('p'); count.id = 'dev-pokemon-count'; count.setAttribute('role', 'status'); this.get('dev-pokemon-choices').after(count);
    const clear = document.createElement('button'); clear.id = 'dev-pokemon-clear'; clear.type = 'button'; clear.textContent = '選択をクリア'; search.after(clear);
    clear.addEventListener('click', () => { for (const input of this.dialog.querySelectorAll<HTMLInputElement>('#dev-pokemon-choices input')) input.checked = false; this.filterPokemon(); }, { signal });
    query.addEventListener('input', () => this.filterPokemon(), { signal });
    this.get('dev-pokemon-choices').addEventListener('change', () => this.filterPokemon(), { signal });
    this.button.addEventListener('click', () => { if (this.beforeOpen()) this.dialog.showModal(); }, { signal });
    this.get('dev-world-close').addEventListener('click', () => this.dialog.close(), { signal });
    this.dialog.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    this.get('dev-event-visit').addEventListener('click', () => { if (this.state) this.go(this.state.event.roomId); }, { signal });
    this.dialog.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-command]'); if (!button || button.disabled) return;
      const command = button.dataset.command;
      const room = (id: string) => { const value = this.get<HTMLSelectElement>(id).value; return value ? { roomId: value as RoomId } : {}; };
      if (command === 'next' || command === 'previous') this.request({ command: 'event-step', step: command === 'next' ? 1 : -1 });
      if (command === 'event-random' || command === 'reset') this.request({ command });
      if (command === 'event') this.request({ command, episodeId: this.get<HTMLSelectElement>('dev-event-select').value, ...room('dev-event-room') });
      if (command === 'pokemon' || command === 'pokemon-draw') {
        const kinds = [...this.dialog.querySelectorAll<HTMLInputElement>('#dev-pokemon-choices input:checked')].map((input) => input.value as PokemonKind);
        if (command === 'pokemon' && kinds.length > MAX_DAILY_POKEMON) { this.get('dev-world-status').textContent = 'ポケモンは7種類まで選んでください。'; return; }
        this.request({ command: 'pokemon', ...(command === 'pokemon' ? { kinds } : {}), ...room('dev-pokemon-room') });
      }
      if (command === 'lost' || command === 'lost-draw') {
        const kind = this.get<HTMLSelectElement>('dev-lost-select').value;
        this.request({ command: 'lost', ...(command === 'lost' && kind ? { kind: kind as LostItemKind } : {}), ...room('dev-lost-room') });
      }
    }, { signal });
  }
  setConnected(value: boolean): void { this.connected = value; if (!value) { this.state = undefined; this.pending = undefined; clearTimeout(this.timer); } this.render(); }
  receive(state: DevWorldSnapshot): void {
    this.state = state; this.get<HTMLSelectElement>('dev-event-select').value = state.event.episodeId;
    for (const input of this.dialog.querySelectorAll<HTMLInputElement>('#dev-pokemon-choices input')) input.checked = state.pokemon.some((pet) => pet.kind === input.value);
    this.render();
  }
  result(id: string, error?: string): void { if (id !== this.pending) return; this.pending = undefined; clearTimeout(this.timer); this.get('dev-world-status').textContent = error ?? '変更を共有しました。現場や出現先の部屋で確認できます。'; this.render(); }
  destroy(): void { clearTimeout(this.timer); this.dialog.remove(); }
  private get<T extends HTMLElement = HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private filterPokemon(): void {
    const query = this.get<HTMLInputElement>('dev-pokemon-query').value;
    const inputs = [...this.dialog.querySelectorAll<HTMLInputElement>('#dev-pokemon-choices input')];
    const count = inputs.filter(input => input.checked).length;
    for (const input of inputs) { input.closest('label')!.hidden = !pokemonMatches(input.value as PokemonKind, query); input.disabled = !this.connected || !!this.pending || count >= MAX_DAILY_POKEMON && !input.checked; }
    this.get('dev-pokemon-count').textContent = `選択中 ${count} / ${MAX_DAILY_POKEMON}種類 · 全${POKEMON_KINDS.length}種類`;
  }
  private go(room: RoomId): void { this.dialog.close(); this.visit(room); }
  private request(payload: Payload): void {
    if (!this.connected || !this.state || this.pending) return;
    const action: DevWorldAction = { ...payload, type: 'dev-world', actionId: crypto.randomUUID() };
    if (!this.send(action)) return; this.pending = action.actionId; this.get('dev-world-status').textContent = '変更しています…';
    this.timer = setTimeout(() => { this.pending = undefined; this.get('dev-world-status').textContent = '応答を確認できません。再接続後に確認してください。'; this.render(); }, 5000); this.render();
  }
  private render(): void {
    this.filterPokemon();
    this.get<HTMLButtonElement>('dev-pokemon-clear').disabled = !this.connected || !!this.pending;
    this.button.hidden = !this.state; this.button.disabled = !this.connected || !this.state;
    for (const button of this.dialog.querySelectorAll<HTMLButtonElement>('[data-command]')) button.disabled = !this.connected || !this.state || !!this.pending;
    if (!this.state) return;
    const state = this.state, index = DAILY_EPISODES.findIndex((episode) => episode.id === state.event.episodeId);
    this.get('dev-event-current').textContent = `${index+1} / 365 · ${DAILY_EPISODES[index].title} · ${getRoom(state.event.roomId).name}${state.preview ? ' · テスト中' : ' · 今日の通常表示'}`;
    const fill = (id: string, rows: { name: string; roomId: RoomId }[]) => {
      const list = this.get(id); list.replaceChildren();
      for (const row of rows) {
        const li = document.createElement('li'), text = document.createElement('span'), button = document.createElement('button'); text.textContent = `${row.name} · ${getRoom(row.roomId).name}`;
        button.type = 'button'; button.textContent = '部屋へ ↗'; button.addEventListener('click', () => this.go(row.roomId)); li.append(text, button); list.append(li);
      }
    };
    fill('dev-pokemon-current', state.pokemon.map((pet) => ({ name: POKEMON[pet.kind].name, roomId: pet.roomId })));
    fill('dev-lost-current', state.lost.map((item) => ({ name: LOST_ITEM_CATALOG[item.kind].name, roomId: item.roomId })));
  }
}
