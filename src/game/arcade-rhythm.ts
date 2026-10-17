export const RHYTHM_IDS = ['clap', 'echo', 'sort', 'star', 'toast'] as const;
export type RhythmGame = typeof RHYTHM_IDS[number];
export const isRhythmGame = (game: string): game is RhythmGame => (RHYTHM_IDS as readonly string[]).includes(game);
export type RhythmBeat = { id: number; at: number; cueAt: number; key: number; span: number };
export type ToastHold = { id: string; beatId: number; startedAt: number };
export const TIMING_WINDOW = 340;
export function rhythmBeats(game: RhythmGame, startedAt: number, random: () => number): RhythmBeat[] {
  const base = startedAt + 3000;
  return Array.from({ length: game === 'echo' ? 15 : game === 'toast' ? 10 : game === 'star' ? 18 : 20 }, (_, id) => {
    const at = game === 'echo' ? base + Math.floor(id / 3) * 6000 + 2600 + id % 3 * 650 : base + id * (game === 'toast' ? 3000 : game === 'star' ? 1800 : game === 'sort' ? 1600 : 1400);
    return { id, at, cueAt: game === 'echo' ? at - 2600 : at, key: game === 'echo' || game === 'sort' ? Math.floor(random() * 2) : game === 'star' ? Math.floor(random() * 3) : 0, span: game === 'toast' ? 900 + Math.floor(random() * 5) * 150 : 0 };
  });
}
export function nearestBeat(beats: readonly RhythmBeat[], now: number): RhythmBeat | undefined {
  return beats.reduce<RhythmBeat | undefined>((best, beat) => !best || Math.abs(beat.at - now) < Math.abs(best.at - now) ? beat : best, undefined);
}
export function timingScore(delta: number): number { return Math.abs(delta) <= 150 ? 30 : Math.abs(delta) <= TIMING_WINDOW ? 15 : 0; }
