import { PERSONAL_KEYS, personalBundle, personalKey, mergeCollection } from './personal-data.ts';
import type { PersonalKey, PersonalSnapshot } from './personal-data.ts';
export type PersonalStorage = Pick<Storage, 'getItem' | 'setItem'>;
/** Authenticated data never falls back to unscoped localStorage. */
export class AccountStorage implements PersonalStorage {
  private values = new Map<PersonalKey, unknown>();
  private revisions = new Map<PersonalKey, number>();
  private pending = new Map<PersonalKey, unknown>();
  private running?: Promise<void>;
  private blocked = false;
  error = '';
  notify: () => void = () => {};
  readonly accountId: string;
  private request: typeof fetch;
  constructor(accountId: string, request: typeof fetch = (input, init) => fetch(input, init)) { this.accountId = accountId; this.request = request; }
  private accept(snapshot: PersonalSnapshot, only?: PersonalKey): void {
    if (snapshot.accountId !== this.accountId) { this.blocked = true; throw new Error('アカウントが変わりました。再読み込みしてください。'); }
    for (const key of only ? [only] : PERSONAL_KEYS) {
      const record = snapshot.records[key];
      this.revisions.set(key, record?.revision ?? 0);
      if (!this.pending.has(key)) {
        if (record) this.values.set(key, record.value); else this.values.delete(key);
      }
    }
  }
  async load(): Promise<void> {
    const response = await this.request('/api/personal', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('ユーザーデータを読み込めません。再読み込みしてください。');
    this.accept(await response.json());
  }
  getItem(key: string): string | null { return personalKey(key) && this.values.has(key) ? JSON.stringify(this.values.get(key)) : null; }
  setItem(key: string, raw: string): void {
    if (!personalKey(key)) throw new Error('Unknown personal setting');
    const value = personalBundle({ [key]: JSON.parse(raw) })[key];
    this.values.set(key, value); this.pending.set(key, value);
    if (!this.error) void this.flush();
    this.notify();
  }
  private async post(body: Record<string, unknown>): Promise<PersonalSnapshot> {
    const response = await this.request('/api/personal', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, accountId: this.accountId }), signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      if ([401, 409].includes(response.status)) this.blocked = true;
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'サーバーに保存できません。再試行してください。');
    }
    return response.json();
  }
  flush(): Promise<void> {
    if (this.running) return this.running;
    if (this.blocked) return Promise.resolve();
    this.error = '';
    this.running = (async () => {
      while (this.pending.size) {
        const [key, value] = this.pending.entries().next().value!;
        this.pending.delete(key);
        try {
          const snapshot = await this.post({ action: 'save', key, value, revision: this.revisions.get(key) ?? 0 });
          // A request may finish while another edit is queued. Do not replace that newer edit.
          if (this.pending.has(key) && (key === PERSONAL_KEYS[2] || key === PERSONAL_KEYS[3])) {
            const merged = mergeCollection(key, snapshot.records[key]?.value, this.pending.get(key)); this.pending.set(key, merged); this.values.set(key, merged);
          }
          this.accept(snapshot, key);
        } catch (error) {
          if (!this.pending.has(key)) this.pending.set(key, value);
          this.error = error instanceof Error ? error.message : 'サーバーに保存できません。'; break;
        }
      }
    })().finally(() => { this.running = undefined; this.notify(); });
    return this.running;
  }
  get dirty(): boolean { return !!this.running || this.pending.size > 0; }
  get needsReload(): boolean { return this.blocked; }
  async import(records: unknown): Promise<void> {
    await this.flush(); if (this.dirty || this.error || this.blocked) throw new Error(this.error || '保存が終わってから引き継いでください。');
    this.accept(await this.post({ action: 'import', records: personalBundle(records) }));
  }
}
let account: AccountStorage | undefined;
let disabled = false;
export const personalStorage: PersonalStorage = {
  getItem: key => account ? account.getItem(key) : disabled ? null : localStorage.getItem(key),
  setItem: (key, value) => { if (account) account.setItem(key, value); else if (!disabled) localStorage.setItem(key, value); },
};
export const serverPersonalData = () => !!account;
export async function configurePersonalStorage(accountId?: string, unavailable = false): Promise<void> {
  disabled = unavailable; account = undefined;
  if (accountId) { account = new AccountStorage(accountId); await account.load(); }
}
export async function finishPersonalWrites(): Promise<boolean> {
  if (!account) return true;
  await account.flush(); return !account.dirty && !account.error;
}
function readBundle(storage: Pick<Storage, 'getItem'>): Partial<Record<PersonalKey, unknown>> {
  const records = Object.fromEntries(PERSONAL_KEYS.flatMap(key => { const raw = storage.getItem(key); return raw === null ? [] : [[key, JSON.parse(raw)]]; }));
  return personalBundle(records);
}
export function setupPersonalDataUI(name: string): void {
  const section = document.createElement('section'); section.className = 'personal-data-section';
  section.innerHTML = '<h2 class="section-label">設定と図鑑の保存</h2><p data-personal-status role="status"></p><button data-personal-retry hidden>保存を再試行</button><button data-personal-open>データを引き継ぐ / 書き出す</button>';
  document.querySelector('.profile-section')!.after(section);
  const status = section.querySelector<HTMLElement>('[data-personal-status]')!, retry = section.querySelector<HTMLButtonElement>('[data-personal-retry]')!;
  const update = () => {
    status.textContent = account ? account.error ? `未保存：${account.error}` : account.dirty ? 'アカウントに保存中…' : '設定と図鑑は、ログインしたアカウントに保存します。' : disabled ? 'ログイン状態を確認できません。再確認まで設定・図鑑の保存を停止しています。' : 'ゲストの記録はこのブラウザだけに保存します。ログイン後に引き継げます。';
    retry.hidden = !account?.error; retry.textContent = account?.needsReload ? '再読み込みして確認' : '保存を再試行';
  };
  if (account) account.notify = update; update();
  retry.onclick = () => { if (account?.needsReload) location.reload(); else void account?.flush(); };
  window.addEventListener('beforeunload', event => { if (account?.dirty) { event.preventDefault(); event.returnValue = ''; } });
  const dialog = document.createElement('dialog'); dialog.className = 'personal-data-dialog'; dialog.setAttribute('aria-label', 'データの引き継ぎ');
  dialog.innerHTML = '<h2>設定と図鑑を引き継ぐ</h2><p data-import-account></p><p>取り込むのは見た目・バディ・ポケモン図鑑・事件の発見記録です。既存のアカウント設定を優先し、発見記録は追加します。元データは削除しません。</p><p>別のURLへ移るときは、元のURLで書き出して、移行先でこのファイルを選んでください。</p><button data-export>現在の記録を書き出す</button><button data-export-legacy>以前のブラウザの記録を書き出す</button><hr><button data-local>このブラウザの以前の記録を選ぶ</button><label>引き継ぎファイルを選ぶ<input data-file type="file" accept="application/json,.json"></label><p data-import-status role="status"></p><button data-import disabled>このアカウントへ取り込む</button><form method="dialog"><button>閉じる</button></form>';
  document.body.append(dialog);
  dialog.querySelector('[data-import-account]')!.textContent = account ? `引き継ぎ先：${name}（${account.accountId}）` : '引き継ぎはログインしてから行えます。ゲストでも書き出せます。';
  let selected: Partial<Record<PersonalKey, unknown>> | undefined;
  const message = dialog.querySelector<HTMLElement>('[data-import-status]')!, submit = dialog.querySelector<HTMLButtonElement>('[data-import]')!;
  const choose = (bundle: unknown) => {
    selected = personalBundle(bundle); const count = Object.keys(selected).length;
    message.textContent = count ? `${Object.entries(selected).map(([key, value]) => key === PERSONAL_KEYS[0] ? 'アバター設定' : key === PERSONAL_KEYS[1] ? 'バディ設定' : key === PERSONAL_KEYS[2] ? `ポケモン${(value as unknown[]).length}種類` : `事件${(value as unknown[]).length}件`).join('・')}を選択しました。上記のアカウントへ取り込みます。` : '引き継ぐ記録はありません。'; submit.disabled = !account || !count;
  };
  section.querySelector<HTMLButtonElement>('[data-personal-open]')!.onclick = () => { selected = undefined; submit.disabled = true; message.textContent = ''; dialog.showModal(); };
  dialog.querySelector<HTMLButtonElement>('[data-local]')!.onclick = () => { selected = undefined; submit.disabled = true; try { choose(readBundle(localStorage)); } catch { message.textContent = '以前の記録を読み込めませんでした。元データは変更していません。'; } };
  dialog.querySelector<HTMLInputElement>('[data-file]')!.onchange = async event => {
    selected = undefined; submit.disabled = true;
    try {
      const input = event.target as HTMLInputElement, file = input.files?.[0]; if (!file) return;
      if (file.size > 512 * 1024) throw new Error();
      const bundle = JSON.parse(await file.text()); if (bundle.format !== 'waiwai-personal-v1') throw new Error(); choose(bundle.records);
    } catch { message.textContent = 'Waiwaiから書き出した引き継ぎファイルを選んでください。'; }
  };
  const exportData = (storage: Pick<Storage, 'getItem'>) => {
    try {
      const records = readBundle(storage), blob = new Blob([JSON.stringify({ format: 'waiwai-personal-v1', records }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = 'waiwai-personal-data.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message.textContent = '引き継ぎファイルを書き出しました。';
    } catch { message.textContent = '書き出せませんでした。'; }
  };
  dialog.querySelector<HTMLButtonElement>('[data-export]')!.onclick = () => exportData(personalStorage);
  dialog.querySelector<HTMLButtonElement>('[data-export-legacy]')!.onclick = () => exportData(localStorage);
  submit.onclick = async () => {
    if (!account || !selected) return; submit.disabled = true;
    try { await account.import(selected); location.reload(); } catch (error) { message.textContent = error instanceof Error ? error.message : '引き継げませんでした。'; submit.disabled = false; }
  };
}
