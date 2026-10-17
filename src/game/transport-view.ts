import Phaser from 'phaser';
import { VEHICLES, VEHICLE_DOCKS } from './transport.ts';
import type { VehicleKind, VehicleUnit } from './transport.ts';
import type { Direction } from './world.ts';
import type { RoomId } from './rooms.ts';
import { TILE, ROWS } from './world.ts';
import { vehiclePixels } from './vehicle-art.ts';
export function vehicleTexture(scene: Phaser.Scene, kind: VehicleKind, direction: Direction, frame: number): string {
  const key = `vehicle:${kind}:${direction}:${frame}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 });
    for (const p of vehiclePixels(kind, direction, frame)) g.fillStyle(p.color).fillRect(p.x, p.y, p.w, p.h);
    g.generateTexture(key, 32, 20); g.destroy();
  }
  return key;
}
export class VehicleDocksView {
  private scene: Phaser.Scene;
  private open: () => void;
  private units: VehicleUnit[] = [];
  private room: RoomId = 'office';
  private views: Phaser.GameObjects.GameObject[] = [];
  constructor(scene: Phaser.Scene, open: () => void) { this.scene = scene; this.open = open; }
  setRoom(room: RoomId): void { this.room = room; this.draw(); }
  receive(units: VehicleUnit[]): void { this.units = units; this.draw(); }
  destroy(): void { for (const view of this.views) view.destroy(); this.views = []; }
  private draw(): void {
    this.destroy(); if (this.room !== 'office') return;
    for (const dock of VEHICLE_DOCKS) {
      const available = this.units.filter((u) => u.kind === dock.kind && !u.riderId).length;
      for (let i = 0; i < available; i++) this.views.push(this.scene.add.image((dock.x + i + 0.5) * TILE, (dock.y + 0.9) * TILE,
        vehicleTexture(this.scene, dock.kind, 'right', 0)).setOrigin(0.5, 1).setScale(0.45).setDepth((dock.y + 1) * TILE + 1));
      this.views.push(this.scene.add.text((dock.x + 1.5) * TILE, (dock.y + 1) * TILE + 2, `${dock.kind === 'skates' ? 'スケート' : VEHICLES[dock.kind].name} ${available}/${VEHICLES[dock.kind].count}`, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#fbf4d7', backgroundColor: '#4d6e62', padding: { x: 2, y: 2 },
      }).setOrigin(0.5, 0).setDepth(ROWS * TILE + 18));
      this.views.push(this.scene.add.zone((dock.x + 1.5) * TILE, (dock.y + 0.5) * TILE, dock.w * TILE, TILE)
        .setDepth(ROWS * TILE + 19).setInteractive({ useHandCursor: true }).on('pointerup', this.open));
    }
  }
}
