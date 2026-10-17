import { EVENT_STORIES } from './daily-event-stories.ts';
import type { EpisodeScene, Staging } from './event-tableaux.ts';
import { STAGING } from './event-tableaux.ts';
import { EVENT_PROP_NAMES } from './event-props.ts';
import type { EventProp } from './event-props.ts';
// Keys and IDs stay stable for saved discoveries. The labels describe broad
// subject areas; individual scenes are authored independently inside each area.
export const EVENT_THEMES = {
  meteor: '宇宙の不思議', thief: 'オフィスの異変', flood: '天気と季節のいたずら', santa: '一年の行事',
  ghost: '怪奇とミステリー', waldo: '遊びの世界', delorean: '乗りものと旅', terminator: '機械の珍事件',
  momotaro: '昔話の一幕', urashima: '歴史と冒険', kaguya: '植物の不思議', alice: '大きさと形の異変', oz: '空気と重力',
  pirate: '船と航海の道具', ninja: '和の珍騒動', dragon: '幻獣のいる日', slime: 'やわらかい世界', robot: '電化製品の副業',
  space: '宇宙技術の寄り道', dinosaur: '太古からの来客', magic: '魔法の失敗と成功', food: '食べものの事件',
  festival: '祭りと見世物', detective: '探偵の事件簿', comic: '漫画からの来客', kaiju: '窓の向こうの非日常',
} as const;
export type EventTheme = keyof typeof EVENT_THEMES;
export type DailyEpisode = { id: string; theme: EventTheme; variant: number; title: string; discovery: string; scene: EpisodeScene };
const specials = new Set<string>([...Object.keys(EVENT_THEMES), 'aquarium']);
export const DAILY_EPISODES: readonly DailyEpisode[] = (Object.keys(EVENT_THEMES) as EventTheme[]).flatMap(theme =>
  EVENT_STORIES[theme].split('\n').map((row, variant) => {
    const [title, discovery, staging, names] = row.split('|');
    const special = staging.startsWith('!') ? staging.slice(1) : undefined;
    const layout = (special ? 'focus' : staging) as Staging;
    const props = names.split(' ') as EventProp[];
    if (!title || !discovery || !(layout in STAGING) || (special && !specials.has(special)) || props.some(p => !EVENT_PROP_NAMES.includes(p))) throw new Error('Invalid authored incident: ' + row);
    return { id: theme + '-' + String(variant + 1).padStart(2, '0'), theme, variant, title, discovery, scene: { layout, props, ...(special ? { special } : {}) } };
  }));
export function episodeById(id: string): DailyEpisode | undefined { return DAILY_EPISODES.find(event => event.id === id); }
