import { JST, validAnnouncementId } from './announcements.ts';
export type Birthday = { id: string; name: string; month: number; day: number; version: number; cheers: number; cheered: boolean };
export type BirthdaySnapshot = { entries: Birthday[]; selfId: string; persistent: boolean; serverNow: number };
export type BirthdayAction =
  | { type: 'birthday-save'; month: number; day: number; expectedVersion: number; actionId: string }
  | { type: 'birthday-delete'; expectedVersion: number; actionId: string }
  | { type: 'birthday-cheer'; id: string; actionId: string };
export function validBirthday(month: unknown, day: unknown): boolean {
  return Number.isInteger(month) && Number.isInteger(day) && Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= new Date(Date.UTC(2000, Number(month), 0)).getUTCDate();
}
export const birthdayDay = (now: number): string => new Date(now + JST).toISOString().slice(0, 10);
export function birthdayOnDay(birthday: Pick<Birthday, 'month' | 'day'>, time: number): boolean {
  const date = new Date(time + JST), year = date.getUTCFullYear();
  const day = birthday.month === 2 && birthday.day === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1 ? 28 : birthday.day;
  return date.getUTCMonth() + 1 === birthday.month && date.getUTCDate() === day;
}
export function parseBirthdayAction(data: Record<string, unknown>): BirthdayAction | undefined {
  if (!validAnnouncementId(data.actionId)) return;
  const actionId = data.actionId;
  if (data.type === 'birthday-cheer' && typeof data.id === 'string' && /^(slack:[A-Z0-9]{1,40}:[A-Z0-9]{1,40}|guest:[a-f0-9-]{36})$/.test(data.id)) return { type: data.type, id: data.id, actionId };
  if (!Number.isSafeInteger(data.expectedVersion) || Number(data.expectedVersion) < 0) return;
  const expectedVersion = Number(data.expectedVersion);
  if (data.type === 'birthday-delete') return { type: data.type, expectedVersion, actionId };
  if (data.type === 'birthday-save' && validBirthday(data.month, data.day)) return { type: data.type, month: Number(data.month), day: Number(data.day), expectedVersion, actionId };
}
