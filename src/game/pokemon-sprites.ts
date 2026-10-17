import data from './pokemon-pixels.json' with { type: 'json' };
import { isPokemonKind, POKEMON } from './pokemon.ts';
import type { Pixel } from './avatar.ts';
import type { Direction } from './world.ts';

// Decode small local sprites once, then reuse them for map, journal and buddies.
// Palette-indexed horizontal runs preserve transparency without image requests.
const cache = new Map<string, Pixel[]>();
function decode(kind: string, direction: Direction, frame: number, map: boolean): Pixel[] | undefined {
  if (!isPokemonKind(kind)) return;
  const key = `${kind}:${direction}:${frame}:${map}`;
  const cached = cache.get(key); if (cached) { cache.delete(key); cache.set(key, cached); return cached; }
  const [palette, front, back, mapFront, mapBack] = data[POKEMON[kind].spriteIndex];
  const large = map && POKEMON[kind].mapSize > 20, bits = large ? 7 : 5, mask = (1 << bits) - 1;
  const runs = large ? direction === 'up' ? mapBack : mapFront : direction === 'up' ? back : front;
  const width = large ? POKEMON[kind].mapSize : 20;
  const pixels = runs.map((run) => {
    const x = run & mask, y = run >>> bits & mask, w = run >>> (bits * 2) & mask;
    return { color: palette[run >>> (bits * 3)], x: direction === 'left' ? width - x - w : x, y: y + (frame === 1 ? -1 : frame === 2 ? 1 : 0), w, h: 1 };
  });
  cache.set(key, pixels); if (cache.size > 256) cache.delete(cache.keys().next().value!); return pixels;
}
export const catalogPokemonPixels = (kind: string, direction: Direction, frame: number): Pixel[] | undefined => decode(kind, direction, frame, false);
export const mapPokemonPixels = (kind: string, direction: Direction, frame: number): Pixel[] | undefined => decode(kind, direction, frame, true);
