import { parseAnnouncementAction, jstInput, parseJstInput, jstLabel, nextOccurrence, REPEATS, MINUTE } from './announcements.ts';
import type { AnnouncementSnapshot, AnnouncementAction, Schedule, ScheduleDraft } from './announcements.ts';
const element = <T extends HTMLElement = HTMLElement>(id: string) => document.querySelector<T>(`#${id}`)!;
export class AnnouncementsUI {
  private state: AnnouncementSnapshot = { announcements: [], schedules: [], serverNow: Date.now() };
  private connected = false;
  private ready = false;
  private offset = 0;
  private pending?: { actionId: string; channel: 'broadcast' | 'schedule'; kind: AnnouncementAction['type']; resetEditor: boolean };
  private timer?: ReturnType<typeof setTimeout>;
  private refresh: ReturnType<typeof setInterval>;
  private editId: string = crypto.randomUUID();
  private editVersion = 0;
  private broadcastForm = element<HTMLFormElement>('broadcast-form');
  private scheduleForm = element<HTMLFormElement>('schedule-form');
  private bannerKey = '';
  private scheduleKey = '';
  constructor(signal: AbortSignal, private send: (action: AnnouncementAction) => boolean, private open: () => void) {
    const listen = (id: string, fn: () => void) => element(id).addEventListener('click', fn, { signal });
    listen('broadcast-open', () => { this.open(); this.status('broadcast', ''); element<HTMLDialogElement>('broadcast-dialog').showModal(); });
    listen('schedule-open', () => { this.open(); this.status('schedule', ''); this.render(); element<HTMLDialogElement>('schedule-dialog').showModal(); });
    for (const id of ['broadcast', 'schedule']) listen(`${id}-close`, () => element<HTMLDialogElement>(`${id}-dialog`).close());
    listen('schedule-new', () => this.resetEditor()); listen('schedule-cancel-edit', () => this.resetEditor());
    element('broadcast-banner').addEventListener('click', (event) => {
      const id = (event.target as Element).closest<HTMLElement>('[data-dismiss]')?.dataset.dismiss;
      if (id) this.request({ type: 'announcement-dismiss', id, actionId: crypto.randomUUID() }, 'broadcast');
    }, { signal });
    element('schedule-list').addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-schedule-id]');
      const s = this.state.schedules.find((s) => s.id === button?.dataset.scheduleId); if (!s || !button) return;
      if (button.dataset.action === 'edit') this.edit(s);
      if (button.dataset.action === 'toggle') this.request({ type: 'schedule-save', id: s.id, expectedVersion: s.version, schedule: { ...s, enabled: !s.enabled }, actionId: crypto.randomUUID() }, 'schedule');
      if (button.dataset.action === 'delete') this.request({ type: 'schedule-delete', id: s.id, expectedVersion: s.version, actionId: crypto.randomUUID() }, 'schedule');
    }, { signal });
    this.broadcastForm.addEventListener('submit', (event) => {
      event.preventDefault(); const f = new FormData(this.broadcastForm);
      this.request({ type: 'announcement-publish', title: String(f.get('title')).trim(), message: String(f.get('message')).trim(), durationMinutes: Number(f.get('durationMinutes')), actionId: crypto.randomUUID() }, 'broadcast');
    }, { signal });
    this.scheduleForm.addEventListener('submit', (event) => {
      event.preventDefault(); const f = new FormData(this.scheduleForm), startsAt = parseJstInput(String(f.get('startsAt')));
      if (startsAt === undefined) { this.status('schedule', '日本時間の開始日時を入力してください。'); return; }
      const schedule: ScheduleDraft = { title: String(f.get('title')).trim(), message: String(f.get('message')).trim(), startsAt, repeat: String(f.get('repeat')) as ScheduleDraft['repeat'],
        leadMinutes: Number(f.get('leadMinutes')), displayMinutes: Number(f.get('displayMinutes')), enabled: f.has('enabled') };
      this.request({ type: 'schedule-save', id: this.editId, expectedVersion: this.editVersion, schedule, actionId: crypto.randomUUID() }, 'schedule', true);
    }, { signal });
    this.resetEditor(); this.render();
    this.refresh = setInterval(() => this.render(), 1000);
  }
  setConnected(value: boolean): void {
    this.connected = value; if (!value) { this.ready = false; this.cancelPending(); }
    this.render();
  }
  snapshot(state: AnnouncementSnapshot & { warning?: string }): void {
    this.state = state; this.offset = state.serverNow - Date.now(); this.ready = true;
    element('broadcast-warning').textContent = state.warning ?? ''; this.render();
  }
  result(id: string, error?: string): void {
    if (this.pending?.actionId !== id) return;
    const { channel, kind, resetEditor } = this.pending; this.cancelPending();
    this.status(channel, error ?? (kind === 'announcement-publish' ? '全フロアに放送しました。' : kind === 'announcement-dismiss' ? '放送を終了しました。' : kind === 'schedule-delete' ? '予定を削除しました。' : '予定を共有・保存しました。'));
    if (!error && kind === 'announcement-publish') this.broadcastForm.reset();
    if (!error && resetEditor) this.resetEditor(false);
    this.render();
  }
  destroy(): void { clearInterval(this.refresh); this.cancelPending(); }
  private now(): number { return Date.now() + this.offset; }
  private status(channel: 'broadcast' | 'schedule', text: string): void { element(`${channel}-form-status`).textContent = text; }
  private cancelPending(): void { clearTimeout(this.timer); this.pending = undefined; }
  private request(action: AnnouncementAction, channel: 'broadcast' | 'schedule', resetEditor = false): void {
    if (this.pending || !this.connected || !this.ready) return;
    if (!parseAnnouncementAction(action as unknown as Record<string, unknown>)) { this.status(channel, 'タイトル・本文・開始日時を確認してください。空白だけの入力は使えません。'); return; }
    if (!this.send(action)) { this.status(channel, '再接続してから設定してください。'); return; }
    this.pending = { actionId: action.actionId, channel, kind: action.type, resetEditor }; this.status(channel, '保存しています…');
    this.timer = setTimeout(() => { this.pending = undefined; this.status(channel, '応答を確認できませんでした。一覧に反映されているか確認してください。'); this.render(); }, 8000);
    this.render();
  }
  private resetEditor(clearStatus = true): void {
    this.editId = crypto.randomUUID(); this.editVersion = 0; this.scheduleForm.reset();
    this.scheduleForm.querySelector<HTMLInputElement>('[name="startsAt"]')!.value = jstInput(Math.ceil((this.now() + 10 * MINUTE) / MINUTE) * MINUTE);
    element('schedule-editor-title').textContent = '新しい予定'; if (clearStatus) this.status('schedule', '');
  }
  private edit(s: Schedule): void {
    this.editId = s.id; this.editVersion = s.version;
    for (const name of ['title', 'message', 'repeat', 'leadMinutes', 'displayMinutes'] as const) this.scheduleForm.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(`[name="${name}"]`)!.value = String(s[name]);
    this.scheduleForm.querySelector<HTMLInputElement>('[name="startsAt"]')!.value = jstInput(s.startsAt);
    this.scheduleForm.querySelector<HTMLInputElement>('[name="enabled"]')!.checked = s.enabled;
    element('schedule-editor-title').textContent = '予定を編集'; this.status('schedule', '変更して保存できます。');
    this.scheduleForm.querySelector<HTMLInputElement>('[name="title"]')!.focus();
  }
  private render(): void {
    const now = this.now(), disabled = !this.connected || !this.ready || !!this.pending;
    for (const id of ['broadcast-open', 'schedule-open']) element<HTMLButtonElement>(id).disabled = !this.connected || !this.ready;
    const active = this.state.announcements.filter((a) => a.expiresAt > now).sort((a, b) => b.createdAt - a.createdAt);
    const bannerKey = JSON.stringify(active);
    if (bannerKey !== this.bannerKey) {
      this.bannerKey = bannerKey; const banner = element('broadcast-banner'); banner.replaceChildren();
      for (const a of active) {
        const card = document.createElement('article'); card.className = 'broadcast-card'; card.dataset.announcementId = a.id;
        const title = document.createElement('strong'); title.textContent = a.title;
        const text = document.createElement('p'); text.textContent = a.message;
        const meta = document.createElement('small'); meta.textContent = `${a.scheduleId ? '予定の自動放送' : `${a.author}から`} · ${a.occurrence ? jstLabel(a.occurrence) + ' 開始' : jstLabel(a.createdAt)}`;
        const end = document.createElement('button'); end.type = 'button'; end.dataset.dismiss = a.id; end.textContent = '放送を終了'; end.setAttribute('aria-label', `${a.title}の放送を終了`);
        card.append(title, text, meta, end); banner.append(card);
      }
    }
    element('broadcast-quiet').hidden = active.length > 0;
    element('broadcast-quiet').textContent = !this.connected ? '再接続中です。放送の更新を待っています。' : 'ただいま放送はありません。';
    const schedules = this.state.schedules.map((s) => ({ s, next: nextOccurrence(s, now) }));
    schedules.sort((a, b) => (a.next ?? Infinity) - (b.next ?? Infinity) || a.s.title.localeCompare(b.s.title, 'ja'));
    const scheduleKey = JSON.stringify(schedules);
    if (scheduleKey !== this.scheduleKey) {
      this.scheduleKey = scheduleKey; const list = element('schedule-list'); list.replaceChildren();
      for (const { s, next } of schedules) {
        const li = document.createElement('li'); li.dataset.scheduleId = s.id;
        const title = document.createElement('strong'); title.textContent = s.title;
        const when = document.createElement('p'); when.textContent = `${REPEATS[s.repeat]} · ${!s.enabled ? '停止中' : next ? `次回 ${jstLabel(next)}` : '終了した予定'} · ${s.leadMinutes ? `${s.leadMinutes}分前から告知` : '開始時に告知'}`;
        const text = document.createElement('p'); text.textContent = s.message;
        const author = document.createElement('small'); author.textContent = `最終設定：${s.updatedBy}`;
        const actions = document.createElement('div'); actions.className = 'schedule-row-actions';
        for (const [action, name] of [['edit', '編集'], ['toggle', s.enabled ? '停止' : '再開'], ['delete', '削除']]) {
          const b = document.createElement('button'); b.type = 'button'; b.dataset.scheduleId = s.id; b.dataset.action = action; b.textContent = name; b.setAttribute('aria-label', `${s.title}を${name}`); actions.append(b);
        }
        li.append(title, when, text, author, actions); list.append(li);
      }
    }
    element('schedule-empty').hidden = schedules.length > 0;
    for (const control of document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('#broadcast-form input, #broadcast-form textarea, #broadcast-form select, #broadcast-form button[type="submit"], #schedule-form input, #schedule-form textarea, #schedule-form select, #schedule-form button, #schedule-list button, #schedule-new, [data-dismiss]')) control.disabled = disabled;
  }
}
