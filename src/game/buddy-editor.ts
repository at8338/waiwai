import { personalStorage } from './personal-storage.ts';
import { buddyThumbnails } from './buddy-thumbnails.ts';
import { BUDDIES, BUDDY_KINDS, isBuddyKind } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
import type { OfficeScene } from './OfficeScene.ts';
import { isPokemonKind, pokemonMatches, pokemonQuery } from './pokemon.ts';
const STORAGE = 'waiwai.buddy.v1';
export function setupBuddyEditor(scene: OfficeScene): void {
  let selected: BuddyKind | null = null;
  let favorites = new Set<BuddyKind>(['robot', 'cat']);
  try {
    const saved = JSON.parse(personalStorage.getItem(STORAGE) ?? 'null');
    if (saved && (saved.selected === null || isBuddyKind(saved.selected))) selected = saved.selected;
    if (Array.isArray(saved?.favorites)) favorites = new Set(saved.favorites.filter(isBuddyKind));
  } catch { /* Personal preferences are optional. */ }
  let draft = selected;
  const dialog = document.querySelector<HTMLDialogElement>('#buddy-dialog')!;
  const cards = document.querySelector('#buddy-cards')!;
  const only = document.querySelector<HTMLInputElement>('#buddy-favorites-only')!;
  const searchLabel = document.createElement('label'); searchLabel.htmlFor = 'buddy-query'; searchLabel.textContent = '名前・ポケモンの図鑑番号で探す';
  const query = document.createElement('input'); query.id = 'buddy-query'; query.type = 'search'; query.maxLength = 40; query.placeholder = '例：ぴかちゅう、ルギア、1025'; searchLabel.append(query); cards.before(searchLabel);
  const save = () => { try { personalStorage.setItem(STORAGE, JSON.stringify({ selected, favorites: [...favorites] })); } catch { /* Keep preferences in memory. */ } };
  const apply = () => {
    scene.setBuddy(selected);
    document.querySelector('#buddy-current')!.textContent = selected ? `${BUDDIES[selected].icon} ${BUDDIES[selected].name}` : 'お供を見つけよう';
  };
  const thumbnails = buddyThumbnails();
  const render = () => {
    thumbnails.reset();
    cards.replaceChildren();
    const none = document.createElement('label'); none.className = 'buddy-none';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'buddy'; input.value = ''; input.checked = draft === null;
    input.addEventListener('change', () => { draft = null; }); none.append(input, ' バディなし'); cards.append(none);
    for (const kind of BUDDY_KINDS) {
      if (only.checked && !favorites.has(kind)) continue;
      if (isPokemonKind(kind) ? !pokemonMatches(kind, query.value) : !pokemonQuery(BUDDIES[kind].name).includes(pokemonQuery(query.value))) continue;
      const data = BUDDIES[kind], card = document.createElement('div'); card.className = 'buddy-card';
      const label = document.createElement('label');
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'buddy'; radio.value = kind; radio.checked = draft === kind;
      radio.addEventListener('change', () => { draft = kind; });
      const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 22; canvas.setAttribute('aria-hidden', 'true');
      thumbnails.observe(canvas, kind);
      const title = document.createElement('strong'); title.textContent = data.name;
      const detail = document.createElement('span'); detail.textContent = data.description;
      label.append(radio, canvas, title, detail);
      const star = document.createElement('button'); star.type = 'button'; star.className = 'buddy-star';
      star.textContent = favorites.has(kind) ? '★' : '☆'; star.setAttribute('aria-label', `${data.name}をお気に入り`); star.setAttribute('aria-pressed', String(favorites.has(kind)));
      star.addEventListener('click', () => { if (favorites.has(kind)) favorites.delete(kind); else favorites.add(kind); save(); render(); });
      card.append(label, star); cards.append(card);
    }
  };
  apply();
  document.querySelector('#buddy-edit')!.addEventListener('click', () => { draft = selected; query.value = ''; render(); dialog.showModal(); });
  only.addEventListener('change', render);
  query.addEventListener('input', render);
  document.querySelector('#buddy-form')!.addEventListener('submit', (event) => { event.preventDefault(); selected = draft; save(); apply(); dialog.close(); });
  document.querySelector('#buddy-cancel')!.addEventListener('click', () => dialog.close());
  document.querySelector('#buddy-info-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#buddy-info')!.close());
}
