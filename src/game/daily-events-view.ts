import Phaser from 'phaser';
import type { DailyEventSnapshot } from './daily-events.ts';
import { episodeById } from './daily-event-catalog.ts';
import { eventPixels } from './daily-event-art.ts';
import { roomEventStage, damageContains } from './daily-event-stage.ts';
import type { DamageShape } from './daily-event-stage.ts';
import type { StagePixel } from './daily-event-stage.ts';
import type { RoomObject } from './objects.ts';
import type { RoomId } from './rooms.ts';
type MaskedView = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Mask;
export class DailyEventsView {
  private room: RoomId = 'office';
  private objects: readonly RoomObject[] = [];
  private state?: DailyEventSnapshot;
  private offset = 0;
  private ready = false;
  private key = '';
  private staticKey = '';
  private active = false;
  private decorations: MaskedView[] = [];
  private damageZones: DamageShape[] = [];
  private inspectAreas: DamageShape[] = [];
  private art: Phaser.GameObjects.Graphics;
  private floor: Phaser.GameObjects.Graphics;
  private scenery: Phaser.GameObjects.Graphics;
  private effects: Phaser.GameObjects.Graphics;
  private damageShape: Phaser.GameObjects.Graphics;
  private damageMask: Phaser.Display.Masks.GeometryMask;
  private label: Phaser.GameObjects.Text;
  constructor(private scene: Phaser.Scene, inspect: () => void) {
    this.floor = scene.add.graphics().setDepth(-74);
    this.scenery = scene.add.graphics().setDepth(210);
    this.scenery.setInteractive(new Phaser.Geom.Rectangle(0, 0, 480, 320), (_area: unknown, x: number, y: number) => [...this.damageZones, ...this.inspectAreas].some(shape => damageContains(shape, x, y))).on('pointerup', inspect);
    this.effects = scene.add.graphics().setDepth(330);
    this.art = scene.add.graphics();
    this.art.setInteractive(new Phaser.Geom.Rectangle(0, 0, 48, 48), Phaser.Geom.Rectangle.Contains).on('pointerup', inspect);
    this.damageShape = scene.make.graphics({ x: 0, y: 0 });
    this.damageMask = this.damageShape.createGeometryMask(); this.damageMask.invertAlpha = true;
    this.label = scene.add.text(240, 280, '✦ 今日の事件 · クリックで調べる', { fontFamily: 'sans-serif', fontSize: '8px', color: '#fff1ce', backgroundColor: '#694f47', padding: { x: 5, y: 3 } }).setOrigin(.5, 1).setResolution(2).setDepth(331).setInteractive({ useHandCursor: true }).on('pointerup', inspect);
    this.hide();
  }
  setDecorations(views: Phaser.GameObjects.GameObject[]): void {
    this.clearMasks(); this.decorations = views.filter(view => typeof (view as MaskedView).setMask === 'function') as MaskedView[];
    this.staticKey = ''; this.key = '';
  }
  setRoom(room: RoomId): void { this.hide(); this.room = room; this.objects = []; this.ready = false; this.key = ''; this.staticKey = ''; }
  setObjects(objects: readonly RoomObject[]): void { this.objects = objects; this.ready = true; this.key = ''; this.staticKey = ''; }
  receive(state: DailyEventSnapshot): void { this.state = state; this.offset = state.serverNow - Date.now(); this.key = ''; this.staticKey = ''; }
  private clearMasks(): void { for (const view of this.decorations) if (view.scene && view.mask === this.damageMask) view.clearMask(); }
  private hide(): void {
    this.art.setVisible(false); this.label.setVisible(false); this.floor.clear(); this.scenery.clear(); this.effects.clear();
    this.damageZones = []; this.inspectAreas = [];
    if (this.active) this.clearMasks(); this.active = false; this.staticKey = ''; this.key = '';
  }
  private draw(graphics: Phaser.GameObjects.Graphics, pixels: StagePixel[]): void {
    graphics.clear(); for (const p of pixels) graphics.fillStyle(p.color, p.alpha).fillRect(p.x, p.y, p.w, p.h);
  }
  update(now: number, reducedMotion: boolean): void {
    const event = this.state?.event, serverNow = now + this.offset;
    if (!event || !this.ready || event.roomId !== this.room || serverNow >= event.endsAt) { this.hide(); this.scene.game.canvas.dataset.dailyIncident = ''; return; }
    const frame = reducedMotion ? -1 : Math.floor(serverNow / 700), key = `${event.day}:${event.episodeId}:${frame}`;
    if (key === this.key) return; this.key = key;
    const episode = episodeById(event.episodeId)!, stage = roomEventStage(episode, this.room, this.objects, frame);
    const staticKey = `${this.room}:${event.day}:${event.episodeId}`;
    if (this.staticKey !== staticKey) {
      this.staticKey = staticKey; this.active = true; this.damageZones = stage.damage; this.inspectAreas = stage.inspectAreas ?? []; this.damageShape.clear().fillStyle(0xffffff);
      for (const shape of stage.damage) {
        if (shape.kind === 'ellipse') this.damageShape.fillEllipse(shape.x, shape.y, shape.w, shape.h);
        else this.damageShape.fillRect(shape.x, shape.y, shape.w, shape.h);
      }
      this.clearMasks();
      if (stage.damage.length) for (const view of this.decorations) if (view.scene) view.setMask(this.damageMask);
      this.draw(this.floor, stage.floor); this.draw(this.scenery, stage.scenery);
      this.art.input!.hitArea = new Phaser.Geom.Rectangle(stage.hero.x, stage.hero.y, 48 * stage.hero.scale, 48 * stage.hero.scale);
    }
    this.art.clear().setVisible(stage.hero.scale > 0).setDepth(stage.hero.y + 43 * stage.hero.scale);
    for (const p of eventPixels(episode, Math.max(0, frame))) this.art.fillStyle(p.color).fillRect(stage.hero.x + p.x * stage.hero.scale, stage.hero.y + p.y * stage.hero.scale, p.w * stage.hero.scale, p.h * stage.hero.scale);
    this.draw(this.effects, stage.effects); this.label.setVisible(true);
    this.scene.game.canvas.dataset.dailyIncident = JSON.stringify({ id: event.episodeId, roomId: this.room, x: Math.floor((stage.hero.x + 24 * stage.hero.scale) / 16), y: Math.floor((stage.hero.y + 24 * stage.hero.scale) / 16), scale: stage.hero.scale, damage: stage.damage, roomWide: true });
  }
  destroy(): void { this.clearMasks(); this.damageMask.destroy(); this.damageShape.destroy(); this.art.destroy(); this.label.destroy(); this.floor.destroy(); this.scenery.destroy(); this.effects.destroy(); }
}
