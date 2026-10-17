import type { DailyEventSnapshot } from './daily-events.ts';
import { episodeById } from './daily-event-catalog.ts';
import { outsideEventPixels } from './daily-event-art.ts';
import { tokyoBayPixels } from './tokyo-bay.ts';
import { lightingAt } from './lighting.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { weatherAt, WEATHER_LABELS, WINDOW_VIEW_HEIGHT, ROOFTOP_VIEW_HEIGHT } from './weather.ts';
import type { WeatherKind } from './weather.ts';

export class SkyWindowView {
  private canvas: HTMLCanvasElement;
  private roomId: RoomId = 'office';
  private key = '';
  private incident?: DailyEventSnapshot;
  private offset = 0;
  setDailyEvent(state: DailyEventSnapshot): void { this.incident = state; this.offset = state.serverNow - Date.now(); this.key = ''; this.tick = -1; }
  private tick = -1;
  private reduced?: boolean;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }
  setRoom(roomId: RoomId): void {
    this.roomId = roomId; this.key = ''; this.tick = -1;
    const outlook = getRoom(roomId).outlook;
    this.canvas.hidden = outlook === 'none'; this.canvas.dataset.outlook = outlook;
    this.canvas.width = 960; this.canvas.height = (outlook === 'open' ? ROOFTOP_VIEW_HEIGHT : WINDOW_VIEW_HEIGHT) * 2;
    if (this.canvas.parentElement?.classList.contains('window-wall')) {
      this.canvas.parentElement.hidden = outlook === 'none';
      this.canvas.parentElement.dataset.outlook = outlook;
    }
  }
  update(now: number, reducedMotion: boolean, previewWeather?: WeatherKind): void {
    const outlook = getRoom(this.roomId).outlook;
    if (outlook === 'none') return;
    const incident = this.incident?.event;
    const episode = incident && incident.roomId === this.roomId && now + this.offset < incident.endsAt ? episodeById(incident.episodeId) : undefined;
    const outside = episode?.theme === 'kaiju' ? episode : undefined;
    const elevated = outlook === 'open';
    const tick = Math.floor(now / 120);
    if (this.tick === tick && this.reduced === reducedMotion && !previewWeather) return;
    this.tick = tick; this.reduced = reducedMotion;
    const weather = previewWeather ?? weatherAt(now);
    const state = lightingAt(now, weather), { phase, time } = state;
    const key = `${outside ? outside.id + (reducedMotion ? 0 : Math.floor(now / 1400)) : ''}:${this.roomId}:${weather}:${reducedMotion}:${weather === 'clear' || reducedMotion ? Math.floor(now / 60_000) : tick}`;
    if (key === this.key) return;
    this.key = key;
    const ctx = this.canvas.getContext('2d')!;
    const w = 480, h = elevated ? ROOFTOP_VIEW_HEIGHT : WINDOW_VIEW_HEIGHT;
    ctx.setTransform(2,0,0,2,0,0); ctx.imageSmoothingEnabled = false;
    const rect = (color: string, x: number, y: number, width: number, height: number) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, width, height); };
    const night = phase === 'night';
    const sky = weather === 'clear'
      ? { morning: ['#b9d9e1', '#f3e5bd'], day: ['#86b9cf', '#c0dcd8'], evening: ['#b5839b', '#eeb28b'], night: ['#192b4a', '#3e5872'] }[phase]
      : night ? ['#1d2940', '#3c4b5b'] : ['#718794', '#b1b9b6'];
    ctx.clearRect(0, 0, w, h);
    // One continuous city view behind three wide panes.
    const horizon = elevated ? 22 : 30;
    rect(sky[0], 0, 0, w, horizon); rect(sky[1], 0, horizon, w, h - horizon);
    if (weather === 'clear') {
      const sunX = { morning: 86, day: 250, evening: 405, night: 95 }[phase];
      const sunY = (elevated ? { morning: 17, day: 9, evening: 19, night: 10 } : { morning: 25, day: 14, evening: 30, night: 14 })[phase];
      const radius = elevated ? (night ? 4 : 6) : night ? 5 : phase === 'day' ? 7 : 10;
      rect(night ? '#8fadc4' : phase === 'morning' ? '#f3d087' : phase === 'evening' ? '#f4af64' : '#f6ce85', sunX - radius - 2, sunY - 3, radius * 2 + 4, 6);
      rect(night ? '#e5e5cf' : '#fff0b1', sunX - radius, sunY - radius + 2, radius * 2, radius * 2 - 4);
      rect(night ? '#e5e5cf' : '#fff0b1', sunX - radius + 2, sunY - radius, radius * 2 - 4, radius * 2);
      if (night) rect(sky[0], sunX, sunY - 5, 5, 7);
      if (night) for (let i = 0; i < 26; i++) rect(i % 3 ? '#a5bccb' : '#f4dfb7', (i * 67 + 23) % w, 8 + (i * 7) % 19, 1, 1);
    }
    // Clouds and skyline are deliberately pixel rectangles, like the rest of the office.
    for (const [x, y] of [[28, 16], [176, 12], [323, 18]]) {
      rect(weather === 'clear' ? (night ? '#354962' : '#e9e5d5') : '#647786', x, y, 52, 4);
      rect(weather === 'clear' ? (night ? '#354962' : '#e9e5d5') : '#647786', x + 10, y - 4, 30, 5);
      if (weather !== 'clear') rect('#7f8e94', x - 17, y + 4, 92, 5);
    }
    for (let i = 0; i < 29; i++) {
      const height = (elevated ? 5 : 8) + (i * 13) % (elevated ? 10 : 19);
      rect(night ? '#34475f' : '#9caaa7', i * 18 - 4, (elevated ? 28 : 45) - height, 16, height);
    }
    for (let i = 0; i < 22; i++) {
      const x = i * 24 - 8, height = (elevated ? 5 : 8) + (i * 7) % (elevated ? 11 : 17), top = (elevated ? 30 : 46) - height;
      rect(night ? '#23354d' : weather === 'clear' ? '#728b91' : '#657b85', x, top, 19, height);
      rect(night ? '#536479' : '#adc0ba', x + 1, top, 17, 1);
      for (let column = 0; column < 3; column++) for (let row = 0; row < Math.floor((height - 3) / 5); row++) {
        rect(night && (i * 7 + column + row * 3) % 4 ? '#e2bd7c' : night ? '#4b5c71' : '#c2d1c8', x + 3 + column * 5, top + 3 + row * 5, 2, 2);
      }
    }
    for (const pixel of tokyoBayPixels(night, weather !== 'clear', elevated)) rect('#' + pixel.color.toString(16).padStart(6, '0'), pixel.x, pixel.y, pixel.w, pixel.h);
    if (outside) for (const pixel of outsideEventPixels(outside, w, h, reducedMotion ? 0 : Math.floor(now / 1400))) rect('#' + pixel.color.toString(16).padStart(6, '0'), pixel.x, pixel.y, pixel.w, pixel.h);
    this.canvas.dataset.dailyIncident = outside?.id ?? '';
    if (weather !== 'clear') {
      ctx.globalAlpha = night ? 0.4 : 0.6;
      for (let i = 0; i < (weather === 'storm' ? 85 : 45); i++) {
        const x = ((i * 53) + (reducedMotion ? 0 : tick * 2)) % w;
        const y = ((i * 17) + (reducedMotion ? 0 : tick * 5)) % h;
        rect('#d2e1e4', x, y, 1, 3 + i % 3);
      }
      ctx.globalAlpha = 1;
    }
    const thunderTime = (now % 37_000) / 1000;
    if (weather === 'storm' && (reducedMotion || (thunderTime >= 4 && thunderTime < 6))) {
      // A single slow, faint pulse confined to the windows. Reduced motion uses a still bolt.
      const intensity = reducedMotion ? 0.5 : Math.sin((thunderTime - 4) * Math.PI / 2);
      ctx.globalAlpha = intensity * 0.07; rect('#eef3e7', 0, 0, w, h); ctx.globalAlpha = intensity;
      rect('#e7e6c4', 360, 16, 3, 6); rect('#e7e6c4', 357, 21, 5, 3); rect('#e7e6c4', 358, 24, 2, 5);
      ctx.globalAlpha = 1;
    }
    const wall = '#' + getRoom(this.roomId).wall.toString(16).padStart(6, '0');
    if (!elevated) {
    rect('#79694f', 0, 0, w, 5); rect(wall, 0, 0, w, 3);
    for (const x of [0, 158, 316, 474]) {
      rect('#79694f', x, 0, 6, h); rect(wall, x, 0, 4, h);
    }
    rect('#79694f', 0, h - 5, w, 5); rect('#c4b48c', 0, h - 4, w, 2);
    for (const x of [79, 237, 395]) { rect('#8d8b77', x, 5, 2, h - 10); rect('#d4d7bd', x, 5, 1, h - 10); }
    ctx.globalAlpha = 0.14; for (const x of [10, 168, 326]) rect('#fff7df', x, 7, 2, 33); ctx.globalAlpha = 1;
    } else {
      rect('#6e8678', 0, h - 4, w, 4); rect('#d0d8b5', 0, h - 4, w, 2);
    }
    this.canvas.dataset.weather = weather; this.canvas.dataset.lightingPhase = phase; this.canvas.dataset.jstTime = time;
    const label = `${elevated ? '屋上から見下ろす東京湾' : '窓の外'}：お台場・レインボーブリッジ・東京タワー。${night ? '夜景' : phase === 'morning' ? '朝日' : phase === 'evening' ? '夕日' : '太陽'}・${WEATHER_LABELS[weather]}。${time} JST${outside ? `。今日の事件：${outside.title}` : ''}`;
    if (this.canvas.getAttribute('aria-label') !== label) this.canvas.setAttribute('aria-label', label);
  }
}
