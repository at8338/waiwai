import { REACTIONS } from './reactions.ts';
export type LaptopThrowMotion = { phase: 'windup' | 'flight' | 'impact'; x: number; y: number; rotation: number; alpha: number; impact: number };
/** A short visual gesture; no furniture, inventory or combat state is changed. */
export function laptopThrowMotion(elapsed: number, reduced = false): LaptopThrowMotion | undefined {
  const duration = REACTIONS.anger.duration;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= duration) return;
  const t = elapsed / duration;
  if (reduced) return { phase: 'windup', x: -6, y: -22, rotation: 0, alpha: 1, impact: 0 };
  if (t < .22) return { phase: 'windup', x: -6, y: -22 - 3 * t / .22, rotation: -.15 * t / .22, alpha: 1, impact: 0 };
  if (t < .7) {
    const u = (t - .22) / .48;
    return { phase: 'flight', x: -6 + 34 * u, y: -25 + 31 * u - 22 * Math.sin(Math.PI * u), rotation: 2 * Math.PI * u - .15, alpha: 1, impact: 0 };
  }
  const u = (t - .7) / .3;
  return { phase: 'impact', x: 28, y: 6 - 3 * Math.sin(Math.PI * Math.min(1, u * 2)), rotation: -.15, alpha: Math.min(1, (1 - t) / .18), impact: Math.max(0, 1 - u * 2) };
}
