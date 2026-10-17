import { readFileSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { validObject, MAX_ROOM_OBJECTS } from '../src/game/objects.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { ROOM_IDS } from '../src/game/rooms.ts';

// Mutations commit serially, after an atomic disk write. A failed write never
// becomes a successful edit or a broadcast, and the previous file remains intact.
export class ObjectStore {
  private objects: RoomObject[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private file?: string;
  constructor(file?: string) {
    this.file = file;
    if (!file) return;
    try {
      const raw = readFileSync(file, 'utf8');
      if (Buffer.byteLength(raw) > 512 * 1024) throw new Error('Object state too large');
      const parsed = JSON.parse(raw);
      if (parsed.version !== 1 || !Array.isArray(parsed.objects) || !parsed.objects.every(validObject) ||
          new Set(parsed.objects.map((o: RoomObject) => o.id)).size !== parsed.objects.length ||
          ROOM_IDS.some((room) => parsed.objects.filter((o: RoomObject) => o.roomId === room).length > MAX_ROOM_OBJECTS)) throw new Error('Invalid object state');
      this.objects = parsed.objects;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Cannot load office objects. Preserve the data file and restore a valid backup.'); }
  }
  list(): readonly RoomObject[] { return this.objects; }
  transact<T>(edit: (next: RoomObject[]) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = this.objects.map((o) => ({ ...o }));
      const result = edit(next);
      if (this.file) {
        await mkdir(dirname(this.file), { recursive: true, mode: 0o750 });
        const temporary = this.file + '.tmp';
        await writeFile(temporary, JSON.stringify({ version: 1, objects: next }) + '\n', { mode: 0o600 });
        await rename(temporary, this.file);
      }
      this.objects = next;
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
