import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { birthdayDay, birthdayOnDay, validBirthday } from '../src/game/birthdays.ts';
import type { BirthdayAction, BirthdaySnapshot } from '../src/game/birthdays.ts';
type Entry = { id: string; name: string; month: number; day: number; version: number };
type State = { entries: Entry[]; day: string; cheers: Record<string, string[]> };
const persistent = (id: string) => /^slack:[A-Z0-9]{1,40}:[A-Z0-9]{1,40}$/.test(id);
export class BirthdayError extends Error {}
export class BirthdayStore {
  private state: State = { entries: [], day: '', cheers: {} };
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  private clock: () => number;
  constructor(file?: string, clock = Date.now) {
    this.file = file; this.clock = clock;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8'); if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error('Too large');
      const s = JSON.parse(raw);
      if (s.version !== 1 || !Array.isArray(s.entries) || s.entries.length > 5000 || !s.entries.every((e: Entry) => e && persistent(e.id) && typeof e.name === 'string' && e.name.length > 0 && e.name.length <= 12 && validBirthday(e.month, e.day) && Number.isSafeInteger(e.version) && e.version > 0) ||
        new Set(s.entries.map((e: Entry) => e.id)).size !== s.entries.length || typeof s.day !== 'string' || s.day !== '' && !/^\d{4}-\d\d-\d\d$/.test(s.day) || !s.cheers || typeof s.cheers !== 'object' || Array.isArray(s.cheers) || Object.entries(s.cheers).some(([id, actors]) => !s.entries.some((e: Entry) => e.id === id) || !Array.isArray(actors) || actors.length > 5000 || !actors.every(persistent) || new Set(actors).size !== actors.length)) throw new Error('Invalid birthdays');
      this.state = { entries: s.entries, day: s.day, cheers: s.cheers };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load birthdays. Preserve the file and restore a valid backup.'); }
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
      if (action.type === 'birthday-save') {
        if (s.entries.length >= 5000) throw new BirthdayError('登録できる人数の上限に達しました。');
        s.entries.push({ id: selfId, name, month: action.month, day: action.day, version: (current?.version ?? 0) + 1 });
      }
    });
  }
  removeGuest(id: string): Promise<void> {
    if (persistent(id)) return Promise.resolve();
    return this.change((s) => { s.entries = s.entries.filter((entry) => entry.id !== id); delete s.cheers[id]; for (const target of Object.keys(s.cheers)) s.cheers[target] = s.cheers[target].filter((actor) => actor !== id); });
  }
  private change(edit: (s: State) => void): Promise<void> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state); edit(next);
      if (JSON.stringify(next) === JSON.stringify(this.state)) return;
      if (this.file) {
        const entries = next.entries.filter((entry) => persistent(entry.id));
        const cheers = Object.fromEntries(entries.filter((entry) => next.cheers[entry.id]).map((entry) => [entry.id, next.cheers[entry.id].filter(persistent)]));
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, entries, day: next.day, cheers }) + '\n', { mode: 0o600 }); await rename(this.file + '.tmp', this.file);
      }
      this.state = next;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
}
