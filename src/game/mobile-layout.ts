/** Keep a tile centred while clamping to the actual scrollable map edges. */
export function mapScrollTarget(view: { width: number; height: number }, map: { left: number; top: number; width: number; height: number }, tile: { x: number; y: number }, room: { cols: number; rows: number }, content: { width: number; height: number }): { left: number; top: number } {
  const clamp = (n: number, max: number) => Math.max(0, Math.min(n, Math.max(0, max)));
  return {
    left: clamp(map.left + (tile.x + .5) / room.cols * map.width - view.width / 2, content.width - view.width),
    top: clamp(map.top + (tile.y + .5) / room.rows * map.height - view.height / 2, content.height - view.height),
  };
}

/** VisualViewport accounts for the on-screen keyboard without disabling pinch zoom. */
export function setupMobileViewport(signal: AbortSignal): void {
  const root = document.documentElement, viewport = window.visualViewport;
  const update = () => {
    if (viewport && viewport.scale !== 1) return;
    const height = viewport?.height ?? window.innerHeight;
    root.style.setProperty('--app-height', `${height}px`);
    root.style.setProperty('--app-top', `${viewport?.offsetTop ?? 0}px`);
    root.classList.toggle('viewport-short', height <= 500);
    root.classList.toggle('keyboard-open', !!document.activeElement?.matches('input,textarea,[contenteditable=true]') && window.innerHeight - height > 100);
  };
  viewport?.addEventListener('resize', update, { signal });
  viewport?.addEventListener('scroll', update, { signal });
  window.addEventListener('resize', update, { signal });
  document.addEventListener('focusin', update, { signal });
  document.addEventListener('focusout', () => queueMicrotask(update), { signal });
  update();
}
/** Include the window band and frame when fitting a whole room in either orientation. */
export function mobileMapWidth(view: { width: number; height: number }, zoom: number): number {
  return Math.round(Math.min(view.width, Math.max(120, (view.height - 20) * 1.25)) * zoom);
}

