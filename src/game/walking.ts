import type { Direction } from './world.ts';
export const WALK_STYLES = [
  { label: 'ふつう', description: '足を交互に出す、いつもの歩き方。' },
  { label: '小走り', description: '少し前傾して、足をこまめに動かします。' },
  { label: 'スキップ', description: '片足ずつ弾ませながら、軽やかに進みます。' },
  { label: 'ぴょこぴょこ', description: '両足をそろえて、小さく跳ねながら進みます。' },
  { label: 'のしのし', description: 'ゆっくり踏みしめ、体を上下に揺らします。' },
  { label: 'すいすい', description: '足をそろえて、すべるように進みます。' },
] as const;
export type WalkingMotion = { frame: 0 | 1 | 2; lift: number; offsetX: number; tilt: number; scaleX: number; scaleY: number; shadow: number };
const STILL: WalkingMotion = { frame: 0, lift: 0, offsetX: 0, tilt: 0, scaleX: 1, scaleY: 1, shadow: 1 };
// Pure drawing transforms: no change to tile movement, collisions or the network cadence.
export function walkingMotion(style: number, time: number, direction: Direction, moving: boolean, reducedMotion = false): WalkingMotion {
  if (!moving || reducedMotion || !Number.isFinite(time)) return { ...STILL };
  const cycle = (period: number) => ((time % period) + period) % period / period;
  const feet = (period: number): 1 | 2 => cycle(period) < 0.5 ? 1 : 2;
  const side = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const result = { ...STILL, frame: feet(190) };
  if (style === 1) {
    const t = cycle(260), wave = Math.sin(t * Math.PI * 2);
    return { ...result, frame: feet(130), lift: Math.abs(wave) * 1.6, tilt: side * 0.12, scaleX: 0.97, scaleY: 1.02, shadow: 0.95 };
  }
  if (style === 2) {
    const t = cycle(640), half = (t * 2) % 1, lift = Math.sin(half * Math.PI) * (t < 0.5 ? 3 : 6);
    return { ...result, frame: t < 0.5 ? 1 : 2, lift, tilt: Math.sin(t * Math.PI * 2) * 0.08, shadow: 1 - lift * 0.035 };
  }
  if (style === 3) {
    const t = cycle(430), lift = Math.sin(Math.PI * t) * 7;
    return { ...result, frame: 0, lift, scaleX: 1 - lift * 0.006, scaleY: 1 + lift * 0.007, shadow: 1 - lift * 0.045 };
  }
  if (style === 4) {
    const t = cycle(700), wave = Math.sin(t * Math.PI * 2), press = Math.pow(Math.abs(wave), 5);
    return { ...result, frame: feet(700), lift: 1 - press, offsetX: wave * 0.8, tilt: wave * 0.045, scaleX: 1 + press * 0.035, scaleY: 1 - press * 0.07 };
  }
  if (style === 5) {
    const wave = Math.sin(cycle(1000) * Math.PI * 2);
    return { ...result, frame: 0, lift: 2 + wave * 0.6, tilt: side * 0.04, shadow: 0.87 };
  }
  return result;
}
