export const REACTIONS = {
  bow: { label: 'お辞儀', icon: '🙇', text: 'ぺこり', duration: 1500 },
  jump: { label: 'ジャンプ', icon: '↑', text: 'ぴょん！', duration: 1000 },
  cheer: { label: 'バンザイ', icon: '🙌', text: 'バンザイ！', duration: 1800 },
  joy: { label: 'よろこぶ', icon: '🎉', text: 'やったー！', duration: 1900 },
} as const;
export type ReactionKind = keyof typeof REACTIONS;
export type AvatarPose = 'stand' | 'bow' | 'raise' | 'happy';
export const REACTION_COOLDOWN_MS = 2200;
export const REACTION_KINDS = Object.keys(REACTIONS) as ReactionKind[];
export const isReactionKind = (value: unknown): value is ReactionKind => typeof value === 'string' && Object.hasOwn(REACTIONS, value);
export type ReactionMotion = { pose: AvatarPose; lift: number; tilt: number; scaleY: number; shadow: number; sparkle: number };

export function reactionMotion(kind: ReactionKind, elapsed: number, reducedMotion = false): ReactionMotion | undefined {
  const duration = REACTIONS[kind].duration;
  if (elapsed < 0 || elapsed >= duration || !Number.isFinite(elapsed)) return;
  const t = elapsed / duration;
  const envelope = Math.sin(Math.PI * t);
  const active = t > 0.12 && t < 0.88;
  const pose: AvatarPose = kind === 'bow' ? active ? 'bow' : 'stand'
    : kind === 'cheer' ? active ? 'raise' : 'stand'
    : kind === 'joy' ? active ? 'happy' : 'stand' : 'stand';
  const lift = kind === 'jump' ? Math.sin(Math.PI * Math.min(1, t / 0.8)) * 12
    : kind === 'joy' ? Math.max(0, Math.sin(4 * Math.PI * t)) * 5 : 0;
  return { pose, lift: reducedMotion ? 0 : lift,
    tilt: reducedMotion ? 0 : kind === 'cheer' || kind === 'joy' ? Math.sin(t * Math.PI * 6) * 0.05 * envelope : 0,
    scaleY: reducedMotion ? 1 : kind === 'bow' ? 1 - 0.08 * envelope : 1,
    shadow: reducedMotion ? 1 : 1 - lift * 0.025,
    sparkle: kind === 'cheer' || kind === 'joy' ? reducedMotion ? 0.7 : envelope : 0 };
}
