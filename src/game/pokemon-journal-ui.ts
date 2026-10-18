import { personalStorage, serverPersonalData } from './personal-storage.ts';
import { buddyThumbnails } from './buddy-thumbnails.ts';
import { BUDDIES, BUDDY_WIDTH, BUDDY_HEIGHT } from './buddies.ts';
import { PokemonJournal, POKEMON_JOURNAL_KEY, POKEMON_KINDS } from './pokemon-journal.ts';
import type { PokemonKind } from './pokemon-journal.ts';
import { POKEMON, pokemonMatches, pokemonNumber } from './pokemon.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const foundDate = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export class PokemonJournalUI {
  private journal = new PokemonJournal({ getItem: (key) => personalStorage.getItem(key), setItem: (key, value) => personalStorage.setItem(key, value) });
  private thumbnails = buddyThumbnails();
  private selected?: PokemonKind;
  constructor(signal: AbortSignal, private beforeOpen: () => boolean) {
    const filters = document.createElement('div'); filters.className = 'pokemon-filters';
    filters.innerHTML = '<label for="pokemon-query">図鑑番号・発見した名前で探す<input id="pokemon-query" type="search" placeholder="例：025、ぴかちゅう" maxlength="40"></label><label><input id="pokemon-found-only" type="checkbox"> 発見済みだけ表示</label><p id="pokemon-filter-count" role="status"></p>';
    el('pokemon-journal-cards').before(filters);
    el('pokemon-query').addEventListener('input', () => this.render(), { signal });
    el('pokemon-found-only').addEventListener('change', () => this.render(), { signal });
    el('pokemon-journal-open').addEventListener('click', () => this.open(), { signal });
    el('pokemon-journal-close').addEventListener('click', () => el<HTMLDialogElement>('pokemon-journal-dialog').close(), { signal });
    el('pokemon-journal-dialog').addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    window.addEventListener('storage', (event) => {
      if (serverPersonalData() || event.key !== POKEMON_JOURNAL_KEY || event.storageArea !== localStorage) return;
      this.journal.merge(event.newValue); this.render();
    }, { signal });
    signal.addEventListener('abort', () => this.thumbnails.reset(), { once: true });
    this.render();
  }
  inspect(kind: PokemonKind, roomId: RoomId): void {
    if (!this.beforeOpen()) return;
    const fresh = this.journal.discover(kind, roomId); this.selected = kind;
    el<HTMLInputElement>('pokemon-query').value = POKEMON[kind].id === null ? POKEMON[kind].name : String(POKEMON[kind].id).padStart(3, '0'); el<HTMLInputElement>('pokemon-found-only').checked = false;
    el('pokemon-journal-notice').textContent = fresh ? `✦ ${BUDDIES[kind].name}を発見！ 図鑑に追加しました。` : `✓ ${BUDDIES[kind].name}は発見済みです。`;
    this.render(); el<HTMLDialogElement>('pokemon-journal-dialog').showModal();
  }
  private open(): void {
    if (!this.beforeOpen()) return;
    this.journal.refresh(); this.selected = undefined; el('pokemon-journal-notice').textContent = '';
    el<HTMLInputElement>('pokemon-query').value = ''; el<HTMLInputElement>('pokemon-found-only').checked = false;
    this.render(); el<HTMLDialogElement>('pokemon-journal-dialog').showModal();
  }
  private render(): void {
    const entries = this.journal.entries(), count = entries.length;
    el('pokemon-journal-open').textContent = `ポケモン図鑑 ${count} / ${POKEMON_KINDS.length}`;
    el('pokemon-journal-progress').textContent = count === POKEMON_KINDS.length ? `全${count}種類を発見！ オフィスの仲間がそろいました。` : `${count} / ${POKEMON_KINDS.length}種類を発見`;
    el<HTMLProgressElement>('pokemon-journal-meter').value = count;
    el<HTMLProgressElement>('pokemon-journal-meter').max = POKEMON_KINDS.length;
    el('pokemon-journal-storage').textContent = this.journal.stored ? serverPersonalData() ? '発見記録はログインしたアカウントに保存します。保存状況はプロフィール欄で確認できます。' : '発見記録はこのブラウザに保存します。同じURLのタブで共有されます。別の端末・ブラウザには同期されません。' : 'ブラウザに保存できません。この画面を開いている間だけ記録します。';
    this.thumbnails.reset();
    const cards = el('pokemon-journal-cards'); cards.replaceChildren();
    const query = el<HTMLInputElement>('pokemon-query').value, foundOnly = el<HTMLInputElement>('pokemon-found-only').checked;
    let visible = 0;
    for (const kind of POKEMON_KINDS) {
      const entry = entries.find((found) => found.kind === kind), data = BUDDIES[kind];
      if (foundOnly && !entry || !pokemonMatches(kind, query, !!entry)) continue;
      visible++;
      const card = document.createElement('li'); card.className = `pokemon-card${entry ? ' is-found' : ''}${this.selected === kind ? ' is-selected' : ''}`;
      card.dataset.pokemon = kind; card.dataset.discovered = String(!!entry);
      const number = document.createElement('span'); number.className = 'pokemon-number'; number.textContent = pokemonNumber(kind);
      const art = document.createElement('canvas'); art.width = BUDDY_WIDTH; art.height = BUDDY_HEIGHT; art.setAttribute('aria-hidden', 'true');
      this.thumbnails.observe(art, kind, !entry);
      const name = document.createElement('h3'); name.textContent = entry ? data.name : '？？？';
      const description = document.createElement('p'); description.textContent = entry ? data.description : 'どこかの部屋で、あなたを待っています。見つけたらクリック！';
      const stamp = document.createElement('p'); stamp.className = 'pokemon-stamp'; stamp.textContent = entry ? `✓ はじめての発見\n${getRoom(entry.roomId).name}\n${foundDate.format(entry.foundAt)} JST` : 'まだ出会っていません';
      card.append(number, art, name, description, stamp); cards.append(card);
    }
    el('pokemon-filter-count').textContent = `${visible}種類を表示 / 全${POKEMON_KINDS.length}種類${visible ? '' : ' · 条件に合う記録がありません。'}`;
  }
}
