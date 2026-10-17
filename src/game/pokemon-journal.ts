import { isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';

export const POKEMON_KINDS = ['pikachu', 'eevee', 'snorlax'] as const;
export type PokemonKind = typeof POKEMON_KINDS[number];
export const POKEMON_JOURNAL_KEY = 'waiwai:pokemon-discoveries:v1';
export const isPokemonKind = (kind: unknown): kind is PokemonKind => typeof kind === 'string' && (POKEMON_KINDS as readonly string[]).includes(kind);
export type PokemonDiscovery = { kind: PokemonKind; roomId: RoomId; foundAt: number };
type JournalStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readPokemonDiscoveries(raw: string | null): PokemonDiscovery[] {
  try {
    const values: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(values)) return [];
    const found = new Map<PokemonKind, PokemonDiscovery>();
    for (const value of values) {
      if (!value || !isPokemonKind(value.kind) || !isRoomId(value.roomId) || !Number.isSafeInteger(value.foundAt) || value.foundAt <= 0 || value.foundAt > 8.64e15) continue;
      const previous = found.get(value.kind);
      if (!previous || value.foundAt < previous.foundAt) found.set(value.kind, { kind: value.kind, roomId: value.roomId, foundAt: value.foundAt });
    }
    return POKEMON_KINDS.flatMap((kind) => found.has(kind) ? [found.get(kind)!] : []);
  } catch { return []; }
}

// Merge browser tabs before writing, keeping the first encounter for each kind.
export class PokemonJournal {
  private found: PokemonDiscovery[] = [];
  private storage: JournalStorage;
  stored = true;
  constructor(storage: JournalStorage) { this.storage = storage; this.refresh(); }
  entries(): PokemonDiscovery[] { return this.found.map((entry) => ({ ...entry })); }
  merge(raw: string | null): void { this.found = readPokemonDiscoveries(JSON.stringify([...this.found, ...readPokemonDiscoveries(raw)])); }
  refresh(): void {
    try { this.merge(this.storage.getItem(POKEMON_JOURNAL_KEY)); } catch { this.stored = false; }
  }
  discover(kind: PokemonKind, roomId: RoomId, foundAt = Date.now()): boolean {
    this.refresh();
    const fresh = !this.found.some((entry) => entry.kind === kind);
    if (fresh) this.merge(JSON.stringify([{ kind, roomId, foundAt }]));
    try { this.storage.setItem(POKEMON_JOURNAL_KEY, JSON.stringify(this.found)); this.stored = true; } catch { this.stored = false; }
    return fresh;
  }
}
