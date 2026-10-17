import Phaser from 'phaser';
import { eventSpot } from './daily-events.ts';
import type { DailyEventSnapshot } from './daily-events.ts';
import { episodeById } from './daily-event-catalog.ts';
import { eventPixels } from './daily-event-art.ts';
import { walkableWithObjects } from './objects.ts';
import type { RoomObject } from './objects.ts';
import type { RoomId } from './rooms.ts';
import { TILE } from './world.ts';
export class DailyEventsView {
  private room: RoomId = 'office';
  private objects: readonly RoomObject[] = [];
  private state?: DailyEventSnapshot;
  private offset = 0;
  private ready = false;
  private key = '';
  private spot?: { x: number; y: number };
  private art: Phaser.GameObjects.Graphics;
  private floor: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  constructor(private scene: Phaser.Scene, inspect: () => void) {
    this.floor = scene.add.graphics().setDepth(-75);
    this.art = scene.add.graphics().setScale(2 / 3);
    this.art.setInteractive(new Phaser.Geom.Rectangle(0, 0, 48, 48), Phaser.Geom.Rectangle.Contains).on('pointerup', inspect);
    this.label = scene.add.text(0, 0, '✦ 今日の事件', { fontFamily: 'sans-serif', fontSize: '8px', color: '#54452d', backgroundColor: '#f6d88f', padding: { x: 3, y: 2 } }).setOrigin(0.5, 1).setResolution(2);
    this.hide();
  }
  setRoom(room: RoomId): void { this.room = room; this.objects = []; this.ready = false; this.key = ''; this.hide(); }
  setObjects(objects: readonly RoomObject[]): void { this.objects = objects; this.ready = true; this.key = ''; this.reposition(); }
  receive(state: DailyEventSnapshot): void { this.state = state; this.offset = state.serverNow - Date.now(); this.key = ''; this.reposition(); }
  private reposition(): void { this.spot = this.state && this.ready ? eventSpot(this.state.event, this.objects) : undefined; }
  private hide(): void { this.art.setVisible(false); this.label.setVisible(false); this.floor.clear(); }
  update(now: number, reducedMotion: boolean): void {
    const event = this.state?.event, serverNow = now + this.offset;
    if (!event || !this.ready || event.roomId !== this.room || serverNow >= event.endsAt) { this.hide(); this.scene.game.canvas.dataset.dailyIncident = ''; return; }
    const key = `${event.day}:${event.episodeId}:${reducedMotion ? 0 : Math.floor(serverNow / 700)}`; if (key === this.key) return;
    this.key = key;
    const spot = this.spot, episode = episodeById(event.episodeId)!;
    if (!spot) { this.hide(); return; } // The banner remains inspectable even in a densely furnished room.
    const x = (spot.x + 0.5) * TILE, y = (spot.y + 0.5) * TILE;
    this.art.clear().setVisible(true).setPosition(x - 16, y - 24).setDepth(y + 7);
    for (const p of eventPixels(episode, Math.floor(serverNow / 700))) this.art.fillStyle(p.color).fillRect(p.x, p.y, p.w, p.h);
    this.label.setVisible(true).setPosition(x, y - 27).setDepth(y + 8);
    this.floor.clear();
    if (episode.theme === 'flood') {
      for (let ty = 1; ty < 19; ty++) for (let tx = 1; tx < 29; tx++) if (walkableWithObjects(tx, ty, this.room, this.objects)) {
        this.floor.fillStyle(0x4fa8bf, 0.24).fillRect(tx * TILE, ty * TILE, TILE, TILE);
        if ((tx * 3 + ty + episode.variant) % 4 === 0) this.floor.fillStyle(0xe2f2e8, 0.6).fillRect(tx * TILE + 2, ty * TILE + 4 + (reducedMotion ? 0 : Math.floor(serverNow / 700) % 3), 9, 1);
      }
    } else {
      this.floor.fillStyle(episode.theme === 'meteor' ? 0x5b5859 : 0x967d58, 0.25).fillEllipse(x, y + 5, episode.theme === 'meteor' ? 46 : 32, 11);
      this.floor.lineStyle(1, 0xf7dc99, 0.8).strokeEllipse(x, y + 5, 41, 16);
    }
    this.scene.game.canvas.dataset.dailyIncident = JSON.stringify({ id: event.episodeId, roomId: this.room, x: spot.x, y: spot.y });
  }
  destroy(): void { this.art.destroy(); this.label.destroy(); this.floor.destroy(); }
}
