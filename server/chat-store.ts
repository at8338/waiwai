import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ChatMessage, ChatTarget, ChatThread } from '../src/game/chat.ts';
import { chatText } from '../src/game/chat.ts';
import { getRoom } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
import { validIdentity } from '../src/game/identity.ts';
export type ChatActor = { id: string; name: string; persistent: boolean; roomId: RoomId };
type Thread = { key: string; kind: string; room: string | null; a: string | null; b: string | null };
export class ChatError extends Error {}
export class ChatStore {
  private db: DatabaseSync;
  constructor(file = ':memory:') {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true, mode: 0o750 });
    this.db = new DatabaseSync(file, { timeout: 5000 });
    if (file !== ':memory:') chmodSync(file, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, name TEXT NOT NULL, persistent INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS threads(key TEXT PRIMARY KEY, kind TEXT NOT NULL, room TEXT, a TEXT, b TEXT);
      CREATE TABLE IF NOT EXISTS messages(seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, conversation TEXT NOT NULL REFERENCES threads(key), authorId TEXT NOT NULL, authorName TEXT NOT NULL, text TEXT NOT NULL, createdAt INTEGER NOT NULL, source TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS message_thread ON messages(conversation,seq);
      CREATE TABLE IF NOT EXISTS reads(account TEXT NOT NULL, conversation TEXT NOT NULL, through INTEGER NOT NULL, PRIMARY KEY(account,conversation));
      CREATE TABLE IF NOT EXISTS slack_outbox(message INTEGER PRIMARY KEY REFERENCES messages(seq), attempts INTEGER NOT NULL DEFAULT 0, nextAt INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending');
      CREATE TABLE IF NOT EXISTS chat_groups(id TEXT PRIMARY KEY, name TEXT NOT NULL, owner TEXT NOT NULL REFERENCES accounts(id));
      CREATE TABLE IF NOT EXISTS group_members(groupId TEXT NOT NULL REFERENCES chat_groups(id), account TEXT NOT NULL REFERENCES accounts(id), PRIMARY KEY(groupId,account));
      CREATE INDEX IF NOT EXISTS group_account ON group_members(account,groupId);
      PRAGMA user_version=2;`);
  }
  account(id: string, name: string, persistent: boolean): void {
    if (!validIdentity(id)) throw new ChatError('アカウントを確認できません。');
    this.db.prepare('INSERT INTO accounts VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,persistent=excluded.persistent WHERE accounts.name<>excluded.name OR accounts.persistent<>excluded.persistent').run(id, name, Number(persistent));
  }
  accountName(id: string): string | undefined { return this.db.prepare('SELECT name FROM accounts WHERE id=?').get(id)?.name as string | undefined; }
  groupMembers(id: string): { id: string; name: string }[] { return this.db.prepare('SELECT a.id,a.name FROM group_members m JOIN accounts a ON a.id=m.account WHERE groupId=? ORDER BY a.id').all(id) as { id: string; name: string }[]; }
  inGroup(id: string, actorId: string): boolean { return !!this.db.prepare('SELECT 1 FROM group_members WHERE groupId=? AND account=?').get(id, actorId); }
  createGroup(actor: ChatActor, id: string, name: string, peers: string[]): Extract<ChatTarget, { kind: 'group' }> {
    const members = [...new Set([actor.id, ...peers])].sort();
    if (!/^[a-f0-9-]{36}$/.test(id) || !chatText(name) || name.trim().length > 40 || members.length < 2 || members.length > 20 || !members.every(p => validIdentity(p) && !!this.accountName(p))) throw new ChatError('グループ名とメンバー（自分を含め2〜20人）を確認してください。');
    const existing = this.db.prepare('SELECT name,owner FROM chat_groups WHERE id=?').get(id);
    if (existing) {
      if (existing.owner !== actor.id || existing.name !== name.trim() || JSON.stringify(this.groupMembers(id).map(m => m.id)) !== JSON.stringify(members)) throw new ChatError('グループIDが再利用されています。');
      return { kind: 'group', groupId: id };
    }
    if ((this.db.prepare('SELECT COUNT(*) n FROM chat_groups WHERE owner=?').get(actor.id)!.n as number) >= 20) throw new ChatError('作成できるグループは20個までです。');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO chat_groups VALUES(?,?,?)').run(id, name.trim(), actor.id);
      for (const member of members) this.db.prepare('INSERT INTO group_members VALUES(?,?)').run(id, member);
      this.db.prepare('INSERT INTO threads VALUES(?,?,?,?,?)').run(`group:${id}`, 'group', null, null, null);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return { kind: 'group', groupId: id };
  }
  private thread(actor: ChatActor, target: ChatTarget, create = true): Thread {
    if (target.kind === 'room' && target.roomId !== actor.roomId) throw new ChatError('部屋チャットは、いまいる部屋で利用できます。');
    if (target.kind === 'dm' && (target.peerId === actor.id || !this.db.prepare('SELECT 1 FROM accounts WHERE id=?').get(target.peerId))) throw new ChatError('DMの相手が見つかりません。');
    if (target.kind === 'group' && !this.inGroup(target.groupId, actor.id)) throw new ChatError('このグループのメンバーだけが利用できます。');
    const pair = target.kind === 'dm' ? [actor.id, target.peerId].sort() : [];
    const key = target.kind === 'dm' ? 'dm:' + JSON.stringify(pair) : target.kind === 'room' ? `room:${target.roomId}` : target.kind === 'group' ? `group:${target.groupId}` : 'global';
    const thread = { key, kind: target.kind, room: target.kind === 'room' ? target.roomId : null, a: pair[0] ?? null, b: pair[1] ?? null };
    if (create) this.db.prepare('INSERT OR IGNORE INTO threads VALUES(?,?,?,?,?)').run(key, thread.kind, thread.room, thread.a, thread.b);
    return thread;
  }
  history(actor: ChatActor, target: ChatTarget, before = Number.MAX_SAFE_INTEGER) {
    const { key } = this.thread(actor, target);
    const rows = this.db.prepare('SELECT * FROM messages WHERE conversation=? AND seq<? ORDER BY seq DESC LIMIT 51').all(key, before) as ChatMessage[];
    return { conversation: key, messages: rows.slice(0, 50).reverse(), hasMore: rows.length > 50 };
  }
  append(actor: ChatActor, target: ChatTarget, text: string, actionId: string, shareSlack = false, source: 'waiwai' | 'slack' = 'waiwai'): { message: ChatMessage; fresh: boolean } {
    if (!chatText(text) || shareSlack && target.kind !== 'global') throw new ChatError('送信内容を確認してください。');
    const thread = this.thread(actor, target);
    const id = source === 'slack' ? actionId : `${actor.id}:${actionId}`;
    const old = this.db.prepare('SELECT * FROM messages WHERE id=?').get(id) as ChatMessage | undefined;
    if (old) { if (old.conversation !== thread.key || old.text !== text) throw new ChatError('送信IDが再利用されています。'); return { message: old, fresh: false }; }
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const row = this.db.prepare('INSERT INTO messages(id,conversation,authorId,authorName,text,createdAt,source) VALUES(?,?,?,?,?,?,?) RETURNING *').get(id, thread.key, actor.id, actor.name, text, Date.now(), source) as ChatMessage;
      if (shareSlack) this.db.prepare('INSERT INTO slack_outbox(message) VALUES(?)').run(row.seq);
      this.db.exec('COMMIT'); return { message: row, fresh: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  read(actor: ChatActor, target: ChatTarget, through: number): void {
    const { key } = this.thread(actor, target);
    // A client cannot acknowledge messages that have not been delivered yet.
    const latest = this.db.prepare('SELECT COALESCE(MAX(seq),0) value FROM messages WHERE conversation=?').get(key)!.value as number;
    if (through > latest || !Number.isSafeInteger(through) || through < 0) throw new ChatError('既読位置を確認してください。');
    this.db.prepare('INSERT INTO reads VALUES(?,?,?) ON CONFLICT(account,conversation) DO UPDATE SET through=MAX(through,excluded.through)').run(actor.id, key, through);
  }
  inbox(actor: ChatActor): ChatThread[] {
    this.thread(actor, { kind: 'global' }); this.thread(actor, { kind: 'room', roomId: actor.roomId });
    const threads = this.db.prepare("SELECT * FROM threads WHERE key='global' OR key=? OR (kind='dm' AND (a=? OR b=?)) OR key IN (SELECT 'group:' || groupId FROM group_members WHERE account=?)").all(`room:${actor.roomId}`, actor.id, actor.id, actor.id) as Thread[];
    return threads.map(t => {
      const peer = t.a === actor.id ? t.b : t.a;
      const target: ChatTarget = t.kind === 'global' ? { kind: 'global' } : t.kind === 'room' ? { kind: 'room', roomId: t.room as RoomId } : t.kind === 'group' ? { kind: 'group', groupId: t.key.slice(6) } : { kind: 'dm', peerId: peer! };
      const last = this.db.prepare('SELECT * FROM messages WHERE conversation=? ORDER BY seq DESC LIMIT 1').get(t.key) as ChatMessage | undefined;
      const unread = this.db.prepare('SELECT COUNT(*) n FROM messages WHERE conversation=? AND authorId<>? AND seq>COALESCE((SELECT through FROM reads WHERE account=? AND conversation=?),0)').get(t.key, actor.id, actor.id, t.key)!.n as number;
      return { target, conversation: t.key, name: target.kind === 'group' ? String(this.db.prepare('SELECT name FROM chat_groups WHERE id=?').get(target.groupId)!.name) : t.kind === 'global' ? '全館チャット' : t.kind === 'room' ? getRoom(t.room as RoomId).name : String(this.db.prepare('SELECT name FROM accounts WHERE id=?').get(peer!)?.name ?? 'メンバー'), unread, ...(last ? { last } : {}), ...(target.kind === 'group' ? { members: this.groupMembers(target.groupId) } : {}) };
    });
  }
  visible(actor: ChatActor, message: ChatMessage): boolean {
    if (message.conversation === 'global' || message.conversation === `room:${actor.roomId}`) return true;
    if (message.conversation.startsWith('group:')) return this.inGroup(message.conversation.slice(6), actor.id);
    return !!this.db.prepare("SELECT 1 FROM threads WHERE key=? AND kind='dm' AND (a=? OR b=?)").get(message.conversation, actor.id, actor.id);
  }
  nextSlack(now = Date.now()): (ChatMessage & { attempts: number }) | undefined { return this.db.prepare("SELECT m.*,o.attempts FROM slack_outbox o JOIN messages m ON m.seq=o.message WHERE o.state='pending' AND o.nextAt<=? ORDER BY m.seq LIMIT 1").get(now) as (ChatMessage & { attempts: number }) | undefined; }
  slackDone(seq: number): void { this.db.prepare("UPDATE slack_outbox SET state='sent' WHERE message=?").run(seq); }
  slackRetry(seq: number, seconds: number): void { this.db.prepare('UPDATE slack_outbox SET attempts=attempts+1,nextAt=? WHERE message=?').run(Date.now() + seconds * 1000, seq); }
  close(): void { this.db.close(); }
}
