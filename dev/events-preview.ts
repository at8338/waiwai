import Phaser from 'phaser';
import { DAILY_EPISODES, EVENT_THEMES, episodeById } from '../src/game/daily-event-catalog.ts';
import { drawEventPreview } from '../src/game/daily-event-art.ts';
import { eventStageDescription } from '../src/game/daily-event-stage.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
import { DailyEventsView } from '../src/game/daily-events-view.ts';
import { SkyWindowView } from '../src/game/SkyWindowView.ts';
import { RoomLighting } from '../src/game/RoomLighting.ts';
import { drawOffice } from '../src/game/art.ts';
import { ROOMS } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
const episodeSelect = document.querySelector<HTMLSelectElement>('#episodes')!, roomSelect = document.querySelector<HTMLSelectElement>('#rooms')!;
const themeSelect = document.querySelector<HTMLSelectElement>('#themes')!;
const search = document.querySelector<HTMLInputElement>('#search')!;
const lightSelect = document.querySelector<HTMLSelectElement>('#light')!;
const matches = (e: (typeof DAILY_EPISODES)[number]) => (!themeSelect.value || e.theme === themeSelect.value) && `${e.title} ${e.discovery}`.includes(search.value.trim());
for (const [id, name] of Object.entries(EVENT_THEMES)) themeSelect.add(new Option(name, id));
for (const [index, e] of DAILY_EPISODES.entries()) episodeSelect.add(new Option(`${String(index + 1).padStart(3, '0')} · ${e.title}`, e.id));
for (const room of ROOMS) roomSelect.add(new Option(room.name, room.id));
roomSelect.value = 'meeting';
class Preview extends Phaser.Scene {
  private view?: DailyEventsView;
  private sky?: SkyWindowView;
  private lighting?: RoomLighting;
  private furniture: Phaser.GameObjects.GameObject[] = [];
  private observer?: IntersectionObserver;
  create(): void {
    this.view = new DailyEventsView(this, () => { document.querySelector('#notice')!.textContent = episodeById(episodeSelect.value)!.discovery; });
    this.sky = new SkyWindowView(document.querySelector<HTMLCanvasElement>('#sky-window')!);
    this.lighting = new RoomLighting(this);
    this.refresh();
    search.addEventListener('input', () => this.filter());
    episodeSelect.addEventListener('change', () => this.refresh()); roomSelect.addEventListener('change', () => this.refresh());
    for (const [id, delta] of [['previous', -1], ['next', 1]] as const) document.querySelector(`#${id}`)!.addEventListener('click', () => {
      const episodes = DAILY_EPISODES.filter(matches), index = episodes.findIndex(e => e.id === episodeSelect.value);
      if (!episodes.length) return;
      episodeSelect.value = episodes[(index + delta + episodes.length) % episodes.length].id; this.refresh();
    });
    themeSelect.addEventListener('change', () => this.filter());
    for (const [id, label] of [['thief-02', '紙の大行進'], ['thief-04', '椅子のストライキ'], ['waldo-02', '将棋盤'], ['alice-02', '逆さの家具'], ['dinosaur-07', '恐竜の保育園'], ['meteor-11', '室内オーロラ'], ['santa-01', 'サンタ'], ['meteor-01', '隕石'], ['delorean-01', 'デロリアン']]) {
      const button = document.createElement('button'); button.textContent = label; button.addEventListener('click', () => { themeSelect.value = ''; search.value = ''; episodeSelect.value = id; this.filter(); }); document.querySelector('#examples')!.append(button);
    }
  }
  private filter(): void {
    const episodes = DAILY_EPISODES.filter(matches);
    episodeSelect.disabled = !episodes.length;
    for (const option of episodeSelect.options) option.hidden = !matches(episodeById(option.value)!);
    for (const id of ['previous', 'next']) document.querySelector<HTMLButtonElement>(`#${id}`)!.disabled = !episodes.length;
    if (episodes.length && !episodes.some(e => e.id === episodeSelect.value)) episodeSelect.value = episodes[0].id;
    if (episodes.length) this.refresh(); else { this.gallery(); document.querySelector('#notice')!.textContent = '条件に合う事件はありません。検索を消すと365件に戻ります。'; }
  }
  private refresh(): void {
    const episode = episodeById(episodeSelect.value)!, room = roomSelect.value as RoomId;
    for (const item of this.furniture) item.destroy(); this.furniture = drawOffice(this, room); this.view!.setDecorations(this.furniture);
    const state = { event: { ...dailyEventAt(Date.now()), episodeId: episode.id, roomId: room }, serverNow: Date.now() };
    this.view!.setRoom(room); this.view!.setObjects([]); this.view!.receive(state); this.sky!.setRoom(room); this.sky!.setDailyEvent(state); this.lighting!.setRoom(room);
    document.querySelector('#title')!.textContent = episode.title; document.querySelector('#theme')!.textContent = EVENT_THEMES[episode.theme]; document.querySelector('#story')!.textContent = `${eventStageDescription(episode)}\n\n${episode.discovery}`;
    document.querySelector('#notice')!.textContent = episode.theme === 'kaiju' && room === 'ops' ? 'この部屋には窓がないので、窓の外の来客は見えません。実際の抽選では管制室は対象外です。' : '来客にクリックすると、この事件の事情が分かります。';
    drawEventPreview(document.querySelector<HTMLCanvasElement>('#illustration')!, episode, room);
    document.querySelector('#episode-progress')!.textContent = `${DAILY_EPISODES.indexOf(episode) + 1} / 365`;
    this.gallery();
  }
  private gallery(): void {
    this.observer?.disconnect();
    const grid = document.querySelector('#gallery-grid')!; grid.replaceChildren();
    const episodes = DAILY_EPISODES.filter(matches);
    document.querySelector('#gallery-count')!.textContent = `${episodes.length}件を表示 / 全365件`;
    this.observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const canvas = entry.target as HTMLCanvasElement; drawEventPreview(canvas, episodeById(canvas.dataset.episode!)!, roomSelect.value as RoomId); this.observer!.unobserve(canvas);
      }
    }, { rootMargin: '300px' });
    for (const episode of episodes) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-card'; button.dataset.episode = episode.id; button.setAttribute('aria-pressed', String(episode.id === episodeSelect.value));
      const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 128; canvas.dataset.episode = episode.id; canvas.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = `${DAILY_EPISODES.indexOf(episode) + 1} / 365 · ${episode.title}`;
      const description = document.createElement('small'); description.textContent = episode.discovery;
      button.append(canvas, text, description); grid.append(button); this.observer.observe(canvas);
      button.addEventListener('click', () => { episodeSelect.value = episode.id; this.refresh(); document.querySelector('#stage')!.scrollIntoView({ block: 'center' }); });
    }
  }
  update(): void {
    const now = Date.now(), reduced = document.querySelector<HTMLInputElement>('#reduce')!.checked;
    const hour = 3_600_000, day = 24 * hour, jstStart = Math.floor((now + 9 * hour) / day) * day - 9 * hour;
    const preview = lightSelect.value === 'now' ? now : jstStart + Number(lightSelect.value) * hour;
    this.view?.update(now, reduced); this.sky?.update(preview, reduced); this.lighting?.update(preview);
  }
}
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 480, height: 320, pixelArt: true, roundPixels: true, scene: Preview, audio: { noAudio: true }, banner: false });
