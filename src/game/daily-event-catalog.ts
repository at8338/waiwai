import { EVENT_STORIES } from './daily-event-stories.ts';
import type { EpisodeScene } from './event-tableaux.ts';
import { APPROVED_INCIDENTS } from './incident-approved.ts';
import { getRoom, isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import type { Furniture } from './world.ts';
import { INCIDENT_BEATS } from './incident-script.ts';
import type { IncidentScript, IncidentBeat } from './incident-script.ts';
import { isIncidentCast } from './incident-cast.ts';
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
export type DailyEpisode = { id: string; theme: EventTheme; variant: number; title: string; discovery: string; scene: EpisodeScene; direction: IncidentScript };
const approvedRooms: Record<string, RoomId> = { 'meteor-01':'office', 'thief-01':'office', 'flood-01':'workshop', 'flood-03':'office', 'flood-04':'cafe', 'santa-01':'office', 'delorean-01':'workshop', 'delorean-13':'meeting', 'terminator-01':'ops' };
export const DAILY_EPISODES: readonly DailyEpisode[] = (Object.keys(EVENT_THEMES) as EventTheme[]).flatMap(theme =>
  EVENT_STORIES[theme].split('\n').map((row, variant): DailyEpisode => {
    const id = theme + '-' + String(variant + 1).padStart(2, '0');
    if (row === 'KEEP') {
      const saved = APPROVED_INCIDENTS[id as keyof typeof APPROVED_INCIDENTS];
      return { id,theme,variant,title:saved.title,discovery:saved.discovery,scene:{...saved.scene,props:[...saved.scene.props]},
        direction:{room:approvedRooms[id],anchor:id==='delorean-13'?'table':id==='flood-01'||id==='delorean-01'?'workbench':id==='flood-04'?'vending':id==='terminator-01'?'monitor':'desk',beat:'trace',cast:[],approved:true} };
    }
    const [room,anchor,beat,actors,title,discovery,names] = row.split('|');
    const props=names?.split(' ') as EventProp[], cast=actors.split(' ');
    if (!isRoomId(room) || !getRoom(room).furniture.some(f=>f.kind===anchor) || !INCIDENT_BEATS.includes(beat as IncidentBeat)
      || cast.some(c=>!isIncidentCast(c)) || !title || !discovery || !props?.length || props.some(p=>!EVENT_PROP_NAMES.includes(p))) throw new Error('Invalid room incident '+id+': '+row);
    return { id,theme,variant,title,discovery,scene:{layout:'focus',props},direction:{room,anchor:anchor as Furniture['kind'],beat:beat as IncidentBeat,cast} };
  }));
export function episodeById(id: string): DailyEpisode | undefined { return DAILY_EPISODES.find(event => event.id === id); }
