import { BUDDIES, BUDDY_KINDS, buddyPixels, isBuddyKind } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
import type { OfficeScene } from './OfficeScene.ts';
const STORAGE = 'waiwai.buddy.v1';
export function setupBuddyEditor(scene: OfficeScene): void {
  let selected: BuddyKind | null = null;
  let favorites = new Set<BuddyKind>(['robot', 'cat']);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    if (saved && (saved.selected === null || isBuddyKind(saved.selected))) selected = saved.selected;
    if (Array.isArray(saved?.favorites)) favorites = new Set(saved.favorites.filter(isBuddyKind));
  } catch { /* Personal preferences are optional. */ }
  let draft = selected;
  const dialog = document.querySelector<HTMLDialogElement>('#buddy-dialog')!;
  const cards = document.querySelector('#buddy-cards')!;
  const only = document.querySelector<HTMLInputElement>('#buddy-favorites-only')!;
  const save = () => { try { localStorage.setItem(STORAGE, JSON.stringify({ selected, favorites: [...favorites] })); } catch { /* Keep preferences in memory. */ } };
  const apply = () => {
    scene.setBuddy(selected);
    document.querySelector('#buddy-current')!.textContent = selected ? `${BUDDIES[selected].icon} ${BUDDIES[selected].name}` : 'お供を見つけよう';
  };
  const render = () => {
    cards.replaceChildren();
    const none = document.createElement('label'); none.className = 'buddy-none';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'buddy'; input.value = ''; input.checked = draft === null;
    input.addEventListener('change', () => { draft = null; }); none.append(input, ' バディなし'); cards.append(none);
    for (const kind of BUDDY_KINDS) {
      if (only.checked && !favorites.has(kind)) continue;
      const data = BUDDIES[kind], card = document.createElement('div'); card.className = 'buddy-card';
      const label = document.createElement('label');
      const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'buddy'; radio.value = kind; radio.checked = draft === kind;
      radio.addEventListener('change', () => { draft = kind; });
      const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 22; canvas.setAttribute('aria-hidden', 'true');
      const ctx = canvas.getContext('2d')!;
      for (const p of buddyPixels(kind)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); }
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
  document.querySelector('#buddy-edit')!.addEventListener('click', () => { draft = selected; render(); dialog.showModal(); });
  only.addEventListener('change', render);
  document.querySelector('#buddy-form')!.addEventListener('submit', (event) => { event.preventDefault(); selected = draft; save(); apply(); dialog.close(); });
  document.querySelector('#buddy-cancel')!.addEventListener('click', () => dialog.close());
  document.querySelector('#buddy-info-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#buddy-info')!.close());
}
