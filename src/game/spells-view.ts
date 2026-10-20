import Phaser from 'phaser';
import { SPELLS } from './spells.ts';
import type { SpellEffect } from './spells.ts';
import { TILE } from './world.ts';
export class SpellsView {
  private graphics: Phaser.GameObjects.Graphics;
  private effects: { value: SpellEffect; start: number; label: Phaser.GameObjects.Text }[] = [];
  constructor(private scene: Phaser.Scene) { this.graphics = scene.add.graphics().setDepth(50_000); }
  receive(value: SpellEffect): void {
    if (this.effects.some((entry) => entry.value.id === value.id)) return;
    if (this.effects.length >= 32) this.effects.shift()!.label.destroy();
    const anchor = value.spell === 'fire' ? value.origin : value.destinations[0];
    const label = this.scene.add.text((anchor.x + .5) * TILE, (anchor.y + .5) * TILE - 28, `${SPELLS[value.spell].name}！`, { resolution: 2, fontFamily: 'sans-serif', fontSize: '8px', color: value.spell === 'fire' ? '#fff0b0' : '#e1e9ff', backgroundColor: value.spell === 'fire' ? '#7f4935' : '#5d5b83', padding: { x: 3, y: 2 } }).setOrigin(.5, 1).setDepth(50_001);
    this.effects.push({ value, start: performance.now(), label });
  }
  update(reducedMotion: boolean): void {
    this.graphics.clear(); const now = performance.now();
    this.effects = this.effects.filter((entry) => { if (now - entry.start < 1500) return true; entry.label.destroy(); return false; });
    for (const { value, start, label } of this.effects) {
      const t = Math.min(1, (now - start) / 1500), alpha = 1 - t;
      label.setAlpha(Math.min(1, alpha * 3));
      if (value.spell === 'fire') {
        const target = value.destinations[0], travel = reducedMotion ? 1 : Math.min(1, t * 1.3);
        const x = (value.origin.x + .5 + (target.x - value.origin.x) * travel) * TILE;
        const y = (value.origin.y + .5 + (target.y - value.origin.y) * travel) * TILE - 8 - (reducedMotion ? 0 : Math.sin(travel * Math.PI) * 8);
        for (let tail = 1; tail <= 3; tail++) this.graphics.fillStyle(0xec9c48, alpha * (1 - tail / 4)).fillRect(x - (target.x - value.origin.x) * tail * 1.3 - 1, y - (target.y - value.origin.y) * tail * 1.3, 3, 3);
        this.graphics.fillStyle(0xd97643, alpha).fillRect(x - 5, y - 5, 10, 9).fillRect(x - 2, y - 10, 4, 6);
        this.graphics.fillStyle(0xffbe55, alpha).fillRect(x - 3, y - 4, 6, 8).fillRect(x + 1, y - 7, 2, 4);
        this.graphics.fillStyle(0xffebaa, alpha).fillRect(x - 1, y, 3, 4);
      } else for (const point of value.destinations.filter((point, index, all) => all.findIndex((other) => other.x === point.x && other.y === point.y) === index)) {
        const x = (point.x + .5) * TILE, y = (point.y + .5) * TILE;
        const radius = reducedMotion ? 13 : 6 + t * 15;
        this.graphics.lineStyle(2, value.spell === 'call' ? 0xf6d78d : 0xaec9ff, alpha).strokeEllipse(x, y + 4, radius * 2, radius);
        for (let i = 0; i < 4; i++) {
          const angle = i * Math.PI / 2 + (reducedMotion ? 0 : t * 2), sx = x + Math.cos(angle) * radius, sy = y - 7 + Math.sin(angle) * radius;
          this.graphics.fillStyle(0xece4fd, alpha).fillRect(sx - 1, sy - 1, 3, 3);
        }
      }
    }
    this.scene.game.canvas.dataset.spellEffects = JSON.stringify(this.effects.map(({ value }) => ({ spell: value.spell, casterId: value.casterId, roomId: value.roomId, destinations: value.destinations })));
  }
  clear(): void { for (const effect of this.effects) effect.label.destroy(); this.effects = []; this.graphics.clear(); this.scene.game.canvas.dataset.spellEffects = '[]'; }
  destroy(): void { this.clear(); this.graphics.destroy(); }
}
