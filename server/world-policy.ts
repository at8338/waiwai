import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultWorldPolicy, POLICY_GROUPS, policyItem, allowedRooms } from '../src/game/world-policy.ts';
import type { WorldPolicy, PolicyAction } from '../src/game/world-policy.ts';
import { persistentIdentity, userIdentity } from '../src/game/identity.ts';
import type { AuthUser } from '../src/slack/auth.ts';
export const ADMIN_EMAIL = 'tt-asahara@kddi.com';
export class PolicyError extends Error {}
export class WorldPolicyStore {
  private state = defaultWorldPolicy();
  private administrator?: string;
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  private configuredAdministrator?: string;
  constructor(file?: string, configuredAdministrator?: string) {
    this.file = file; this.configuredAdministrator = configuredAdministrator;
    if (configuredAdministrator && !persistentIdentity(configuredAdministrator)) throw new Error('WAIWAI_ADMIN_ACCOUNT_ID must be a verified Slack or Entra account ID.');
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > 256 * 1024) throw new Error('Policy too large');
      const data = JSON.parse(raw);
      const policy = data.policy as WorldPolicy;
      if (data.version !== 1 || !policy || !Number.isSafeInteger(policy.revision) || policy.revision < 0 || !policy.blocked ||
          POLICY_GROUPS.some(group => !Array.isArray(policy.blocked[group]) || !policy.blocked[group].every(id => policyItem(group, id)) || new Set(policy.blocked[group]).size !== policy.blocked[group].length) || !allowedRooms(policy).length ||
          (policy.updatedAt !== undefined && (!Number.isSafeInteger(policy.updatedAt) || policy.updatedAt < 0)) ||
          (data.administrator !== undefined && !persistentIdentity(data.administrator))) throw new Error('Invalid policy');
      this.state = policy; this.administrator = data.administrator;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load world policy. Preserve the file and restore a valid backup.'); }
  }
  snapshot(): WorldPolicy { return structuredClone(this.state); }
  isAdministrator(user?: AuthUser): boolean {
    if (!user) return false;
    let id: string; try { id = userIdentity(user); } catch { return false; }
    // An explicitly provisioned immutable ID is required for Microsoft accounts.
    // A verified Slack email can bootstrap the one administrator; its immutable
    // workspace/user ID is pinned atomically with the first successful edit.
    const pinned = this.configuredAdministrator ?? this.administrator;
    if (pinned) return pinned === id;
    return user.provider === 'slack' && !!user.slack && user.emailVerified === true && user.email?.trim().toLowerCase() === ADMIN_EMAIL;
  }
  apply(action: PolicyAction, user: AuthUser | undefined, active: () => boolean): Promise<void> {
    const operation = this.queue.then(async () => {
      if (!active() || !this.isAdministrator(user)) throw new PolicyError('管理者だけが変更できます。');
      if (action.revision !== this.state.revision) throw new PolicyError('別の画面で設定が更新されました。最新の状態を確認して、もう一度操作してください。');
      const next = this.snapshot();
      next.blocked[action.group] = next.blocked[action.group].filter(id => id !== action.id);
      if (!action.allowed) next.blocked[action.group].push(action.id);
      if (!allowedRooms(next).length) throw new PolicyError('少なくとも1つのフロアを公開してください。');
      next.revision++; next.updatedAt = Date.now();
      const administrator = this.configuredAdministrator ?? this.administrator ?? userIdentity(user!);
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        const temporary = this.file + '.' + randomUUID() + '.tmp';
        try {
          await writeFile(temporary, JSON.stringify({ version: 1, administrator, policy: next }) + '\n', { mode: 0o600 });
          if (!active() || !this.isAdministrator(user)) throw new PolicyError('接続が切れたため操作を取り消しました。');
          await rename(temporary, this.file);
        } finally { await unlink(temporary).catch(() => {}); }
      }
      this.state = next; this.administrator = administrator;
    });
    this.queue = operation.catch(() => {}); return operation;
  }
}
