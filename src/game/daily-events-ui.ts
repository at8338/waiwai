import { DAILY_EPISODES, episodeById, EVENT_THEMES } from './daily-event-catalog.ts';
import { birthdayOnDay } from './birthdays.ts';
import type { BirthdaySnapshot } from './birthdays.ts';
import { drawEventPreview } from './daily-event-art.ts';
import { eventHistory } from './daily-events.ts';
import type { DailyEventSnapshot, DailyEvent } from './daily-events.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { jstInput, jstLabel, JST } from './announcements.ts';
import type { AnnouncementSnapshot } from './announcements.ts';
import { calendarDay, calendarCells, recordedEvent, schedulesOnDay } from './office-calendar.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
const JOURNAL_KEY = 'waiwai:incident-discoveries:v1';
export class DailyEventsUI {
  private snapshot?: DailyEventSnapshot;
  private offset = 0;
  private room: RoomId = 'office';
  private connected = false;
  private found = new Set<string>();
  private history: DailyEvent[] = [];
  private schedules: AnnouncementSnapshot['schedules'] = [];
  private birthdays: BirthdaySnapshot['entries'] = [];
  private month = calendarDay(Date.now());
  private selectedDay = this.month;
  private lastDay = '';
  private refresh: ReturnType<typeof setInterval>;
  constructor(signal: AbortSignal, private visit: (room: RoomId) => void, private beforeOpen: () => boolean) {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '[]');
      if (Array.isArray(saved)) for (const id of saved.slice(-400)) if (typeof id === 'string' && /^\d{4}-\d\d-\d\d$/.test(id)) this.found.add(id);
    } catch { /* The journal is readable even when local browser storage is unavailable. */ }
    const listen = (id: string, fn: () => void) => el(id).addEventListener('click', fn, { signal });
    listen('daily-event-go', () => {
      const event = this.snapshot?.event; if (!event || !this.connected || this.now() >= event.endsAt) return;
      if (this.room === event.roomId) this.inspect(); else if (this.beforeOpen()) this.visit(event.roomId);
    });
    listen('event-journal-open', () => this.openJournal());
    listen('office-calendar-open', () => this.openCalendar());
    listen('event-detail-close', () => el<HTMLDialogElement>('event-detail-dialog').close());
    listen('event-journal-close', () => el<HTMLDialogElement>('event-journal-dialog').close());
    listen('office-calendar-close', () => el<HTMLDialogElement>('office-calendar-dialog').close());
    el('event-history-select').addEventListener('change', () => this.renderJournal(), { signal });
    listen('calendar-prev', () => this.shiftMonth(-1)); listen('calendar-next', () => this.shiftMonth(1));
    listen('calendar-today', () => { this.month = this.selectedDay = calendarDay(this.now()); this.renderCalendar(); });
    el('calendar-grid').addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-calendar-day]');
      if (button) { this.selectedDay = Number(button.dataset.calendarDay); this.renderCalendar(); }
    }, { signal });
    listen('calendar-schedule-edit', () => { el<HTMLDialogElement>('office-calendar-dialog').close(); el<HTMLButtonElement>('schedule-open').click(); });
    this.refresh = setInterval(() => {
      if (!this.snapshot) return;
      if (this.now() >= this.snapshot.event.endsAt) { el('daily-event-meta').textContent = '日付が変わりました。次の事件を接続先に確認しています…'; el<HTMLButtonElement>('daily-event-go').disabled = true; }
    }, 1000);
  }
  private now(): number { return Date.now() + this.offset; }
  setConnected(value: boolean): void { this.connected = value; this.renderBanner(); el<HTMLButtonElement>('calendar-schedule-edit').disabled = !value; }
  setRoom(room: RoomId): void { this.room = room; this.renderBanner(); }
  receive(snapshot: DailyEventSnapshot): void {
    this.snapshot = snapshot; this.offset = snapshot.serverNow - Date.now();
    this.history = eventHistory(snapshot.serverNow);
    if (this.lastDay !== snapshot.event.day) {
      this.lastDay = snapshot.event.day; this.selectedDay = this.month = snapshot.event.startsAt;
      const select = el<HTMLSelectElement>('event-history-select'), previous = select.value; select.replaceChildren();
      for (const event of this.history) { const option = new Option(`${event.day} · ${episodeById(event.episodeId)!.title}${this.found.has(event.day) ? ' ✓' : ''}`, event.day); select.add(option); }
      if (this.history.some((e) => e.day === previous)) select.value = previous;
    }
    this.renderBanner(); this.renderJournal(); this.renderCalendar();
  }
  receiveSchedules(state: AnnouncementSnapshot): void { this.schedules = state.schedules; this.renderCalendar(); }
  receiveBirthdays(state: BirthdaySnapshot): void { this.birthdays = state.entries; this.renderCalendar(); }
  private renderBanner(): void {
    const event = this.snapshot?.event;
    if (!event) { el('daily-event-title').textContent = '今日の事件を確認しています…'; return; }
    const episode = episodeById(event.episodeId)!;
    el('daily-event-title').textContent = episode.title;
    el('daily-event-meta').textContent = `${event.day} · ${getRoom(event.roomId).name} · ${this.connected ? '毎日0:00 JSTに更新' : '再接続を待っています'}`;
    const button = el<HTMLButtonElement>('daily-event-go'); button.disabled = !this.connected || this.now() >= event.endsAt;
    button.textContent = this.room === event.roomId ? '事件を調べる' : '現場を見に行く ↗';
    el('daily-event-panel').dataset.eventId = event.episodeId; el('daily-event-panel').dataset.eventRoom = event.roomId;
    el('daily-event-found').textContent = this.found.has(event.day) ? '✓ 発見済み' : '今日、どこかで小さな事件。';
  }
  inspect(): void {
    const event = this.snapshot?.event;
    if (!event || this.room !== event.roomId || !this.connected || this.now() >= event.endsAt || !this.beforeOpen()) return;
    this.found.add(event.day);
    this.found = new Set([...this.found].sort().slice(-400));
    let stored = true; try { localStorage.setItem(JOURNAL_KEY, JSON.stringify([...this.found])); } catch { stored = false; }
    this.fillDetail(event, 'event-detail');
    el('event-detail-stamp').textContent = stored ? '✓ 発見済み · このブラウザの図鑑に記録しました' : '✓ 発見済み · この画面を開いている間、記録します';
    el<HTMLDialogElement>('event-detail-dialog').showModal(); this.renderBanner();
    const option = [...el<HTMLSelectElement>('event-history-select').options].find((o) => o.value === event.day);
    if (option && !option.text.endsWith(' ✓')) option.text += ' ✓';
    this.renderJournal(); this.renderCalendar();
  }
  openJournal(day?: string): void {
    if (!this.beforeOpen()) return;
    if (day) el<HTMLSelectElement>('event-history-select').value = day;
    this.renderJournal(); el<HTMLDialogElement>('event-journal-dialog').showModal();
  }
  private fillDetail(event: DailyEvent, prefix: string): void {
    const episode = episodeById(event.episodeId)!;
    el(`${prefix}-title`).textContent = episode.title; el(`${prefix}-story`).textContent = episode.discovery;
    el(`${prefix}-meta`).textContent = `${event.day} · ${getRoom(event.roomId).name} · ${EVENT_THEMES[episode.theme]}`;
    drawEventPreview(el<HTMLCanvasElement>(`${prefix}-art`), episode);
  }
  private renderJournal(): void {
    const appeared = new Set(this.history.map((e) => e.episodeId));
    el('event-journal-progress').textContent = `${appeared.size} / ${DAILY_EPISODES.length} 種類が登場 · 現場で発見 ${this.history.filter((e) => this.found.has(e.day)).length} 件`;
    const selected = this.history.find((e) => e.day === el<HTMLSelectElement>('event-history-select').value) ?? this.history[0];
    el('event-journal-content').hidden = !selected;
    if (selected) { this.fillDetail(selected, 'event-history'); el('event-history-stamp').textContent = this.found.has(selected.day) ? '✓ あなたが現場で発見した事件' : '館内の記録から振り返る'; }
  }
  openCalendar(): void {
    if (!this.beforeOpen()) return;
    this.selectedDay = this.month = calendarDay(this.now()); this.renderCalendar(); el<HTMLDialogElement>('office-calendar-dialog').showModal();
  }
  private shiftMonth(delta: number): void {
    const d = new Date(this.month + JST), year = d.getUTCFullYear();
    if (delta < 0 && year <= 2000 || delta > 0 && year >= 2100) return;
    this.month = Date.UTC(year, d.getUTCMonth() + delta, 1) - JST; this.selectedDay = this.month; this.renderCalendar();
  }
  private renderCalendar(): void {
    const date = new Date(this.month + JST); el('calendar-month').textContent = `${date.getUTCFullYear()}年 ${date.getUTCMonth() + 1}月`;
    const grid = el('calendar-grid'); grid.replaceChildren();
    for (const day of calendarCells(this.month)) {
      if (day === null) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
      const event = recordedEvent(day, this.now()), meetings = schedulesOnDay(this.schedules, day), button = document.createElement('button');
      const birthdays = this.birthdays.filter((entry) => birthdayOnDay(entry, day));
      button.type = 'button'; button.dataset.calendarDay = String(day); button.setAttribute('aria-pressed', String(day === this.selectedDay));
      if (day === calendarDay(this.now())) button.setAttribute('aria-current', 'date');
      const number = document.createElement('strong'); number.textContent = String(new Date(day + JST).getUTCDate()); button.append(number);
      const tag = document.createElement('span'); tag.className = 'calendar-cell-tag'; tag.textContent = [meetings.length ? `予定 ${meetings.length}` : '', event ? '✦' : '', birthdays.length ? `🎂 ${birthdays.length}` : ''].filter(Boolean).join(' · '); button.append(tag);
      button.setAttribute('aria-label', `${jstInput(day).slice(0, 10)}、予定${meetings.length}件${event ? `、事件：${episodeById(event.episodeId)!.title}` : ''}${birthdays.length ? `、誕生日：${birthdays.map((entry) => entry.name).join('、')}` : ''}`);
      grid.append(button);
    }
    el('calendar-selected-date').textContent = `${jstInput(this.selectedDay).slice(0, 10)}（JST）`;
    const detail = el('calendar-day-detail'); detail.replaceChildren();
    const add = (tag: string, text: string) => { const node = document.createElement(tag); node.textContent = text; detail.append(node); return node; };
    const birthdays = this.birthdays.filter((entry) => birthdayOnDay(entry, this.selectedDay));
    if (birthdays.length) { add('h4', '🎂 お誕生日'); for (const entry of birthdays) add('p', `${entry.name}さん、おめでとう！`); }
    const incident = recordedEvent(this.selectedDay, this.now());
    if (incident) {
      add('h4', `✦ ${episodeById(incident.episodeId)!.title}`);
      add('p', `${getRoom(incident.roomId).name}${this.found.has(incident.day) ? ' · ✓ 発見済み' : ''}`);
      const button = add('button', '事件の記録を見る') as HTMLButtonElement; button.type = 'button';
      button.addEventListener('click', () => { el<HTMLDialogElement>('office-calendar-dialog').close(); this.openJournal(incident.day); }, { once: true });
    } else add('p', this.selectedDay > calendarDay(this.now()) ? '✦ この日の事件は、当日のお楽しみ。' : 'この日の事件の記録はありません。');
    const meetings = schedulesOnDay(this.schedules, this.selectedDay);
    add('h4', `予定・定例 ${meetings.length}件`);
    if (!meetings.length) add('p', 'この日の予定は登録されていません。');
    for (const { schedule, startsAt } of meetings) { add('strong', `${jstLabel(startsAt).slice(-9)} ${schedule.title}`); add('p', schedule.message); }
    el('calendar-sync-status').textContent = this.connected ? '館内で共有している予定を表示しています。JST / 停止中の予定は表示しません。' : '再接続を待っています。予定は最後に受信した内容です。';
  }
  destroy(): void { clearInterval(this.refresh); }
}
