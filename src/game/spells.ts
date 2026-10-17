import { validAnnouncementId } from './announcements.ts';
import type { RoomId } from './rooms.ts';
import type { Point } from './world.ts';
export const SPELLS = {
  call: { name: 'コール', icon: '🔔', description: '選んだ人を、あなたの近くへ呼び寄せる。会議の集合に。空きがないときは人と重なれます。', cooldown: 10_000 },
  fire: { name: 'ファイア', icon: '🔥', description: '向いている方向へ火を飛ばす。闘技場での対戦中は相手に25ダメージ。', cooldown: 1200 },
  blizzard: { name: 'ブリザド', icon: '❄', description: '目の前に3秒だけ氷の盾を作る。氷が消えるまで次は出せません。', cooldown: 3000 },
  rura: { name: 'ルーラ', icon: '🪽', description: '会いたい人の隣へ、ひとっ飛び。空きがないときは人と重なれます。', cooldown: 3000 },
} as const;
export type SpellKind = keyof typeof SPELLS;
export const SPELL_KINDS = Object.keys(SPELLS) as SpellKind[];
export const MAX_CALL_TARGETS = 20;
export type SpellAction = { type: 'spell-cast'; actionId: string } & (
  | { spell: 'fire' }
  | { spell: 'blizzard' }
  | { spell: 'rura'; targetId: string }
  | { spell: 'call'; targetIds: string[] });
export type SpellEffect = { id: string; spell: SpellKind; casterId: string; casterName: string; roomId: RoomId; origin: Point; destinations: Point[]; targetIds: string[] };
export function parseSpellAction(data: Record<string, unknown>): SpellAction | undefined {
  if (data.type !== 'spell-cast' || !validAnnouncementId(data.actionId)) return;
  const base = { type: 'spell-cast' as const, actionId: data.actionId };
  if (data.spell === 'fire' || data.spell === 'blizzard') return { ...base, spell: data.spell };
  if (data.spell === 'rura' && validAnnouncementId(data.targetId)) return { ...base, spell: 'rura', targetId: data.targetId };
  if (data.spell === 'call' && Array.isArray(data.targetIds) && data.targetIds.length > 0 && data.targetIds.length <= MAX_CALL_TARGETS && data.targetIds.every(validAnnouncementId) && new Set(data.targetIds).size === data.targetIds.length)
    return { ...base, spell: 'call', targetIds: [...data.targetIds] };
}
