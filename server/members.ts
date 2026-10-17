import { persistentIdentity, userIdentity } from '../src/game/identity.ts';
import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Member } from '../src/game/directory.ts';
import type { AuthUser } from '../src/slack/auth.ts';
import { parseSlackIdentity } from '../src/slack/dm.ts';
import { normalizeName } from '../src/network/protocol.ts';

export class MemberStore {
  private members: Member[] = [];
  private file?: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(file?: string) {
    this.file = file;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > 1024 * 1024) throw new Error('Member directory too large');
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.members) || parsed.members.length > 5000 || !parsed.members.every((m: Member) => {
        const slack = m && parseSlackIdentity(m.slack);
        return persistentIdentity(m.id) && (!m.slack || slack && m.id === `slack:${slack.teamId}:${slack.userId}`) && typeof m.name === 'string' && m.name === normalizeName(m.name);
      }) || new Set(parsed.members.map((m: Member) => m.id)).size !== parsed.members.length) throw new Error('Invalid member directory');
      this.members = parsed.members;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load member directory. Preserve the file and restore a valid backup.');
    }
  }
  list(): readonly Member[] { return this.members; }
  // Called only with a server-verified identity, never with a client profile.
  remember(user: AuthUser): Promise<void> {
    const member: Member = { id: userIdentity(user), name: normalizeName(user.name), ...(user.slack ? { slack: { ...user.slack } } : {}) };
    const operation = this.queue.then(async () => {
      const old = this.members.find((m) => m.id === member.id);
      if (old?.name === member.name) return;
      if (!old && this.members.length >= 5000) throw new Error('Member directory full');
      const next = this.members.filter((m) => m.id !== member.id).concat(member);
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, members: next }) + '\n', { mode: 0o600 });
        await rename(this.file + '.tmp', this.file);
      }
      this.members = next;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
