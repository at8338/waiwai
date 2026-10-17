import { WEATHER_LABELS } from './weather.ts';
import type { WeatherKind } from './weather.ts';
import Phaser from 'phaser';
import { lightingAt, LIGHTING_LABELS, roomLights, WINDOW_COLUMNS } from './lighting.ts';
import type { RoomId } from './rooms.ts';
import type { RoomObject } from './objects.ts';
import { COLS, ROWS, TILE } from './world.ts';

// Four reusable graphics layers; no dynamic GPU lights, textures or per-avatar work.
export class RoomLighting {
  private roomId: RoomId = 'office';
  private objects: readonly RoomObject[] = [];
  private key = '';
  private sunlight: Phaser.GameObjects.Graphics;
  private shade: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private sources: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.sunlight = scene.add.graphics().setDepth(-85);
    this.shade = scene.add.graphics().setDepth(ROWS * TILE + 5);
    this.glow = scene.add.graphics().setDepth(ROWS * TILE + 6).setBlendMode(Phaser.BlendModes.ADD);
    this.sources = scene.add.graphics().setDepth(ROWS * TILE + 7);
  }
  setRoom(roomId: RoomId): void { this.roomId = roomId; this.objects = []; this.key = ''; }
  setObjects(objects: readonly RoomObject[]): void { this.objects = objects; this.key = ''; }
  update(now: number, weather?: WeatherKind): void {
    const key = `${Math.floor(now / 60_000)}:${weather ?? ''}`;
    if (this.key === key) return;
    this.key = key;
    const { phase, time, weather: outside, palette: p } = lightingAt(now, weather);
    this.sunlight.clear(); this.shade.clear(); this.glow.clear(); this.sources.clear();
    this.shade.fillStyle(p.tint, p.shade).fillRect(0, 0, COLS * TILE, ROWS * TILE);
    for (const start of [3, 7, 14, 24]) {
      const min = this.roomId !== 'office' ? TILE : (start < 10 ? 1 : start < 20 ? 11 : 21) * TILE;
      const max = this.roomId !== 'office' ? (COLS - 1) * TILE : (start < 10 ? 10 : start < 20 ? 20 : 29) * TILE;
      const clamp = (x: number) => Phaser.Math.Clamp(x, min, max);
      const length = this.roomId === 'office' ? 132 : 185;
      for (let band = 0; band < 6; band++) {
        const from = band / 6, to = (band + 1) / 6;
        this.sunlight.fillStyle(p.sunColor, p.sun * (1 - from) * (this.roomId === 'garden' ? 0.45 : 1)).fillPoints([
          new Phaser.Geom.Point(clamp(start * TILE + from * p.slant), TILE + from * length),
          new Phaser.Geom.Point(clamp((start + 2) * TILE + from * (p.slant + 22)), TILE + from * length),
          new Phaser.Geom.Point(clamp((start + 2) * TILE + to * (p.slant + 22)), TILE + to * length),
          new Phaser.Geom.Point(clamp(start * TILE + to * p.slant), TILE + to * length),
        ], true);
      }
    }
    for (const x of WINDOW_COLUMNS) {
      this.sources.fillStyle(p.glass).fillRect(x * TILE + 2, 3, 12, 7);
      this.sources.fillStyle(0xf7e9c4, 0.4).fillRect(x * TILE + 3, 3, 1, 6);
      if (phase === 'night') this.sources.fillStyle(0xd8e7df, 0.75).fillRect(x * TILE + (x % 2 ? 7 : 10), 4, 1, 1);
    }
    for (const light of roomLights(this.roomId, this.objects)) {
      const strength = light.kind === 'screen' ? 0.07 + p.lamps * 0.65 : p.lamps;
      for (let ring = 12; ring > 0; ring--) {
        const radius = light.radius * ring / 12;
        this.glow.fillStyle(light.color, (1 - ring / 13) * 0.035 * strength).fillEllipse(light.x, light.y + 14, radius * 2, radius * 1.4);
      }
      if (light.kind === 'sconce' || light.kind === 'lantern') {
        const y = light.y, x = light.x;
        this.sources.fillStyle(0x58645b).fillRect(x - 4, y - 4, 8, 7);
        this.sources.fillStyle(0x6a6354).fillRect(x - 5, y - 5, 10, 2);
        this.sources.fillStyle(p.lamps > 0.2 ? light.color : 0xc8c5a7).fillRect(x - 3, y - 3, 6, 4);
        this.sources.fillStyle(light.color, p.lamps * 0.7).fillRect(x - 4, y + 3, 8, 1);
        if (light.kind === 'lantern') this.sources.fillStyle(0x58645b).fillRect(x - 1, y + 3, 2, 6);
      } else if (light.kind === 'lamp') this.sources.fillStyle(light.color, p.lamps * 0.6).fillRect(light.x - 4, light.y - 1, 8, 3);
    }
    const canvas = this.scene.game.canvas;
    canvas.dataset.lightingPhase = phase; canvas.dataset.jstTime = time; canvas.dataset.weather = outside;
    const label = document.querySelector<HTMLElement>('#lighting-status');
    if (label) { label.textContent = `${phase === 'night' ? '☾' : '☀'} ${LIGHTING_LABELS[phase]} · ${WEATHER_LABELS[outside]} · ${time} JST`; label.title = '日本時間に合わせて照明が自動で切り替わります'; }
  }
  destroy(): void { this.sunlight.destroy(); this.shade.destroy(); this.glow.destroy(); this.sources.destroy(); }
}
