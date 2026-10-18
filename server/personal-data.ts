import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { OfficeAuthService } from './auth.ts';
import { userIdentity, persistentIdentity } from '../src/game/identity.ts';
import { PERSONAL_KEYS, personalKey, personalValue, personalBundle, mergeCollection } from '../src/game/personal-data.ts';
import type { PersonalKey, PersonalSnapshot } from '../src/game/personal-data.ts';
export class PersonalConflict extends Error {}
export class PersonalStore {
  private db: DatabaseSync;
  constructor(file = ':memory:') {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o750 });
    this.db = new DatabaseSync(file, { timeout: 5000 });
    if (file !== ':memory:') chmodSync(file, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS personal_records(account TEXT NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(account,kind));`);
  }
  snapshot(account: string): PersonalSnapshot {
    if (!persistentIdentity(account)) throw new Error('ログインが必要です。');
    const records: PersonalSnapshot['records'] = {};
    for (const row of this.db.prepare('SELECT kind,value,revision FROM personal_records WHERE account=?').all(account)) {
      if (personalKey(row.kind)) records[row.kind] = { value: JSON.parse(row.value as string), revision: row.revision as number };
    }
    return { accountId: account, records };
  }
  private put(account: string, key: PersonalKey, value: unknown): void {
    this.db.prepare('INSERT INTO personal_records VALUES(?,?,?,1) ON CONFLICT(account,kind) DO UPDATE SET value=excluded.value,revision=personal_records.revision+1').run(account, key, JSON.stringify(value));
  }
  save(account: string, key: PersonalKey, value: unknown, revision: number): PersonalSnapshot {
    const parsed = personalValue(key, value);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.snapshot(account).records[key];
      const collection = key === PERSONAL_KEYS[2] || key === PERSONAL_KEYS[3];
      // Collection updates are unions. Settings use compare-and-swap to stop stale tabs overwriting newer choices.
      if (!collection && (current?.revision ?? 0) !== revision) throw new PersonalConflict('別の画面で設定が変更されました。再読み込みして確認してください。');
      const next = collection ? mergeCollection(key, current?.value, parsed) : parsed;
      if (JSON.stringify(current?.value) !== JSON.stringify(next)) this.put(account, key, next);
      this.db.exec('COMMIT'); return this.snapshot(account);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  import(account: string, data: unknown): PersonalSnapshot {
    const bundle = personalBundle(data);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.snapshot(account);
      for (const key of PERSONAL_KEYS) if (Object.hasOwn(bundle, key)) {
        const old = current.records[key];
        // Keep existing server settings; merge discoveries. Re-importing is safe.
        const next = key === PERSONAL_KEYS[2] || key === PERSONAL_KEYS[3] ? mergeCollection(key, old?.value, bundle[key]) : old?.value ?? bundle[key];
        if (JSON.stringify(old?.value) !== JSON.stringify(next)) this.put(account, key, next);
      }
      this.db.exec('COMMIT'); return this.snapshot(account);
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close(): void { this.db.close(); }
}
export class PersonalService {
  readonly store: PersonalStore;
  private auth: OfficeAuthService;
  constructor(auth: OfficeAuthService, file?: string) { this.auth = auth; this.store = new PersonalStore(file); }
  async handle(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    if (request.url?.split('?')[0] !== '/api/personal') return false;
    response.setHeader('Cache-Control', 'no-store'); response.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status: number, body: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); };
    const identity = this.auth.identify(request);
    if (!identity || !this.auth.canJoin(request)) { reply(401, { error: 'ログインが必要です。' }); return true; }
    const account = userIdentity(identity.user);
    if (request.method === 'GET') { reply(200, this.store.snapshot(account)); return true; }
    if (request.method !== 'POST') { reply(405, { error: 'Method not allowed' }); return true; }
    let sameOrigin = false;
    try { const url = new URL(request.headers.origin ?? ''); sameOrigin = ['http:', 'https:'].includes(url.protocol) && url.host === request.headers.host; } catch { /* Invalid origin. */ }
    if (!sameOrigin || !request.headers['content-type']?.startsWith('application/json')) { reply(403, { error: '送信元を確認できません。' }); return true; }
    try {
      let size = 0; const chunks: Buffer[] = [];
      for await (const chunk of request) { size += chunk.length; if (size > 512 * 1024) { reply(413, { error: 'データが大きすぎます。' }); return true; } chunks.push(Buffer.from(chunk)); }
      // Logout/expiry during upload cannot write to a revoked session.
      if (this.auth.identify(request)?.id !== identity.id || !this.auth.canJoin(request)) { reply(401, { error: 'もう一度ログインしてください。' }); return true; }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!data || data.accountId !== account) { reply(409, { error: 'アカウントが変わりました。再読み込みしてください。' }); return true; }
      if (data.action === 'import') reply(200, this.store.import(account, data.records));
      else if (data.action === 'save' && personalKey(data.key)) reply(200, this.store.save(account, data.key, data.value, data.revision));
      else reply(400, { error: '保存内容を確認してください。' });
    } catch (error) {
      reply(error instanceof PersonalConflict ? 409 : 400, { error: error instanceof PersonalConflict ? error.message : '保存できませんでした。データ形式を確認して、もう一度お試しください。' });
    }
    return true;
  }
}
