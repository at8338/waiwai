import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { birthdayDay, birthdayOnDay, validBirthday, birthdayDateTime, birthdayCommentText, MAX_BIRTHDAY_COMMENTS } from '../src/game/birthdays.ts';
import { validAnnouncementId } from '../src/game/announcements.ts';
import type { BirthdayAction, BirthdaySnapshot, BirthdayComment, BirthdayThread } from '../src/game/birthdays.ts';
type Entry = { id: string; name: string; month: number; day: number; version: number };
type State = { entries: Entry[]; day: string; cheers: Record<string, string[]>; comments: BirthdayComment[] };
const persistent = (id: string) => /^slack:[A-Z0-9]{1,40}:[A-Z0-9]{1,40}$/.test(id);
export class BirthdayError extends Error {}
export class BirthdayStore {
  private state: State = { entries: [], day: '', cheers: {}, comments: [] };
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  private clock: () => number;
  constructor(file?: string, clock = Date.now) {
    this.file = file; this.clock = clock;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8'); if (Buffer.byteLength(raw) > 64 * 1024 * 1024) throw new Error('Too large');
      const s = JSON.parse(raw);
      if (s.version !== 1 || !Array.isArray(s.entries) || s.entries.length > 5000 || !s.entries.every((e: Entry) => e && persistent(e.id) && typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 12 && validBirthday(e.month, e.day) && Number.isSafeInteger(e.version) && e.version > 0) ||
        new Set(s.entries.map((e: Entry) => e.id)).size !== s.entries.length || typeof s.day !== 'string' || s.day !== '' && !/^\d{4}-\d\d-\d\d$/.test(s.day) || !s.cheers || typeof s.cheers !== 'object' || Array.isArray(s.cheers) || Object.entries(s.cheers).some(([id, actors]) => !s.entries.some((e: Entry) => e.id === id) || !Array.isArray(actors) || actors.length > 5000 || !actors.every(persistent) || new Set(actors).size !== actors.length)) throw new Error('Invalid birthdays');
      const comments = s.comments ?? [];
      if (!Array.isArray(comments) || comments.length > 50_000 || !comments.every((c: BirthdayComment) => c && validAnnouncementId(c.id) && persistent(c.authorId) && s.entries.some((e: Entry) => e.id === c.targetId && birthdayOnDay(e, birthdayDateTime(c.date) ?? NaN)) && typeof c.authorName === 'string' && c.authorName.length > 0 && c.authorName.length <= 12 && birthdayDateTime(c.date) !== undefined && birthdayCommentText(c.text) && Number.isSafeInteger(c.createdAt)) || new Set(comments.map((c: BirthdayComment) => c.id)).size !== comments.length) throw new Error('Invalid comments');
      this.state = { entries: s.entries, day: s.day, cheers: s.cheers, comments };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load birthdays. Preserve the file and restore a valid backup.'); }
  }
  thread(id: string, date: string): BirthdayThread {
    const time = birthdayDateTime(date), entry = this.state.entries.find(e => e.id === id);
    if (!entry || time === undefined || !birthdayOnDay(entry, time)) throw new BirthdayError('その日の誕生日の登録が見つかりません。');
    return { id, date, comments: structuredClone(this.state.comments.filter(c => c.targetId === id && c.date === date)), serverNow: this.clock() };
  }
  snapshot(selfId: string): BirthdaySnapshot {
    const now = this.clock();
    return { selfId, persistent: persistent(selfId), serverNow: now, entries: this.state.entries.map((entry) => {
      const actors = this.state.day === birthdayDay(now) && birthdayOnDay(entry, now) ? this.state.cheers[entry.id] ?? [] : [];
      return { ...entry, cheers: actors.length, cheered: actors.includes(selfId) };
    }) };
  }
  apply(action: BirthdayAction, selfId: string, name: string, authorize: () => boolean): Promise<void> {
    return this.change((s) => {
      if (!authorize()) throw new BirthdayError('接続が変わりました。再接続してから設定してください。');
      const now = this.clock(); if (s.day !== birthdayDay(now)) { s.day = birthdayDay(now); s.cheers = {}; }
      if (action.type === 'birthday-thread') return;
      if (action.type === 'birthday-comment') {
        const time = birthdayDateTime(action.date), entry = s.entries.find(e => e.id === action.id);
        if (!entry || time === undefined || !birthdayOnDay(entry, time)) throw new BirthdayError('その日の誕生日の登録が見つかりません。');
        if (Math.abs(new Date(now + 9 * 3600_000).getUTCFullYear() - Number(action.date.slice(0, 4))) > 1) throw new BirthdayError('コメントは昨年・今年・来年のお誕生日に送れます。');
        if (!birthdayCommentText(action.text)) throw new BirthdayError('コメントは1〜200文字で入力してください。');
        if (s.comments.some(c => c.id === action.actionId)) return;
        if (s.comments.filter(c => c.targetId === action.id && c.date === action.date).length >= MAX_BIRTHDAY_COMMENTS || s.comments.length >= 50_000) throw new BirthdayError('保存できるお祝いコメントの上限に達しました。');
        s.comments.push({ id: action.actionId, targetId: action.id, date: action.date, authorId: selfId, authorName: name, text: action.text.trim(), createdAt: now });
        return;
      }
      if (action.type === 'birthday-cheer') {
        const entry = s.entries.find((entry) => entry.id === action.id);
        if (!entry || !birthdayOnDay(entry, now)) throw new BirthdayError('今日がお誕生日の人にお祝いできます。');
        const actors = s.cheers[entry.id] ??= [];
        if (!actors.includes(selfId)) { if (actors.length >= 5000) throw new BirthdayError('お祝いがいっぱいです。'); actors.push(selfId); }
        return;
      }
      const current = s.entries.find((entry) => entry.id === selfId);
      if ((current?.version ?? 0) !== action.expectedVersion) throw new BirthdayError('別のタブで更新されました。開き直してください。');
      s.entries = s.entries.filter((entry) => entry.id !== selfId); delete s.cheers[selfId];
      if (action.type === 'birthday-delete' || current && (current.month !== action.month || current.day !== action.day)) s.comments = s.comments.filter(c => c.targetId !== selfId);
      if (action.type === 'birthday-save') {
        if (s.entries.length >= 5000) throw new BirthdayError('登録できる人数の上限に達しました。');
        s.entries.push({ id: selfId, name, month: action.month, day: action.day, version: (current?.version ?? 0) + 1 });
      }
    });
  }
  removeGuest(id: string): Promise<void> {
    if (persistent(id)) return Promise.resolve();
    return this.change((s) => { s.entries = s.entries.filter((entry) => entry.id !== id); delete s.cheers[id]; s.comments = s.comments.filter(c => c.targetId !== id && c.authorId !== id); for (const target of Object.keys(s.cheers)) s.cheers[target] = s.cheers[target].filter((actor) => actor !== id); });
  }
  private change(edit: (s: State) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state); edit(next);
      if (JSON.stringify(next) === JSON.stringify(this.state)) return;
      if (this.file) {
        const entries = next.entries.filter((entry) => persistent(entry.id));
        const cheers = Object.fromEntries(entries.filter((entry) => next.cheers[entry.id]).map((entry) => [entry.id, next.cheers[entry.id].filter(persistent)]));
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        const comments = next.comments.filter(c => persistent(c.targetId) && persistent(c.authorId));
        await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, entries, day: next.day, cheers, comments }) + '\n', { mode: 0o600 }); await rename(this.file + '.tmp', this.file);
      }
      this.state = next;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
}
