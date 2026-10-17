import Phaser from 'phaser';
import { LOST_ITEM_CATALOG, LOST_ITEM_PERIOD_MS, lostItemsAt, lostItemPixels } from './lost-items.ts';
import type { LostItem } from './lost-items.ts';
import type { RoomId } from './rooms.ts';
import type { RoomObject } from './objects.ts';
import { TILE } from './world.ts';
export class LostItemsView {
  private room: RoomId = 'office';
  private objects: readonly RoomObject[] = [];
  private items: LostItem[] = [];
  private views: Phaser.GameObjects.Graphics[] = [];
  private epoch = -1;
  constructor(private scene: Phaser.Scene, signal: AbortSignal, private inspect: (item: LostItem) => void) {
    document.querySelector('#lost-item-list')!.addEventListener('click', (event) => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-lost-id]')?.dataset.lostId;
      const item = this.items.find((i) => i.id === id); if (item) this.open(item);
    }, { signal });
  }
  setRoom(room: RoomId): void { this.room = room; this.objects = []; this.epoch = -1; this.clear(); }
  setObjects(objects: readonly RoomObject[]): void { this.objects = objects; this.epoch = -1; this.update(Date.now()); }
  update(now: number): void {
    const epoch = Math.floor(now / LOST_ITEM_PERIOD_MS); if (this.epoch === epoch) return;
    this.epoch = epoch; this.clear(); this.items = lostItemsAt(this.room, now, this.objects);
    const list = document.querySelector('#lost-item-list')!;
    for (const item of this.items) {
      const g = this.scene.add.graphics().setPosition((item.x + 0.5) * TILE, (item.y + 0.5) * TILE).setDepth(-20);
      g.fillStyle(0x5c604f, 0.15).fillRect(-5, 4, 11, 3);
      for (const p of lostItemPixels(item.kind)) g.fillStyle(p.color).fillRect(p.x - 8, p.y - 8, p.w, p.h);
      g.setInteractive(new Phaser.Geom.Rectangle(-8, -8, TILE, TILE), Phaser.Geom.Rectangle.Contains).on('pointerup', () => this.open(item));
      this.views.push(g);
      const li = document.createElement('li'), button = document.createElement('button');
      button.type = 'button'; button.dataset.lostId = item.id; button.textContent = LOST_ITEM_CATALOG[item.kind].name;
      li.append(button); list.append(li);
    }
  }
  private open(item: LostItem): void { this.inspect(item); }
  private clear(): void { for (const view of this.views) view.destroy(); this.views = []; this.items = []; document.querySelector('#lost-item-list')?.replaceChildren(); }
  destroy(): void { this.clear(); }
}
