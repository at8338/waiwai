import Phaser from 'phaser';
import { createAvatarTextures, drawOffice } from './art.ts';
import { Controls } from './controls.ts';
import { Walker, areaAt, COLS, ROWS, TILE } from './world.ts';
import type { Direction } from './world.ts';

export class OfficeScene extends Phaser.Scene {
  readonly walker = new Walker();
  private controls = new Controls();
  private avatar!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Graphics;
  private nameLabel!: Phaser.GameObjects.Text;
  private outfit = 0;
  private playerName = 'あなた';
  private lastArea = '';
  private inputController = new AbortController();

  constructor() { super('office'); }

  create(): void {
    drawOffice(this);
    createAvatarTextures(this);
    this.shadow = this.add.graphics();
    this.shadow.fillStyle(0x6e684b, 0.3).fillRect(-6, -1, 12, 3);
    this.avatar = this.add.image(0, 0, 'avatar-0-down-0').setOrigin(0.5, 1);
    this.nameLabel = this.add.text(0, 0, this.playerName, {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#fff9e6',
      backgroundColor: '#355b49', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setResolution(2);
    this.controls.attach(this.game.canvas);
    document.querySelector('#reset-position')?.addEventListener('click', () => {
      this.controls.clear();
      this.walker.reset();
      this.game.canvas.focus({ preventScroll: true });
    }, { signal: this.inputController.signal });
    document.addEventListener('walk-step', ((event: CustomEvent<Direction>) => {
      this.walker.step(event.detail);
    }) as EventListener, { signal: this.inputController.signal });
    this.events.once('shutdown', () => {
      this.controls.destroy();
      this.inputController.abort();
    });
    this.game.canvas.focus({ preventScroll: true });
    this.game.canvas.parentElement?.querySelector('.loading')?.remove();
    this.update(0, 0);
  }

  setName(name: string): void {
    this.playerName = name.trim() || 'あなた';
    this.nameLabel?.setText(this.playerName);
  }

  setOutfit(color: number): void { this.outfit = color; }

  update(time: number, delta: number): void {
    this.walker.update(delta);
    if (!this.walker.moving) {
      const direction = this.controls.direction();
      if (direction) this.walker.step(direction);
    }
    const { x, y } = this.walker.position();
    const frame = this.walker.moving ? 1 + Math.floor(time / 95) % 2 : 0;
    this.avatar.setPosition(Math.round(x), Math.round(y) + 6);
    this.avatar.setTexture(`avatar-${this.outfit}-${this.walker.facing}-${frame}`).setDepth(y + 7);
    this.shadow.setPosition(Math.round(x), Math.round(y) + 5).setDepth(y + 6);
    this.nameLabel.setPosition(Math.round(x), Math.round(y) - 20).setDepth(ROWS * TILE + 20);
    const area = areaAt(this.walker.tile);
    if (area !== this.lastArea) {
      this.lastArea = area;
      document.querySelectorAll('[data-current-area]').forEach((element) => { element.textContent = area; });
    }
    // A DOM position readout also makes movement inspectable without exposing engine internals.
    const canvas = this.game.canvas;
    canvas.dataset.tileX = String(this.walker.tile.x);
    canvas.dataset.tileY = String(this.walker.tile.y);
  }
}

export function startOffice(parent: HTMLElement): { game: Phaser.Game; scene: OfficeScene } {
  const scene = new OfficeScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: COLS * TILE,
    height: ROWS * TILE,
    backgroundColor: '#ead3a5',
    pixelArt: true,
    roundPixels: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    // Input is scoped to the focused canvas so editing a name never moves the avatar.
    input: { keyboard: false },
    audio: { noAudio: true },
  });
  return { game, scene };
}
