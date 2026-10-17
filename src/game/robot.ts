import type { RoomId } from './rooms.ts';
export const ROBOT_NAME = 'ワイワイガー';
export const ROBOT_PARTS = [
  { id: 'head', label: '頭部', title: '司令・展望ブロック', description: 'ここがワイワイガーの頭脳。操縦室と、遠くを見渡すラウンジ、考えをまとめる集中室。', rooms: ['cockpit', 'sky', 'focus'] },
  { id: 'body', label: '胴体', title: 'みんなのコア', description: '胸の中にある、いつものオフィス。相談や作戦会議、日々の運用もこの場所から。', rooms: ['office', 'meeting', 'ops', 'project'] },
  { id: 'leftarm', label: '左腕', title: 'ものづくりアーム', description: '絵を描き、試作を重ねる左腕。何かを生み出す人たちのアイデアが、この腕を動かす。', rooms: ['studio', 'workshop'] },
  { id: 'rightarm', label: '右腕', title: '知恵と遊びのアーム', description: '本棚の知恵とゲームのひらめきを詰めた右腕。ときどきロケットパンチの練習も。', rooms: ['library', 'arcade'] },
  { id: 'leftleg', label: '左脚', title: '休息エネルギーブロック', description: '食堂でお腹を満たし、カフェと休憩室でひと息。しっかり休むことが、大きな一歩のエネルギーになる。', rooms: ['cafe', 'wellness', 'canteen'] },
  { id: 'rightleg', label: '右脚', title: '緑のオープンデッキ', description: '右足の甲に広がる屋上ガーデン。海風を感じながら、巨人の一歩を支える小さな庭。', rooms: ['garden'] },
] as const satisfies readonly { id: string; label: string; title: string; description: string; rooms: readonly RoomId[] }[];
export const robotLocation = (room: RoomId): string => ROBOT_PARTS.find((part) => (part.rooms as readonly RoomId[]).includes(room))?.label ?? '';
export const ROBOT_ACTIONS = {
  boot: { label: '起動！', description: '胸のコアが光り、巨人が目を覚ます。', duration: 6500, message: '全ブロック接続。ワイワイガー、起動！' },
  wave: { label: '手を振る', description: '海の向こうへ、大きなごあいさつ。', duration: 6500, message: '右腕、おおきく手を振ってごあいさつ！' },
  walk: { label: '歩行テスト', description: '一歩ずつ、のんびり足踏み。', duration: 8000, message: '左、右。巨大な一歩を、みんなで練習中。' },
  punch: { label: 'ロケットパンチ', description: '練習用の空へ。拳はちゃんと戻ってきます。', duration: 6500, message: 'ロケットパーンチ！ 練習用の空へ、発進！' },
  barrier: { label: 'バリア展開', description: '青い光で、巨人をふんわり包む。', duration: 6500, message: 'やさしい光のバリア、展開！' },
  pose: { label: '決めポーズ', description: 'みんなのひらめき、ひとつのポーズに。', duration: 7000, message: '合言葉は、今日もワイワイ！' },
} as const;
export type RobotAction = keyof typeof ROBOT_ACTIONS;
export const isRobotAction = (value: unknown): value is RobotAction => typeof value === 'string' && Object.hasOwn(ROBOT_ACTIONS, value);
export type RobotState = { action: RobotAction | null; startedAt: number; endsAt: number; operator: string; version: number };
export type RobotSnapshot = { state: RobotState; serverNow: number };
export const IDLE_ROBOT: RobotState = { action: null, startedAt: 0, endsAt: 0, operator: '', version: 0 };
export const ROBOT_CONSOLE_KINDS = ['viewport', 'console', 'pilot', 'reactor', 'monitor'] as const;
