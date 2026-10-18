import { mapTap } from './map-tap.ts';
import Phaser from 'phaser';
import { LOST_ITEM_CATALOG, lostItemPixels } from './lost-items.ts';
import type { LostItem, LostItemsSnapshot } from './lost-items.ts';
import type { RoomId } from './rooms.ts';
import { TILE } from './world.ts';
export class LostItemsView {
  private room: RoomId = 'office';
  private items: LostItem[] = [];
  private snapshot?: LostItemsSnapshot;
  private offset = 0;
  private views: Phaser.GameObjects.Graphics[] = [];
  constructor(private scene: Phaser.Scene, signal: AbortSignal, private inspect: (item: LostItem) => void) {
    document.querySelector('#lost-item-list')!.addEventListener('click', (event) => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-lost-id]')?.dataset.lostId;
      const item = this.items.find((i) => i.id === id); if (item) this.open(item);
    }, { signal });
    this.render();
  }
  setRoom(room: RoomId): void { this.room = room; this.render(); }
  setConnected(connected: boolean): void { if (!connected) { this.snapshot = undefined; this.render(); } }
  receive(snapshot: LostItemsSnapshot): void { this.snapshot = snapshot; this.offset = snapshot.serverNow - Date.now(); this.render(); }
  update(now: number): void { if (this.snapshot && now + this.offset >= this.snapshot.expiresAt) { this.snapshot = undefined; this.render(); } }
  private render(): void {
    this.clear(); this.items = this.snapshot?.items.filter((i) => i.roomId === this.room) ?? [];
    this.scene.game.canvas.dataset.lostItemCount = String(this.items.length);
    const list = document.querySelector('#lost-item-list')!;
    if (!this.items.length) { const li = document.createElement('li'); li.textContent = this.snapshot ? 'この部屋に落とし物はありません。館内のどこかに、最大3個だけ。' : '落とし物の情報を確認しています。'; list.append(li); }
    for (const item of this.items) {
      const g = this.scene.add.graphics().setPosition((item.x + 0.5) * TILE, (item.y + 0.5) * TILE).setDepth(-20);
      g.fillStyle(0x5c604f, 0.15).fillRect(-5, 4, 11, 3);
      for (const p of lostItemPixels(item.kind)) g.fillStyle(p.color).fillRect(p.x - 8, p.y - 8, p.w, p.h);
      g.setInteractive(new Phaser.Geom.Rectangle(-8, -8, TILE, TILE), Phaser.Geom.Rectangle.Contains).on('pointerup', mapTap(() => this.open(item)));
      this.views.push(g);
      const li = document.createElement('li'), button = document.createElement('button');
      button.type = 'button'; button.dataset.lostId = item.id; button.textContent = LOST_ITEM_CATALOG[item.kind].name;
      li.append(button); list.append(li);
    }
  }
  private open(item: LostItem): void { if (this.items.includes(item)) this.inspect(item); }
  private clear(): void { for (const view of this.views) view.destroy(); this.views = []; this.items = []; document.querySelector('#lost-item-list')?.replaceChildren(); }
  destroy(): void { this.clear(); }
}
