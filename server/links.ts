import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validLinkState } from '../src/game/object-links.ts';
import type { LinkState } from '../src/game/object-links.ts';

export class LinkStore {
  private state: LinkState = { favorites: [], bindings: [] };
  private file?: string;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(file?: string) {
    this.file = file;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error('Link state too large');
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !validLinkState(parsed)) throw new Error('Invalid link state');
      this.state = { favorites: parsed.favorites, bindings: parsed.bindings };
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load object links. Preserve the file and restore a valid backup.'); }
  }
  list(): Readonly<LinkState> { return this.state; }
  transact<T>(edit: (next: LinkState) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = edit(next);
      if (!validLinkState(next)) throw new Error('Invalid link state');
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        await writeFile(this.file + '.tmp', JSON.stringify({ version: 1, ...next }) + '\n', { mode: 0o600 });
        await rename(this.file + '.tmp', this.file);
      }
      this.state = next;
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
