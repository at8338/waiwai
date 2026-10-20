import type Phaser from 'phaser';
import { SpeechBubbles, speechPosition, speechPreview } from './speech-bubbles.ts';
import type { Speech } from './speech-bubbles.ts';
import { COLS, ROWS, TILE } from './world.ts';
type Bubble = { container: Phaser.GameObjects.Container; background: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text; messageId?: string; width: number; height: number };
const colors = { '全館': { fill: 0xfff8dc, border: 0xb29350, text: '#736139' }, 'フロア': { fill: 0xf7ffef, border: 0x78986a, text: '#45633c' }, 'グループ': { fill: 0xf7f0ff, border: 0xa68ab1, text: '#775686' } };
export class SpeechBubblesView {
  private scene: Phaser.Scene;
  private model: SpeechBubbles;
  private views = new Map<string, Bubble>();
  private drawn = new Set<string>();
  private occupied: { x: number; y: number; width: number; height: number }[] = [];
  private status = document.createElement('p');
  constructor(scene: Phaser.Scene, model: SpeechBubbles) {
    this.scene = scene; this.model = model;
    this.status.id = 'office-speech-announcement'; this.status.className = 'speech-announcement'; this.status.setAttribute('role', 'status'); this.status.setAttribute('aria-live', 'polite');
    document.querySelector('#game')!.append(this.status);
  }
  announce(speech: Speech): void { this.status.textContent = `${speech.channel} · ${speech.name}：${speech.text.replaceAll('\n', '')}`; }
  beginFrame(): void { this.drawn.clear(); this.occupied = []; }
  draw(id: string, x: number, headY: number, now: number, reducedMotion: boolean): void {
    const speech = this.model.get(id, now); if (!speech) return;
    this.drawn.add(id);
    let view = this.views.get(id);
    if (!view) {
      const background = this.scene.add.graphics(), text = this.scene.add.text(8, 17, '', { resolution: 2, fontFamily: 'sans-serif', fontSize: '8px', color: '#354b3e', lineSpacing: 3 });
      const label = this.scene.add.text(8, 5, '', { resolution: 2, fontFamily: 'sans-serif', fontSize: '6px', fontStyle: 'bold' });
      const container = this.scene.add.container(0, 0, [background, label, text]).setDepth(ROWS * TILE + 30);
      view = { container, background, text, label, width: 0, height: 0 }; this.views.set(id, view);
    }
    const color = colors[speech.channel];
    if (view.messageId !== speech.id) {
      view.messageId = speech.id; view.text.setText(speech.text);
      const name = speechPreview(speech.name).split('\n');
      view.label.setText(`${speech.channel} · ${name[0]}${name.length > 1 ? '…' : ''}`).setColor(color.text);
      view.width = Math.max(56, view.text.width + 16, view.label.width + 16); view.height = view.text.height + 24;
    }
    const position = speechPosition(x, headY, view.width, view.height);
    // Shift neighbouring speech upward where possible, keeping it inside the map.
    for (let attempt = 0; attempt < 8; attempt++) {
      const overlap = this.occupied.find(r => position.x < r.x + r.width + 3 && position.x + view.width + 3 > r.x && position.y < r.y + r.height + 7 && position.y + view.height + 7 > r.y);
      if (!overlap) break;
      if (overlap.y - view.height - 10 >= 4) position.y = overlap.y - view.height - 10;
      else if (overlap.x + overlap.width + view.width + 12 <= COLS * TILE) position.x = overlap.x + overlap.width + 6;
      else if (overlap.x - view.width - 6 >= 4) position.x = overlap.x - view.width - 6;
      else break;
    }
    const tailX = Math.max(9, Math.min(view.width - 9, x - position.x));
    view.background.clear().fillStyle(0x354b3e, 0.14).fillRoundedRect(2, 3, view.width, view.height, 4)
      .fillStyle(color.fill).fillRoundedRect(0, 0, view.width, view.height, 4)
      .lineStyle(1, color.border).strokeRoundedRect(0, 0, view.width, view.height, 4)
      .fillStyle(color.border).fillTriangle(tailX - 4, view.height, tailX + 4, view.height, tailX, view.height + 6)
      .fillStyle(color.fill).fillTriangle(tailX - 3, view.height - 1, tailX + 3, view.height - 1, tailX, view.height + 4);
    view.container.setPosition(position.x, position.y).setAlpha(reducedMotion ? 1 : Math.min(1, (speech.expiresAt - now) / 700));
    this.occupied.push({ ...position, width: view.width, height: view.height });
  }
  endFrame(): void { for (const [id, view] of this.views) if (!this.drawn.has(id)) { view.container.destroy(); this.views.delete(id); } if (!this.views.size) this.status.textContent = ''; }
  remove(id: string): void { this.model.remove(id); this.views.get(id)?.container.destroy(); this.views.delete(id); }
  clear(): void { this.model.clear(); for (const view of this.views.values()) view.container.destroy(); this.views.clear(); this.status.textContent = ''; }
  destroy(): void { this.clear(); this.status.remove(); }
}
