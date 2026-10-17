import { DAY, JST, nextOccurrence } from './announcements.ts';
import type { Schedule } from './announcements.ts';
import { EVENT_JOURNAL_START, dailyEventAt } from './daily-events.ts';
import type { DailyEvent } from './daily-events.ts';
export const calendarDay = (time: number): number => Math.floor((time + JST) / DAY) * DAY - JST;
export function calendarCells(month: number): (number | null)[] {
  const d = new Date(month + JST), year = d.getUTCFullYear(), m = d.getUTCMonth();
  const first = Date.UTC(year, m, 1) - JST, length = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = Array.from({ length: new Date(first + JST).getUTCDay() }, () => null);
  for (let day = 0; day < length; day++) cells.push(first + day * DAY);
  while (cells.length % 7) cells.push(null);
  return cells;
}
export function schedulesOnDay(schedules: readonly Schedule[], day: number): { schedule: Schedule; startsAt: number }[] {
  return schedules.flatMap((schedule) => {
    const startsAt = nextOccurrence(schedule, calendarDay(day));
    return startsAt !== undefined && startsAt < calendarDay(day) + DAY ? [{ schedule, startsAt }] : [];
  }).sort((a, b) => a.startsAt - b.startsAt || a.schedule.title.localeCompare(b.schedule.title, 'ja'));
}
export function recordedEvent(day: number, now: number): DailyEvent | undefined {
  const value = calendarDay(day), today = calendarDay(now);
  return value >= Math.max(EVENT_JOURNAL_START, today - 364 * DAY) && value <= today ? dailyEventAt(value) : undefined;
}
