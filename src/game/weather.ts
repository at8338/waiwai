export const WEATHER_KINDS = ['clear', 'rain', 'storm'] as const;
export type WeatherKind = typeof WEATHER_KINDS[number];
export const WEATHER_LABELS: Record<WeatherKind, string> = { clear: '晴れ', rain: '雨', storm: '雷雨' };
export const WEATHER_PERIOD_MS = 30 * 60 * 1000;
export const WINDOW_VIEW_HEIGHT = 56;
export const ROOFTOP_VIEW_HEIGHT = 80;
// Shared decorative weather: stable during each half hour and identical for all clients.
export function weatherAt(timestamp: number): WeatherKind {
  let hash = Math.floor(timestamp / WEATHER_PERIOD_MS) ^ 0x45d9f3b;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const roll = ((hash ^ (hash >>> 16)) >>> 0) % 100;
  return roll < 68 ? 'clear' : roll < 90 ? 'rain' : 'storm';
}
