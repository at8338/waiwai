import { EVENT_PROP_NAMES, eventPropPixels } from '../src/game/event-props.ts';
import { EVENT_PROP_LABELS } from '../src/game/event-prop-labels.ts';
import before from './event-props-before.json';
const palette: Record<string, number> = { k:0x303743,w:0xf3eedc,r:0xcb6966,b:0x75afc6,y:0xd9b36b,G:0x709769,g:0x879b9e,p:0xab8cbd };
const gallery = document.querySelector('#prop-grid')!;
for (const kind of EVENT_PROP_NAMES) {
  const card = document.createElement('article'); card.className = 'prop-card'; card.dataset.prop = kind;
  const title = document.createElement('strong'); title.textContent = EVENT_PROP_LABELS[kind]; card.append(title);
  const pair = document.createElement('div'); pair.className = 'prop-pair';
  for (const old of [true,false]) {
    const figure = document.createElement('figure'), canvas = document.createElement('canvas'), caption = document.createElement('figcaption');
    canvas.width = canvas.height = 64; canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', `${EVENT_PROP_LABELS[kind]} · ${old?'変更前':'描き直し後'}`);
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    if (old) before[kind].forEach((row,y) => [...row].forEach((c,x) => { if(palette[c]!==undefined){ctx.fillStyle='#'+palette[c].toString(16).padStart(6,'0');ctx.fillRect(x*8,y*8,8,8);} }));
    else for (const p of eventPropPixels(kind)) { ctx.fillStyle='#'+p.color.toString(16).padStart(6,'0'); ctx.fillRect(p.x*8,p.y*8,p.w*8,p.h*8); }
    caption.textContent = old ? '変更前 8×8' : '描き直し後 32×32'; figure.append(canvas,caption); pair.append(figure);
  }
  card.append(pair); gallery.append(card);
}
const count = document.querySelector('#prop-count')!; count.textContent = `${EVENT_PROP_NAMES.length}種類すべて。実際の事件と同じ描画データです。`;
document.querySelector<HTMLInputElement>('#prop-search')!.addEventListener('input',event => {
  const query=(event.target as HTMLInputElement).value.trim();
  for(const card of gallery.children) (card as HTMLElement).hidden = !card.textContent?.includes(query);
});
