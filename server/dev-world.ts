import type { IncomingMessage } from 'node:http';
import { DAILY_EPISODES } from '../src/game/daily-event-catalog.ts';
import { dailyEventAt, previewEventAt } from '../src/game/daily-events.ts';
import { pokemonDay, pokemonRoster } from '../src/game/pokemon-spawns.ts';
import type { PokemonKind } from '../src/game/pokemon.ts';
import type { RoomId } from '../src/game/rooms.ts';
import type { LostItemOverride } from '../src/game/lost-items.ts';
import type { DevWorldAction } from '../src/game/dev-world.ts';
export function allowDevWorld(enabled: boolean | undefined, request: Pick<IncomingMessage, 'headers'>): boolean {
  if (!enabled) return false;
  try {
    const local = (host: string) => ['127.0.0.1', 'localhost', '[::1]'].includes(host);
    return local(new URL(request.headers.origin ?? '').hostname) && local(new URL(`http://${request.headers.host}`).hostname);
  } catch { return false; }
}
export class WorldTestControls {
  private day: string;
  private eventOverride?: { episodeId: string; roomId?: RoomId };
  private pokemonSalt = 0;
  private kinds?: PokemonKind[];
  private pokemonRoom?: RoomId;
  lost: LostItemOverride = {};
  constructor(now: number) { this.day = pokemonDay(now); }
  refresh(now: number): boolean { if (this.day === pokemonDay(now)) return false; this.day = pokemonDay(now); this.reset(); return true; }
  get preview(): boolean { return !!this.eventOverride; }
  event(now: number) { return this.eventOverride ? previewEventAt(now, this.eventOverride.episodeId, this.eventOverride.roomId) : dailyEventAt(now); }
  roster(now: number) { return pokemonRoster(now, this.pokemonSalt, this.kinds, this.pokemonRoom); }
  apply(action: DevWorldAction, now: number): void {
    this.refresh(now);
    if (action.command === 'reset') { this.reset(); return; }
    if (action.command === 'pokemon') { this.pokemonSalt++; this.kinds = action.kinds; this.pokemonRoom = action.roomId; return; }
    if (action.command === 'lost') { this.lost = { salt: (this.lost.salt ?? 0) + 1, kind: action.kind, roomId: action.roomId }; return; }
    const index = DAILY_EPISODES.findIndex((episode) => episode.id === this.event(now).episodeId);
    if (action.command === 'event') this.eventOverride = { episodeId: action.episodeId, roomId: action.roomId };
    else {
      const step = action.command === 'event-step' ? action.step : 1 + Math.floor(Math.random() * (DAILY_EPISODES.length - 1));
      this.eventOverride = { episodeId: DAILY_EPISODES[(index + step + DAILY_EPISODES.length) % DAILY_EPISODES.length].id };
    }
  }
  private reset(): void { this.eventOverride = undefined; this.pokemonSalt = 0; this.kinds = undefined; this.pokemonRoom = undefined; this.lost = {}; }
}
