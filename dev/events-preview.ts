import { EVENT_PROP_LABELS } from '../src/game/event-prop-labels.ts';
import { ART_WIDTH, ART_HEIGHT, configureArtCamera } from '../src/game/art-resolution.ts';
import Phaser from 'phaser';
import { DAILY_EPISODES, EVENT_THEMES, episodeById } from '../src/game/daily-event-catalog.ts';
import { drawEventPreview } from '../src/game/daily-event-art.ts';
import { dailyEventAt } from '../src/game/daily-events.ts';
import { DailyEventsView } from '../src/game/daily-events-view.ts';
import { SkyWindowView } from '../src/game/SkyWindowView.ts';
import { RoomLighting } from '../src/game/RoomLighting.ts';
import { drawOffice } from '../src/game/art.ts';
import { ROOMS } from '../src/game/rooms.ts';
import { ANCHOR_LABELS } from '../src/game/incident-script.ts';
import type { RoomId } from '../src/game/rooms.ts';
const specialCast: Record<string,string> = { meteor:'隕石・クレーター・瓦礫', thief:'泥棒・開いた金庫・書類・足跡', flood:'破裂した配管・流水・浮いた天板', aquarium:'水槽・泳ぐ魚', santa:'サンタクロース・そり・プレゼント', ghost:'捕獲隊員・捕獲装置・おばけ', waldo:'ウォーリー・人混み・赤い服', delorean:'デロリアン・ガルウィングドア・炎のタイヤ跡', terminator:'ターミネーター・マシンガン・弾痕・薬莢', momotaro:'桃太郎・大きな桃・のぼり旗', kaguya:'かぐや姫・竹林・髪飾り', alice:'アリス・巨大なティーカップ', oz:'ドロシー・竜巻・ルビーの靴', magic:'魔法使い・水晶の杖・魔法陣', festival:'屋台・ちょうちん・はっぴ・うちわ' };
const episodeCast = (episode: (typeof DAILY_EPISODES)[number]) => episode.id === 'delorean-13' ? '既存の会議机・卓上ヘリポート・ヘリコプター' : episode.scene.special ? specialCast[episode.scene.special] : episode.scene.props.map(p=>EVENT_PROP_LABELS[p]).join('・');
const episodeSelect = document.querySelector<HTMLSelectElement>('#episodes')!, roomSelect = document.querySelector<HTMLSelectElement>('#rooms')!;
const themeSelect = document.querySelector<HTMLSelectElement>('#themes')!;
const search = document.querySelector<HTMLInputElement>('#search')!;
const lightSelect = document.querySelector<HTMLSelectElement>('#light')!;
const matches = (e: (typeof DAILY_EPISODES)[number]) => (!themeSelect.value || e.theme === themeSelect.value) && (!roomFilter.value || e.direction.room === roomFilter.value) && (!approvedOnly.checked || e.direction.approved) && `${e.title} ${e.discovery}`.includes(search.value.trim());
for (const [id, name] of Object.entries(EVENT_THEMES)) themeSelect.add(new Option(name, id));
for (const [index, e] of DAILY_EPISODES.entries()) episodeSelect.add(new Option(`${String(index + 1).padStart(3, '0')} · ${e.title}`, e.id));
roomSelect.add(new Option('事件ごとの指定部屋', 'script'));
for (const room of ROOMS) roomSelect.add(new Option(room.name, room.id));
roomSelect.value = 'script';
const previewRoom=(episode:(typeof DAILY_EPISODES)[number]):RoomId=>roomSelect.value==='script'?episode.direction.room:roomSelect.value as RoomId;
const roomFilter=document.querySelector<HTMLSelectElement>('#room-filter')!;
for(const room of ROOMS)roomFilter.add(new Option(room.name,room.id));
const approvedOnly=document.querySelector<HTMLInputElement>('#approved-only')!;
class Preview extends Phaser.Scene {
  private view?: DailyEventsView;
  private sky?: SkyWindowView;
  private lighting?: RoomLighting;
  private furniture: Phaser.GameObjects.GameObject[] = [];
  private observer?: IntersectionObserver;
  create(): void {
    configureArtCamera(this);
    this.view = new DailyEventsView(this, () => { document.querySelector('#notice')!.textContent = episodeById(episodeSelect.value)!.discovery; });
    this.sky = new SkyWindowView(document.querySelector<HTMLCanvasElement>('#sky-window')!);
    this.lighting = new RoomLighting(this);
    this.refresh();
    roomFilter.addEventListener('change',()=>this.filter()); approvedOnly.addEventListener('change',()=>this.filter());
    search.addEventListener('input', () => this.filter());
    episodeSelect.addEventListener('change', () => this.refresh()); roomSelect.addEventListener('change', () => this.refresh());
    for (const [id, delta] of [['previous', -1], ['next', 1]] as const) document.querySelector(`#${id}`)!.addEventListener('click', () => {
      const episodes = DAILY_EPISODES.filter(matches), index = episodes.findIndex(e => e.id === episodeSelect.value);
      if (!episodes.length) return;
      episodeSelect.value = episodes[(index + delta + episodes.length) % episodes.length].id; this.refresh();
    });
    themeSelect.addEventListener('change', () => this.filter());
    for (const [id, label] of [['thief-02','ルパン × ひだまり'],['momotaro-01','桃太郎 × 食堂'],['comic-02','悟空 × 食堂'],['urashima-02','インディ × 図書室'],['terminator-08','マトリックス × 案件部屋'],['ghost-01','捕獲隊 × 図書室'],['kaiju-07','ラピュタ × 窓の外'],['delorean-13','残す：卓上ヘリポート']]) {
      const button = document.createElement('button'); button.textContent = label; button.addEventListener('click', () => { themeSelect.value = '';roomFilter.value='';approvedOnly.checked=false;roomSelect.value='script'; search.value = ''; episodeSelect.value = id; this.filter(); }); document.querySelector('#examples')!.append(button);
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
    const episode = episodeById(episodeSelect.value)!, room = previewRoom(episode);
    for (const item of this.furniture) item.destroy(); this.furniture = drawOffice(this, room); this.view!.setDecorations(this.furniture);
    const state = { event: { ...dailyEventAt(Date.now()), episodeId: episode.id, roomId: room }, serverNow: Date.now() };
    this.view!.setRoom(room); this.view!.setObjects([]); this.view!.receive(state); this.sky!.setRoom(room); this.sky!.setDailyEvent(state); this.lighting!.setRoom(room);
    document.querySelector('#title')!.textContent = episode.title; document.querySelector('#theme')!.textContent = EVENT_THEMES[episode.theme]; document.querySelector('#story')!.textContent = `舞台：${ROOMS.find(r=>r.id===room)!.name}\n使う場所：${ANCHOR_LABELS[episode.direction.anchor]}\n\n${episode.discovery}\n\n登場する小道具：${episodeCast(episode)}`;
    document.querySelector('#notice')!.textContent = room !== episode.direction.room ? '別の部屋へ切り替えた確認表示です。実際には、事件ごとの指定部屋で発生します。' : 'この部屋の既存の家具を使った演出です。来客・小物をクリックすると事情が分かります。';
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
      for (const entry of entries) {
        const canvas = entry.target as HTMLCanvasElement;
        if (entry.isIntersecting) drawEventPreview(canvas, episodeById(canvas.dataset.episode!)!, previewRoom(episodeById(canvas.dataset.episode!)!), 384);
        // Keep only visible/nearby thumbnails allocated, even after viewing all 365.
        else { canvas.width = 3; canvas.height = 2; }
      }
    }, { rootMargin: '300px' });
    for (const episode of episodes) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'gallery-card'; button.dataset.episode = episode.id; button.setAttribute('aria-pressed', String(episode.id === episodeSelect.value));
      const canvas = document.createElement('canvas'); canvas.width = 3; canvas.height = 2; canvas.dataset.episode = episode.id; canvas.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span'); text.textContent = `${DAILY_EPISODES.indexOf(episode) + 1} / 365 · ${episode.title}`;
      const place=document.createElement('strong');place.className='gallery-room';place.textContent=ROOMS.find(r=>r.id===episode.direction.room)!.name+' · '+ANCHOR_LABELS[episode.direction.anchor]+(episode.direction.approved?' · 残す9件':'');
      const description = document.createElement('small'); description.textContent = episode.discovery;
      button.append(canvas, text, place, description); grid.append(button); this.observer.observe(canvas);
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
new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: ART_WIDTH, height: ART_HEIGHT, pixelArt: true, roundPixels: true, scene: Preview, audio: { noAudio: true }, banner: false });
