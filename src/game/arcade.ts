import type { RhythmBeat, ToastHold } from './arcade-rhythm.ts';
export const ARCADE_GAMES = {
  four: { name: 'ほしの四目ならべ', tag: '1人CPU対戦 / 2人 · 90秒', description: '交互に星を落とし、縦・横・斜めに4つつなげよう。時間切れは引き分け。', color: '#efbf76', x: 3, y: 3, label: '四目ならべ' },
  reflex: { name: 'せーので、ピカッ！', tag: '1人CPU対戦 / 2人 · 30〜60秒', description: '「ピカッ！」が出たら押そう。5本勝負、フライングは相手に1点。判定はサーバー到着順。', color: '#cf96bf', x: 13, y: 3, label: '早押し対決' },
  meteor: { name: 'みんなで流星ガード', tag: '1人 / 2〜4人協力 · 60秒', description: '3つの空を分担して、隕石を迎撃！ 60秒間、街のハートを守ろう。連射は0.45秒おき。', color: '#94cebd', x: 23, y: 3, label: '流星ガード' },
  clap: { name: 'オフィス手拍子', tag: '1〜4人 · 約32秒', description: '光の輪が重なる瞬間に、パン！ 一定のリズムに合わせて手拍子。ボタンかスペースでどうぞ。', color: '#e9ad86', x: 3, y: 9, label: '手拍子' },
  echo: { name: 'ねこのまねっこ', tag: '1〜4人 · 約32秒', description: 'ねこの「左・右」3拍のお手本を見て、同じリズムでお返事。左は1、右は2。まずはよく見よう！', color: '#dba4b7', x: 8, y: 9, label: 'まねっこ' },
  sort: { name: 'ロボット仕分け', tag: '1〜4人 · 約35秒', description: 'ベルトを流れる箱が中央に来たら、矢印の方向へ仕分け。左は1、右は2。あわてず、ポン！', color: '#a4bbc9', x: 13, y: 9, label: '仕分け' },
  star: { name: '流れ星キャッチ', tag: '1〜4人 · 約36秒', description: '3つの空を横切る星を、中央の線でキャッチ！ 上から1・2・3。星のレーンに合わせて押そう。', color: '#b2aedb', x: 18, y: 9, label: '星キャッチ' },
  toast: { name: 'カフェのトースト', tag: '1〜4人 · 約34秒', description: '合図で「焼く」、パンが目盛りに来たらもう一度押して「取り出す」。焼き時間は毎回少し違うよ。ボタンかスペースで2回！', color: '#dbc584', x: 23, y: 9, label: 'トースト' },
} as const;
export type ArcadeGame = keyof typeof ARCADE_GAMES;
export const ARCADE_IDS = Object.keys(ARCADE_GAMES) as ArcadeGame[];
export const isArcadeGame = (v: unknown): v is ArcadeGame => typeof v === 'string' && Object.hasOwn(ARCADE_GAMES, v);
export type ArcadeCommand = 'join' | 'leave' | 'start' | 'drop' | 'tap' | 'fire' | 'beat' | 'toast-press' | 'toast-release';
export type ArcadeAction = { type: 'arcade-action'; game: ArcadeGame; command: ArcadeCommand; roundId: string; actionId: string; value?: number; beatId?: number };
export type ArcadeMember = { id: string; name: string; score: number; combo?: number; bestCombo?: number; lastHit?: number; verdict?: string };
export type Meteor = { id: number; lane: number; bornAt: number; impactAt: number };
export type ArcadeTable = {
  game: ArcadeGame; roundId: string; revision: number; phase: 'lobby' | 'playing' | 'done'; members: ArcadeMember[];
  startedAt: number; beats: RhythmBeat[]; holds: ToastHold[]; endsAt: number; message: string; board: number[]; turn: number;
  round: number; light: 'wait' | 'go' | 'result'; health: number; meteors: Meteor[]; saved: number;
};
export type ArcadeSnapshot = { tables: ArcadeTable[]; serverNow: number };
export function parseArcadeAction(data: Record<string, unknown>): ArcadeAction | undefined {
  if (data.type !== 'arcade-action' || !isArcadeGame(data.game) ||
      typeof data.actionId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.actionId) ||
      typeof data.roundId !== 'string' || !/^[a-f0-9-]{36}$/.test(data.roundId)) return;
  const command = data.command;
  if (command === 'join' || command === 'leave' || command === 'start') return { type: 'arcade-action', game: data.game, command, roundId: data.roundId, actionId: data.actionId };
  if (command === 'beat' || command === 'toast-press' || command === 'toast-release') {
    if (!Number.isInteger(data.beatId) || (data.beatId as number) < 0 || (data.beatId as number) > 63 || !Number.isInteger(data.value) || (data.value as number) < 0 || (data.value as number) > 2) return;
    return { type: 'arcade-action', game: data.game, command, roundId: data.roundId, actionId: data.actionId, value: data.value as number, beatId: data.beatId as number };
  }
  if (command !== 'drop' && command !== 'tap' && command !== 'fire') return;
  const limit = command === 'drop' ? 6 : command === 'fire' ? 2 : 5;
  if (typeof data.value !== 'number' || !Number.isInteger(data.value) || data.value < 0 || data.value > limit || command === 'tap' && data.value < 1) return;
  return { type: 'arcade-action', game: data.game, command, roundId: data.roundId, actionId: data.actionId, value: data.value };
}
export function fourWinner(board: readonly number[], index: number): boolean {
  const piece = board[index]; if (!piece) return false;
  const x = index % 7, y = Math.floor(index / 7);
  return [[1, 0], [0, 1], [1, 1], [1, -1]].some(([dx, dy]) => {
    let total = 1;
    for (const sign of [-1, 1]) for (let step = 1; step < 4; step++) {
      const nx = x + dx * sign * step, ny = y + dy * sign * step;
      if (nx < 0 || nx >= 7 || ny < 0 || ny >= 6 || board[ny * 7 + nx] !== piece) break;
      total++;
    }
    return total >= 4;
  });
}

export const arcadeCapacity = (game: ArcadeGame): number => game === 'four' || game === 'reflex' ? 2 : 4;
