import { SPELLS, SPELL_KINDS, MAX_CALL_TARGETS } from './spells.ts';
import type { SpellAction, SpellKind } from './spells.ts';
import { searchPeople } from './directory.ts';
import type { Person } from './directory.ts';
import { getRoom } from './rooms.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
export class SpellsUI {
  private people: Person[] = [];
  private selfId?: string;
  private connected = false;
  private spell: SpellKind = 'call';
  private selected = new Set<string>();
  private pending?: { id: string; spell: SpellKind; count: number };
  private cooldowns = new Map<SpellKind, number>();
  private timer: ReturnType<typeof setInterval>;
  private timeout?: ReturnType<typeof setTimeout>;
  constructor(signal: AbortSignal, private send: (action: SpellAction) => boolean, private beforeOpen: () => boolean) {
    el('spells-open').addEventListener('click', () => { if (this.beforeOpen()) { this.render(); el<HTMLDialogElement>('spells-dialog').showModal(); } }, { signal });
    el('spells-close').addEventListener('click', () => el<HTMLDialogElement>('spells-dialog').close(), { signal });
    el('spells-dialog').addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-spell-choice]')) button.addEventListener('click', () => { this.spell = button.dataset.spellChoice as SpellKind; this.render(); }, { signal });
    for (const kind of ['fire', 'blizzard'] as const) el(`spell-${kind}-quick`).addEventListener('click', () => this.quick(kind), { signal });
    el('spell-query').addEventListener('input', () => this.renderPeople(), { signal });
    el('spell-people').addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (!input.matches('[data-spell-person]')) return;
      if (input.checked) this.selected.add(input.dataset.spellPerson!); else this.selected.delete(input.dataset.spellPerson!);
      this.renderControls();
    }, { signal });
    el('spell-clear').addEventListener('click', () => { this.selected.clear(); this.render(); }, { signal });
    el('spell-cast').addEventListener('click', () => this.request(this.spell), { signal });
    this.timer = setInterval(() => this.renderControls(), 200); this.render();
  }
  setPeople(people: Person[]): void { this.people = people; for (const id of this.selected) if (!people.some((person) => person.id === id && person.online && person.playerId !== this.selfId)) this.selected.delete(id); this.render(); }
  setConnected(value: boolean, selfId?: string): void { this.connected = value; this.selfId = selfId; if (!value) { this.pending = undefined; this.selected.clear(); clearTimeout(this.timeout); } this.render(); }
  quick(spell: 'fire' | 'blizzard'): void { if (this.beforeOpen()) this.request(spell); }
  receiveIce(activeUntil: number, serverNow: number): void { this.cooldowns.set('blizzard', performance.now() + Math.max(0, activeUntil - serverNow)); this.renderControls(); }
  result(id: string, error?: string): void {
    if (this.pending?.id !== id) return;
    const pending = this.pending; this.pending = undefined; clearTimeout(this.timeout);
    if (!error) { if (pending.spell !== 'blizzard') this.cooldowns.set(pending.spell, performance.now() + SPELLS[pending.spell].cooldown); el<HTMLDialogElement>('spells-dialog').close(); }
    this.status(error ?? (pending.spell === 'call' ? `🔔 コール！ ${pending.count}人を呼び寄せました。` : pending.spell === 'rura' ? '🪽 ルーラ！ 相手の隣へ移動しました。' : pending.spell === 'blizzard' ? '❄ ブリザド！ 氷の盾は3秒で消えます。' : '🔥 ファイア！')); this.renderControls();
  }
  destroy(): void { clearInterval(this.timer); clearTimeout(this.timeout); }
  private status(text: string): void { el('spell-status').textContent = text; el('spell-dialog-status').textContent = text; }
  private request(spell: SpellKind): void {
    if (!this.connected || this.pending || performance.now() < (this.cooldowns.get(spell) ?? 0)) return;
    const targets = this.people.filter((person) => this.selected.has(person.id) && person.online && person.playerId && person.playerId !== this.selfId);
    if (spell === 'call' && (!targets.length || targets.length > MAX_CALL_TARGETS) || spell === 'rura' && targets.length !== 1) { this.status(spell === 'call' ? `呼ぶ人を1〜${MAX_CALL_TARGETS}人選んでください。` : '会いに行く人を1人だけ選んでください。'); return; }
    const actionId = crypto.randomUUID();
    const action: SpellAction = spell === 'fire' || spell === 'blizzard' ? { type: 'spell-cast', spell, actionId } : spell === 'rura' ? { type: 'spell-cast', spell, targetId: targets[0].playerId!, actionId } : { type: 'spell-cast', spell, targetIds: targets.map((person) => person.playerId!), actionId };
    if (!this.send(action)) { this.status('再接続してから唱えてください。'); return; }
    this.pending = { id: actionId, spell, count: targets.length }; this.status(`${SPELLS[spell].name}を唱えています…`);
    this.timeout = setTimeout(() => { this.pending = undefined; this.status('結果を確認できませんでした。接続を確認してください。'); this.renderControls(); }, 7000); this.renderControls();
  }
  private render(): void { this.renderPeople(); this.renderControls(); }
  private renderPeople(): void {
    const list = el('spell-people'), focus = (document.activeElement as HTMLElement | null)?.dataset.spellPerson; list.replaceChildren();
    const results = searchPeople(this.people, el<HTMLInputElement>('spell-query').value).filter((person) => person.playerId !== this.selfId);
    for (const person of results) {
      const li = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.dataset.spellPerson = person.id; input.checked = this.selected.has(person.id); input.disabled = !this.connected || !person.online || !person.playerId || !!this.pending;
      const name = document.createElement('strong'); name.textContent = person.name;
      const location = document.createElement('span'); location.textContent = person.online && person.roomId ? getRoom(person.roomId).name : 'オフライン';
      label.append(input, name, location); li.append(label); list.append(li); if (focus === person.id) input.focus({ preventScroll: true });
    }
    el('spell-empty').hidden = results.length > 0;
  }
  private renderControls(): void {
    const now = performance.now(), disabled = !this.connected || !!this.pending;
    for (const kind of SPELL_KINDS) el<HTMLButtonElement>(`spell-choice-${kind}`).setAttribute('aria-pressed', String(this.spell === kind));
    el('spell-description').textContent = SPELLS[this.spell].description;
    el('spell-targets').hidden = this.spell === 'fire' || this.spell === 'blizzard';
    el('spell-selection-count').textContent = `選択中 ${this.selected.size}人 · ${this.spell === 'rura' ? 'ルーラは1人を選択' : `コールは最大${MAX_CALL_TARGETS}人`}`;
    el<HTMLButtonElement>('spells-open').disabled = !this.connected;
    const wait = Math.max(0, Math.ceil(((this.cooldowns.get(this.spell) ?? 0) - now) / 1000));
    const cast = el<HTMLButtonElement>('spell-cast'); cast.disabled = disabled || wait > 0; cast.textContent = wait ? `あと${wait}秒` : `${SPELLS[this.spell].icon} ${SPELLS[this.spell].name}を唱える`;
    for (const kind of ['fire', 'blizzard'] as const) { const button = el<HTMLButtonElement>(`spell-${kind}-quick`), wait = Math.max(0, Math.ceil(((this.cooldowns.get(kind) ?? 0) - now) / 1000)); button.disabled = disabled || wait > 0; button.textContent = wait ? `${SPELLS[kind].icon} ${wait}秒` : `${SPELLS[kind].icon} ${SPELLS[kind].name}`; }
  }
}
