import Phaser from 'phaser';
import { DAILY_EPISODES, EVENT_THEMES, episodeById } from '../src/game/daily-event-catalog.ts';
import { drawEventPreview } from '../src/game/daily-event-art.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
import { DailyEventsView } from '../src/game/daily-events-view.ts';
import { SkyWindowView } from '../src/game/SkyWindowView.ts';
import { RoomLighting } from '../src/game/RoomLighting.ts';
import { drawOffice } from '../src/game/art.ts';
import { ROOMS } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
const episodeSelect = document.querySelector<HTMLSelectElement>('#episodes')!, roomSelect = document.querySelector<HTMLSelectElement>('#rooms')!;
for (const e of DAILY_EPISODES) episodeSelect.add(new Option(`${e.id} · ${e.title}`, e.id));
for (const room of ROOMS) roomSelect.add(new Option(room.name, room.id));
roomSelect.value = 'meeting';
class Preview extends Phaser.Scene {
  private view?: DailyEventsView;
  private sky?: SkyWindowView;
  private lighting?: RoomLighting;
  private furniture: Phaser.GameObjects.GameObject[] = [];
  create(): void {
    this.view = new DailyEventsView(this, () => { document.querySelector('#notice')!.textContent = episodeById(episodeSelect.value)!.discovery; });
    this.sky = new SkyWindowView(document.querySelector<HTMLCanvasElement>('#sky-window')!);
    this.lighting = new RoomLighting(this);
    this.refresh();
    episodeSelect.addEventListener('change', () => this.refresh()); roomSelect.addEventListener('change', () => this.refresh());
    for (const [id, label] of [['meteor-01', '隕石'], ['flood-01', '水びたし'], ['santa-01', 'サンタ'], ['ghost-01', 'ゴーストバスターズ'], ['waldo-01', 'ウォーリー'], ['delorean-01', 'デロリアン'], ['terminator-01', 'ターミネーター'], ['kaiju-01', 'ゴジラ']]) {
      const button = document.createElement('button'); button.textContent = label; button.addEventListener('click', () => { episodeSelect.value = id; this.refresh(); }); document.querySelector('#examples')!.append(button);
    }
  }
  private refresh(): void {
    const episode = episodeById(episodeSelect.value)!, room = roomSelect.value as RoomId;
    for (const item of this.furniture) item.destroy(); this.furniture = drawOffice(this, room);
    const state = { event: { ...dailyEventAt(Date.now()), episodeId: episode.id, roomId: room }, serverNow: Date.now() };
    this.view!.setRoom(room); this.view!.setObjects([]); this.view!.receive(state); this.sky!.setRoom(room); this.sky!.setDailyEvent(state); this.lighting!.setRoom(room);
    document.querySelector('#title')!.textContent = episode.title; document.querySelector('#theme')!.textContent = EVENT_THEMES[episode.theme]; document.querySelector('#story')!.textContent = episode.discovery;
    document.querySelector('#notice')!.textContent = episode.theme === 'kaiju' && room === 'ops' ? 'この部屋には窓がないので、窓の外の来客は見えません。実際の抽選では管制室は対象外です。' : '来客にクリックすると、この事件の事情が分かります。';
    drawEventPreview(document.querySelector<HTMLCanvasElement>('#illustration')!, episode);
  }
  update(): void { const now = Date.now(), reduced = document.querySelector<HTMLInputElement>('#reduce')!.checked; this.view?.update(now, reduced); this.sky?.update(now, reduced); this.lighting?.update(now); }
}
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 480, height: 320, pixelArt: true, roundPixels: true, scene: Preview, audio: { noAudio: true }, banner: false });
