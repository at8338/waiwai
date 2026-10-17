import { buddyPixels } from './buddies.ts';
import type { BuddyKind } from './buddies.ts';
export function buddyThumbnails() {
  const pending = new WeakMap<Element, { kind: BuddyKind; silhouette: boolean }>();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const data = pending.get(entry.target); if (!data) continue;
      const ctx = (entry.target as HTMLCanvasElement).getContext('2d')!;
      for (const p of buddyPixels(data.kind)) {
        ctx.fillStyle = data.silhouette ? '#b6b9aa' : '#' + p.color.toString(16).padStart(6, '0');
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
      observer.unobserve(entry.target); pending.delete(entry.target);
    }
  }, { rootMargin: '200px' });
  return { reset: () => observer.disconnect(), observe: (canvas: HTMLCanvasElement, kind: BuddyKind, silhouette = false) => { pending.set(canvas, { kind, silhouette }); observer.observe(canvas); } };
}
