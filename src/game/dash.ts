import type { Direction } from './world.ts';
export const DASH_TILES = 5, DASH_MS = 160, DASH_COOLDOWN_MS = 900, DOUBLE_TAP_MS = 280;
export class DoubleTap {
  private previous?: { direction: Direction; time: number };
  press(direction: Direction, now: number, repeat = false): boolean {
    if (repeat) return false;
    const match = this.previous?.direction === direction && now - this.previous.time >= 0 && now - this.previous.time <= DOUBLE_TAP_MS;
    this.previous = match ? undefined : { direction, time: now }; return match;
  }
  clear(): void { this.previous = undefined; }
}
