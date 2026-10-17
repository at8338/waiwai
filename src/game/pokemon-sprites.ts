import data from './pokemon-pixels.json' with { type: 'json' };
import { isPokemonKind, POKEMON } from './pokemon.ts';
import type { Pixel } from './avatar.ts';
import type { Direction } from './world.ts';

// Decode small local sprites once, then reuse them for map, journal and buddies.
// Palette-indexed horizontal runs preserve transparency without image requests.
const cache = new Map<string, Pixel[]>();
export function catalogPokemonPixels(kind: string, direction: Direction, frame: number): Pixel[] | undefined {
  if (!isPokemonKind(kind)) return;
  const key = `${kind}:${direction}:${frame}`;
  const cached = cache.get(key); if (cached) return cached;
  const [palette, front, back] = data[POKEMON[kind].id - 1];
  const pixels = (direction === 'up' ? back : front).map((run) => {
    const x = run & 31, y = run >>> 5 & 31, w = run >>> 10 & 31;
    return { color: palette[run >>> 15], x: direction === 'left' ? 20 - x - w : x, y: y + (frame === 1 ? -1 : frame === 2 ? 1 : 0), w, h: 1 };
  });
  cache.set(key, pixels); return pixels;
}
