import { BUDDIES, buddyPixels, BUDDY_WIDTH, BUDDY_HEIGHT } from './buddies.ts';
import { PokemonJournal, POKEMON_JOURNAL_KEY, POKEMON_KINDS } from './pokemon-journal.ts';
import type { PokemonKind } from './pokemon-journal.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const foundDate = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
export class PokemonJournalUI {
  private journal = new PokemonJournal({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
  private selected?: PokemonKind;
  constructor(signal: AbortSignal, private beforeOpen: () => boolean) {
    el('pokemon-journal-open').addEventListener('click', () => this.open(), { signal });
    el('pokemon-journal-close').addEventListener('click', () => el<HTMLDialogElement>('pokemon-journal-dialog').close(), { signal });
    el('pokemon-journal-dialog').addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    window.addEventListener('storage', (event) => {
      if (event.key !== POKEMON_JOURNAL_KEY || event.storageArea !== localStorage) return;
      this.journal.merge(event.newValue); this.render();
    }, { signal });
    this.render();
  }
  inspect(kind: PokemonKind, roomId: RoomId): void {
    if (!this.beforeOpen()) return;
    const fresh = this.journal.discover(kind, roomId); this.selected = kind;
    el('pokemon-journal-notice').textContent = fresh ? `✦ ${BUDDIES[kind].name}を発見！ 図鑑に追加しました。` : `✓ ${BUDDIES[kind].name}は発見済みです。`;
    this.render(); el<HTMLDialogElement>('pokemon-journal-dialog').showModal();
  }
  private open(): void {
    if (!this.beforeOpen()) return;
    this.journal.refresh(); this.selected = undefined; el('pokemon-journal-notice').textContent = '';
    this.render(); el<HTMLDialogElement>('pokemon-journal-dialog').showModal();
  }
  private render(): void {
    const entries = this.journal.entries(), count = entries.length;
    el('pokemon-journal-open').textContent = `ポケモン図鑑 ${count} / ${POKEMON_KINDS.length}`;
    el('pokemon-journal-progress').textContent = count === POKEMON_KINDS.length ? `全${count}種類を発見！ オフィスの仲間がそろいました。` : `${count} / ${POKEMON_KINDS.length}種類を発見`;
    el<HTMLProgressElement>('pokemon-journal-meter').value = count;
    el<HTMLProgressElement>('pokemon-journal-meter').max = POKEMON_KINDS.length;
    el('pokemon-journal-storage').textContent = this.journal.stored ? '発見記録はこのブラウザに保存します。同じURLのタブで共有されます。別の端末・ブラウザには同期されません。' : 'ブラウザに保存できません。この画面を開いている間だけ記録します。';
    const cards = el('pokemon-journal-cards'); cards.replaceChildren();
    for (const [index, kind] of POKEMON_KINDS.entries()) {
      const entry = entries.find((found) => found.kind === kind), data = BUDDIES[kind];
      const card = document.createElement('li'); card.className = `pokemon-card${entry ? ' is-found' : ''}${this.selected === kind ? ' is-selected' : ''}`;
      card.dataset.pokemon = kind; card.dataset.discovered = String(!!entry);
      const number = document.createElement('span'); number.className = 'pokemon-number'; number.textContent = `OFFICE No.${String(index + 1).padStart(3, '0')}`;
      const art = document.createElement('canvas'); art.width = BUDDY_WIDTH; art.height = BUDDY_HEIGHT; art.setAttribute('aria-hidden', 'true');
      const ctx = art.getContext('2d')!;
      for (const pixel of buddyPixels(kind)) { ctx.fillStyle = entry ? `#${pixel.color.toString(16).padStart(6, '0')}` : '#b6b9aa'; ctx.fillRect(pixel.x, pixel.y, pixel.w, pixel.h); }
      const name = document.createElement('h3'); name.textContent = entry ? data.name : '？？？';
      const description = document.createElement('p'); description.textContent = entry ? data.description : 'どこかの部屋で、あなたを待っています。見つけたらクリック！';
      const stamp = document.createElement('p'); stamp.className = 'pokemon-stamp'; stamp.textContent = entry ? `✓ はじめての発見\n${getRoom(entry.roomId).name}\n${foundDate.format(entry.foundAt)} JST` : 'まだ出会っていません';
      card.append(number, art, name, description, stamp); cards.append(card);
    }
  }
}
