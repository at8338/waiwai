import { movementStep } from './transport.ts';
import Phaser from 'phaser';
import { BUDDIES, buddyMapPixels, buddyMapSize, PET_STEP_MS } from './buddies.ts';
import type { BuddyKind, BuddyPosition, RoomPet } from './buddies.ts';
import type { Player } from '../network/protocol.ts';
import type { RoomId } from './rooms.ts';
import { getRoom } from './rooms.ts';
import { companionLayout } from './companion-layout.ts';
import { Walker } from './world.ts';

type View = { sprite: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Ellipse; walker: Walker; kind: BuddyKind; owner: string };
export class CompanionsView {
  private scene: Phaser.Scene;
  private room: RoomId = 'office';
  private views = new Map<string, View>();
  private textures = new Set<string>();
  constructor(scene: Phaser.Scene, click: (kind: BuddyKind, owner: string) => void) { this.scene = scene; this.click = click; }
  private click: (kind: BuddyKind, owner: string) => void;
  setRoom(room: RoomId, publish = true): void { this.clear(); this.room = room; if (publish) this.scene.game.canvas.dataset.roomPets = '[]'; }
  clear(): void { for (const id of this.views.keys()) this.remove(id); }
  remove(id: string): void { const view = this.views.get(id); view?.sprite.destroy(); view?.shadow.destroy(); this.views.delete(id); }
  player(player: Player, snap: boolean): void {
    if (player.roomId !== this.room || !player.buddy || !player.buddyPosition) { this.remove(player.id); return; }
    this.receive(player.id, player.buddy, player.buddyPosition, `${player.name}さんのバディ`, snap, false, movementStep(player.riding?.kind));
  }
  pets(room: RoomId, pets: RoomPet[], publish = true): void {
    if (room !== this.room) return;
    const live = new Set(pets.map((p) => p.id));
    for (const id of this.views.keys()) if (id.startsWith('pet:') && !live.has(id)) this.remove(id);
    for (const pet of pets) this.receive(pet.id, pet.kind, pet, `${getRoom(room).name}を散歩中 · 館内に1体の${BUDDIES[pet.kind].name}`, false, true);
    if (publish) this.scene.game.canvas.dataset.roomPets = JSON.stringify(pets);
  }
  private receive(id: string, kind: BuddyKind, position: BuddyPosition, owner: string, snap: boolean, pet: boolean, stepMs?: number): void {
    let view = this.views.get(id);
    if (!view) {
      const sprite = this.scene.add.image(0, 0, this.texture(kind, position.facing, 0)).setOrigin(0.5, 1).setInteractive({ useHandCursor: true, pixelPerfect: true, alphaTolerance: 32 });
      view = { sprite, shadow: this.scene.add.ellipse(0, 0, 10, 4, 0x384a3d, 0.16), walker: new Walker(pet ? PET_STEP_MS : stepMs), kind, owner };
      const created = view;
      sprite.on('pointerup', () => this.click(created.kind, created.owner));
      this.views.set(id, view); snap = true;
    }
    if (stepMs) view.walker.setStepMs(stepMs);
    view.kind = kind; view.owner = owner; view.walker.receive(position, position.facing, snap);
  }
  private texture(kind: BuddyKind, direction: BuddyPosition['facing'], frame: number): string {
    const key = `buddy:${kind}:${direction}:${frame}`;
    if (!this.scene.textures.exists(key)) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 });
      for (const p of buddyMapPixels(kind, direction, frame)) graphics.fillStyle(p.color).fillRect(p.x, p.y, p.w, p.h);
      const { width, height } = buddyMapSize(kind);
      graphics.generateTexture(key, width, height); graphics.destroy();
    }
    this.textures.delete(key); this.textures.add(key);
    if (this.textures.size > 512) {
      const active = new Set([...this.views.values()].map(v => v.sprite.texture.key));
      for (const old of this.textures) {
        if (old === key || active.has(old)) continue;
        this.scene.textures.remove(old); this.textures.delete(old);
        if (this.textures.size <= 512) break;
      }
    }
    return key;
  }
  update(time: number, delta: number, reducedMotion: boolean): void {
    for (const view of this.views.values()) {
      view.walker.update(delta);
      const point = view.walker.position();
      const frame = view.walker.moving && !reducedMotion ? 1 + (Math.floor(time / 130) % 2) : 0;
      const float = BUDDIES[view.kind].floating ? 3 + (reducedMotion ? 0 : Math.sin(time / 300) * 1.5) : 0;
      const layout = companionLayout(view.kind, point, float);
      view.sprite.setTexture(this.texture(view.kind, view.walker.facing, frame)).setPosition(layout.x, layout.y).setDepth(layout.depth);
      view.shadow.setSize(layout.shadowWidth, layout.shadowHeight).setPosition(layout.x, layout.floor - 1).setDepth(layout.depth - 1.1);
    }
  }
}
