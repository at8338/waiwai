import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_SCHEDULES, MINUTE, validScheduleDraft, validAnnouncementId, dueOccurrence } from '../src/game/announcements.ts';
import type { AnnouncementState, AnnouncementAction, Schedule } from '../src/game/announcements.ts';
export class AnnouncementError extends Error {}
export class AnnouncementStore {
  private state: AnnouncementState = { announcements: [], schedules: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  private clock: () => number;
  constructor(file?: string, clock = Date.now) {
    this.file = file; this.clock = clock;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8'); if (Buffer.byteLength(raw) > 512 * 1024) throw new Error('Too large');
      const data = JSON.parse(raw), { announcements, schedules } = data;
      if (data.version !== 1 || !Array.isArray(schedules) || schedules.length > MAX_SCHEDULES || !schedules.every((s: Schedule) => validScheduleDraft(s) && validAnnouncementId(s.id) && Number.isSafeInteger(s.version) && s.version > 0 && typeof s.updatedBy === 'string' && s.updatedBy.length <= 100 && (s.lastOccurrence === undefined || Number.isSafeInteger(s.lastOccurrence))) ||
        new Set(schedules.map((s: Schedule) => s.id)).size !== schedules.length || !Array.isArray(announcements) || announcements.length > 60 || !announcements.every((a) => validAnnouncementId(a.id) && typeof a.title === 'string' && a.title.length <= 60 && typeof a.message === 'string' && a.message.length <= 240 && typeof a.author === 'string' && a.author.length <= 100 && Number.isSafeInteger(a.createdAt) && Number.isSafeInteger(a.expiresAt) && a.expiresAt > a.createdAt && (a.scheduleId === undefined || validAnnouncementId(a.scheduleId) && Number.isSafeInteger(a.occurrence))) || new Set(announcements.map((a) => a.id)).size !== announcements.length) throw new Error('Invalid state');
      this.state = { announcements, schedules };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load announcements. Preserve the file and restore a valid backup.'); }
  }
  snapshot() { return { ...structuredClone(this.state), serverNow: this.clock() }; }
  apply(action: AnnouncementAction, author: string, authorize: () => boolean = () => true): Promise<boolean> {
    return this.change((s, now) => {
      if (!authorize()) throw new AnnouncementError('接続が変わりました。再接続してから設定してください。');
      if (action.type === 'announcement-publish') {
        if (s.announcements.filter((a) => !a.scheduleId && a.category !== 'arena' && a.expiresAt > now).length >= 5) throw new AnnouncementError('同時に表示できる手動放送は5件までです。終了してから追加してください。');
        s.announcements.push({ id: randomUUID(), title: action.title, message: action.message, author, createdAt: now, expiresAt: now + action.durationMinutes * MINUTE });
      } else if (action.type === 'announcement-dismiss') {
        s.announcements = s.announcements.filter((a) => a.id !== action.id);
      } else {
        const current = s.schedules.find((e) => e.id === action.id);
        if ((current?.version ?? 0) !== action.expectedVersion) throw new AnnouncementError('ほかの人が予定を更新しました。一覧から開き直してください。');
        if (action.type === 'schedule-delete') {
          if (!current) throw new AnnouncementError('その予定は見つかりません。');
          s.schedules = s.schedules.filter((e) => e.id !== action.id);
          s.announcements = s.announcements.filter((a) => a.scheduleId !== action.id);
        } else {
          if (!current && s.schedules.length >= MAX_SCHEDULES) throw new AnnouncementError(`予定は${MAX_SCHEDULES}件まで登録できます。`);
          if (action.schedule.enabled && action.schedule.repeat === 'once' && action.schedule.startsAt <= now) throw new AnnouncementError('単発予定には、これからの開始日時を設定してください。');
          const timingChanged = current && (current.startsAt !== action.schedule.startsAt || current.repeat !== action.schedule.repeat);
          const schedule: Schedule = { ...action.schedule, id: action.id, version: (current?.version ?? 0) + 1, updatedBy: author,
            ...(current?.lastOccurrence !== undefined && !timingChanged ? { lastOccurrence: current.lastOccurrence } : {}) };
          s.schedules = [...s.schedules.filter((e) => e.id !== action.id), schedule];
          s.announcements = s.announcements.filter((a) => a.scheduleId !== action.id || !timingChanged && schedule.enabled);
          for (const a of s.announcements) if (a.scheduleId === action.id) {
            a.title = schedule.title; a.message = schedule.message; a.author = author; a.expiresAt = a.occurrence! + schedule.displayMinutes * MINUTE;
          }
        }
      }
    });
  }
  tick(): Promise<boolean> { return this.change(() => {}); }
  publishArena(id: string, message: string): Promise<boolean> {
    return this.change((s, now) => {
      if (s.announcements.some((entry) => entry.id === id)) return;
      const existing = s.announcements.filter((entry) => entry.category === 'arena');
      if (existing.length >= 5) s.announcements = s.announcements.filter((entry) => entry.id !== existing[0].id);
      s.announcements.push({ id, category: 'arena', title: '🏆 魔法闘技場の対戦結果', message, author: '魔法闘技場', createdAt: now, expiresAt: now + 3 * MINUTE });
    });
  }
  private change(edit: (s: AnnouncementState, now: number) => void): Promise<boolean> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state), now = this.clock();
      next.announcements = next.announcements.filter((a) => a.expiresAt > now);
      edit(next, now);
      for (const schedule of next.schedules) {
        const start = dueOccurrence(schedule, now);
        if (start === undefined || schedule.lastOccurrence !== undefined && start <= schedule.lastOccurrence) continue;
        schedule.lastOccurrence = start;
        next.announcements.push({ id: randomUUID(), title: schedule.title, message: schedule.message, author: schedule.updatedBy,
          createdAt: now, expiresAt: start + schedule.displayMinutes * MINUTE, scheduleId: schedule.id, occurrence: start });
      }
      next.announcements = next.announcements.filter((a) => a.expiresAt > now);
      if (JSON.stringify(next) === JSON.stringify(this.state)) return false;
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        const temp = this.file + '.tmp'; await writeFile(temp, JSON.stringify({ version: 1, ...next }) + '\n', { mode: 0o600 }); await rename(temp, this.file);
      }
      this.state = next; return true;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
}
