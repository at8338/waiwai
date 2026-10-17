import { LOST_ITEM_KINDS, LOST_ITEM_CATALOG, lostItemPixels } from '../src/game/lost-items.ts';
const gallery = document.querySelector<HTMLDivElement>('#gallery')!, search = document.querySelector<HTMLInputElement>('#search')!, scope = document.querySelector<HTMLSelectElement>('#scope')!;
function render(): void {
  const term = search.value.trim(), kinds = LOST_ITEM_KINDS.filter((kind) => {
    const entry = LOST_ITEM_CATALOG[kind];
    return (scope.value === 'all' || kind.startsWith('curio-') === (scope.value === 'new')) && `${entry.name} ${entry.note}`.includes(term);
  });
  gallery.replaceChildren(); document.querySelector('#count')!.textContent = `${kinds.length} / 375種類`;
  for (const kind of kinds) {
    const entry = LOST_ITEM_CATALOG[kind], card = document.createElement('article'), canvas = document.createElement('canvas'), text = document.createElement('div'), id = document.createElement('small'), title = document.createElement('h2'), note = document.createElement('p');
    canvas.width = canvas.height = 16; canvas.setAttribute('aria-hidden', 'true'); const ctx = canvas.getContext('2d')!;
    for (const p of lostItemPixels(kind)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); }
    id.textContent = kind.startsWith('curio-') ? `NEW · ${kind.slice(6).padStart(3, '0')}` : 'OLD FRIEND'; title.textContent = entry.name; note.textContent = entry.note;
    text.append(id, title); card.append(canvas, text, note); gallery.append(card);
  }
}
search.addEventListener('input', render); scope.addEventListener('change', render); render();
