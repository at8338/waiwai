import { readFileSync, mkdirSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../src/slack/auth.ts';
import type { Member } from '../src/game/directory.ts';
import { persistentIdentity, userIdentity } from '../src/game/identity.ts';
import type { OfficeSpace, SpaceMembership, SpaceAction, SpaceSnapshot } from '../src/game/spaces.ts';
import { spaceIdValid } from '../src/game/spaces.ts';
import { WorldPolicyStore } from './world-policy.ts';

type State = { version: 1; revision: number; administrator?: string; spaces: OfficeSpace[]; memberships: SpaceMembership[] };
export class SpaceError extends Error {}
const validName = (name: unknown): name is string => typeof name === 'string' && name === name.trim() && name.length > 0 && [...name].length <= 40 && !/[\u0000-\u001f\u007f]/.test(name);
export class SpaceStore {
  private state: State;
  private file?: string;
  private authority: WorldPolicyStore;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(file: string | undefined, authority: WorldPolicyStore, legacyMembers: readonly Member[] = []) {
    this.file = file; this.authority = authority;
    this.state = { version: 1, revision: 0, spaces: [{ id: 'default', name: 'Waiwai', enabled: true }], memberships: legacyMembers.map(m => ({ accountId: m.id, spaceIds: ['default'] })) };
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > 4 * 1024 * 1024) throw new Error('Too large');
      const s = JSON.parse(raw) as State;
      if (s.version !== 1 || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.spaces) || !s.spaces.length || s.spaces.length > 50 ||
        !s.spaces.every(p => p && spaceIdValid(p.id) && validName(p.name) && typeof p.enabled === 'boolean') || !s.spaces.some(p => p.id === 'default') || !s.spaces.some(p => p.enabled) || new Set(s.spaces.map(p => p.id)).size !== s.spaces.length ||
        !Array.isArray(s.memberships) || s.memberships.length > 5000 || new Set(s.memberships.map(m => m?.accountId)).size !== s.memberships.length ||
        !s.memberships.every(m => m && persistentIdentity(m.accountId) && Array.isArray(m.spaceIds) && new Set(m.spaceIds).size === m.spaceIds.length && m.spaceIds.every(id => s.spaces.some(p => p.id === id))) ||
        s.administrator !== undefined && !persistentIdentity(s.administrator)) throw new Error('Invalid registry');
      this.state = s;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load server registry. Preserve the file and restore a valid backup.');
      // Persist the one-time migration before recording any new, unassigned users.
      mkdirSync(dirname(file), { recursive: true, mode: 0o750 });
      const tmp = `${file}.${randomUUID()}.tmp`;
      try { writeFileSync(tmp, JSON.stringify(this.state) + '\n', { mode: 0o600 }); renameSync(tmp, file); }
      finally { try { unlinkSync(tmp); } catch { /* Already renamed. */ } }
    }
  }
  isAdministrator(user?: AuthUser): boolean {
    if (!user) return false;
    const explicit = this.authority.administratorAccountId();
    const pinned = explicit ?? this.state.administrator;
    return pinned ? userIdentity(user) === pinned : this.authority.isAdministrator(user);
  }
  all(): OfficeSpace[] { return structuredClone(this.state.spaces); }
  assigned(id: string, spaceId: string): boolean { return !!this.state.memberships.find(m => m.accountId === id)?.spaceIds.includes(spaceId); }
  allowed(spaceId: string, user?: AuthUser, guestAllowed = false): boolean {
    const space = this.state.spaces.find(s => s.id === spaceId);
    if (!space?.enabled) return false;
    return user ? this.isAdministrator(user) || this.assigned(userIdentity(user), spaceId) : guestAllowed && spaceId === 'default';
  }
  snapshot(user: AuthUser | undefined, members: readonly Member[], guestAllowed = false): SpaceSnapshot {
    const administrator = this.isAdministrator(user);
    return { revision: this.state.revision, administrator,
      spaces: this.all().filter(s => administrator || this.allowed(s.id, user, guestAllowed)),
      ...(administrator ? { members: members.map(m => ({ id: m.id, name: m.name, spaceIds: [...(this.state.memberships.find(a => a.accountId === m.id)?.spaceIds ?? [])] })) } : {}) };
  }
  async pin(user: AuthUser | undefined): Promise<void> {
    if (!this.isAdministrator(user) || this.state.administrator) return;
    try { await this.edit(user!, this.state.revision, () => {}); }
    catch (error) { if (!this.state.administrator || !this.isAdministrator(user)) throw error; }
  }
  apply(action: SpaceAction, user: AuthUser | undefined, members: readonly Member[], active: () => boolean = () => true): Promise<void> {
    return this.edit(user, action.revision, next => {
      if (action.type === 'create') {
        if (!validName(action.name) || next.spaces.length >= 50 || next.spaces.some(s => s.name === action.name)) throw new SpaceError('重複しない名前を40文字以内で指定してください。サーバーは50個までです。');
        next.spaces.push({ id: randomUUID(), name: action.name, enabled: true });
      } else if (action.type === 'update') {
        const space = next.spaces.find(s => s.id === action.id);
        if (!space || !validName(action.name) || typeof action.enabled !== 'boolean' || next.spaces.some(s => s.id !== action.id && s.name === action.name)) throw new SpaceError('サーバー名と公開状態を確認してください。');
        Object.assign(space, { name: action.name, enabled: action.enabled });
        if (!next.spaces.some(s => s.enabled)) throw new SpaceError('少なくとも1つのサーバーを公開してください。');
      } else if (action.type === 'membership') {
        if (!persistentIdentity(action.accountId) || !members.some(m => m.id === action.accountId) || !Array.isArray(action.spaceIds) || action.spaceIds.length > 50 || new Set(action.spaceIds).size !== action.spaceIds.length || !action.spaceIds.every(id => next.spaces.some(s => s.id === id))) throw new SpaceError('ログイン済みのメンバーと所属先を選んでください。');
        next.memberships = next.memberships.filter(m => m.accountId !== action.accountId).concat({ accountId: action.accountId, spaceIds: [...action.spaceIds] });
      } else throw new SpaceError('操作を確認してください。');
    }, active);
  }
  private edit(user: AuthUser | undefined, revision: number, change: (next: State) => void, active = () => true): Promise<void> {
    const operation = this.queue.then(async () => {
      if (!active() || !this.isAdministrator(user)) throw new SpaceError('管理者だけが変更できます。');
      if (revision !== this.state.revision) throw new SpaceError('別の画面で更新されました。再読み込みして操作してください。');
      const next = structuredClone(this.state); change(next); next.revision++; next.administrator ??= userIdentity(user!);
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        const tmp = `${this.file}.${randomUUID()}.tmp`;
        try {
          await writeFile(tmp, JSON.stringify(next) + '\n', { mode: 0o600 });
          if (!active() || !this.isAdministrator(user)) throw new SpaceError('ログイン状態が変わりました。');
          await rename(tmp, this.file);
        } finally { await unlink(tmp).catch(() => {}); }
      }
      this.state = next;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
}
