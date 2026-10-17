import type { RoomId } from './rooms.ts';
import type { Furniture } from './world.ts';
export const INCIDENT_BEATS = ['orbit','scan','beam','stars','steam','paper','cards','shadow','trace','footprints','chalk','bubbles','rain','frost','snow','rainbow','sparks','blossom','ribbon','heart','music','ghosts','webs','mirror','pixels','feathers','trail','vine','smoke','sand','portal','suction','outside','screen'] as const;
export type IncidentBeat = typeof INCIDENT_BEATS[number];
export type IncidentScript = { room: RoomId; anchor: Furniture['kind']; beat: IncidentBeat; cast: string[]; approved?: boolean };
export const ANCHOR_LABELS: Partial<Record<Furniture['kind'],string>> = { desk:'デスク',table:'テーブル',counter:'カフェカウンター',buffet:'配膳カウンター',shelf:'本棚・資料棚',board:'ホワイトボード',monitor:'モニター',easel:'イーゼル',plant:'既存の植木鉢',sofa:'ソファ・ベンチ',bed:'ベッド',workbench:'作業台',rack:'サーバーラック',telescope:'望遠鏡',arcade:'ゲーム筐体',console:'操縦パネル',viewport:'正面スクリーン',pilot:'パイロット席',reactor:'魔法装置',pond:'屋上の池',vending:'自動販売機' };
