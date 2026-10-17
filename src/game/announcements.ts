export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;
export const JST = 9 * 60 * MINUTE;
export const MAX_SCHEDULES = 50;
export const DURATIONS = [1, 3, 5, 10] as const;
export const LEADS = [0, 5, 10, 15] as const;
export const REPEATS = { once: '単発', daily: '毎日', weekdays: '平日（月〜金）', weekly: '毎週' } as const;
export type Repeat = keyof typeof REPEATS;
export type ScheduleDraft = { title: string; message: string; startsAt: number; repeat: Repeat; leadMinutes: number; displayMinutes: number; enabled: boolean };
export type Schedule = ScheduleDraft & { id: string; version: number; updatedBy: string; lastOccurrence?: number };
export type Announcement = { id: string; title: string; message: string; author: string; createdAt: number; expiresAt: number; scheduleId?: string; occurrence?: number };
export type AnnouncementState = { announcements: Announcement[]; schedules: Schedule[] };
export type AnnouncementSnapshot = AnnouncementState & { serverNow: number };
export type AnnouncementAction =
  | { type: 'announcement-publish'; title: string; message: string; durationMinutes: number; actionId: string }
  | { type: 'announcement-dismiss'; id: string; actionId: string }
  | { type: 'schedule-save'; id: string; expectedVersion: number; schedule: ScheduleDraft; actionId: string }
  | { type: 'schedule-delete'; id: string; expectedVersion: number; actionId: string };
export const validAnnouncementId = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
const clean = (v: unknown, limit: number): v is string => typeof v === 'string' && !!v.trim() && v.trim().length <= limit && !/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v);
export function validScheduleDraft(value: unknown): value is ScheduleDraft {
  if (!value || typeof value !== 'object') return false;
  const s = value as ScheduleDraft;
  return clean(s.title, 60) && clean(s.message, 240) && Number.isSafeInteger(s.startsAt) && s.startsAt >= Date.UTC(2000, 0) && s.startsAt < Date.UTC(2101, 0) &&
    Object.hasOwn(REPEATS, s.repeat) && (LEADS as readonly number[]).includes(s.leadMinutes) && (DURATIONS as readonly number[]).includes(s.displayMinutes) && typeof s.enabled === 'boolean';
}
export function parseAnnouncementAction(data: Record<string, unknown>): AnnouncementAction | undefined {
  if (!validAnnouncementId(data.actionId)) return;
  const actionId = data.actionId;
  if (data.type === 'announcement-publish' && clean(data.title, 60) && clean(data.message, 240) && (DURATIONS as readonly unknown[]).includes(data.durationMinutes))
    return { type: data.type, title: data.title.trim(), message: data.message.trim(), durationMinutes: data.durationMinutes as number, actionId };
  if (!validAnnouncementId(data.id)) return;
  const id = data.id;
  if (data.type === 'announcement-dismiss') return { type: data.type, id, actionId };
  if (!Number.isSafeInteger(data.expectedVersion) || (data.expectedVersion as number) < 0) return;
  const expectedVersion = data.expectedVersion as number;
  if (data.type === 'schedule-delete') return { type: data.type, id, expectedVersion, actionId };
  if (data.type === 'schedule-save' && validScheduleDraft(data.schedule)) {
    const s = data.schedule;
    return { type: data.type, id, expectedVersion, actionId, schedule: { title: s.title.trim(), message: s.message.trim(), startsAt: s.startsAt,
      repeat: s.repeat, leadMinutes: s.leadMinutes, displayMinutes: s.displayMinutes, enabled: s.enabled } };
  }
}
const dayStart = (time: number) => Math.floor((time + JST) / DAY) * DAY - JST;
function matches(s: ScheduleDraft, start: number): boolean {
  if (start < s.startsAt) return false;
  const dow = new Date(start + JST).getUTCDay();
  return s.repeat === 'daily' || s.repeat === 'weekdays' && dow > 0 && dow < 6 || s.repeat === 'weekly' && dow === new Date(s.startsAt + JST).getUTCDay();
}
export function nextOccurrence(s: ScheduleDraft, now: number): number | undefined {
  if (!s.enabled) return;
  if (s.repeat === 'once') return s.startsAt >= now ? s.startsAt : undefined;
  const floor = dayStart(Math.max(s.startsAt, now)), time = s.startsAt - dayStart(s.startsAt);
  for (let d = 0; d < 8; d++) { const start = floor + d * DAY + time; if (start >= now && matches(s, start)) return start; }
}
export function dueOccurrence(s: ScheduleDraft, now: number): number | undefined {
  if (!s.enabled) return;
  const isDue = (start: number) => start - s.leadMinutes * MINUTE <= now && now < start + s.displayMinutes * MINUTE;
  if (s.repeat === 'once') return isDue(s.startsAt) ? s.startsAt : undefined;
  const floor = dayStart(now + s.leadMinutes * MINUTE), time = s.startsAt - dayStart(s.startsAt);
  for (let d = 0; d < 8; d++) { const start = floor - d * DAY + time; if (matches(s, start) && isDue(start)) return start; }
}
export function jstInput(time: number): string { return new Date(time + JST).toISOString().slice(0, 16); }
export function parseJstInput(value: string): number | undefined {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return;
  const result = Date.parse(value + '+09:00');
  return Number.isFinite(result) && jstInput(result) === value ? result : undefined;
}
export function jstLabel(time: number): string {
  const d = new Date(time + JST), value = jstInput(time);
  return `${value.slice(5, 10).replace('-', '/')}（${'日月火水木金土'[d.getUTCDay()]}）${value.slice(11)} JST`;
}
