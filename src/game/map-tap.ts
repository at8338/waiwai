type MapPointer = { event?: { type: string; target?: EventTarget | null }; manager?: { scaleManager?: { displayScale?: { x: number; y: number } } }; getDistance(): number };
/** Phaser also emits pointerup on touchcancel; a scroll must never activate a map object. */
export function isMapTap(pointer: MapPointer): boolean {
  // Phaser listens for releases on window too. A DOM button/dialog is not a map tap.
  const target = pointer.event?.target as { tagName?: string } | null | undefined;
  if (target && target.tagName !== 'CANVAS') return false;
  const scale = pointer.manager?.scaleManager?.displayScale;
  // Phaser measures movement in render pixels, not the phone's CSS pixels.
  const renderScale = scale ? Math.max(scale.x, scale.y) : 1;
  return pointer.event?.type !== 'touchcancel' && pointer.event?.type !== 'pointercancel' && pointer.getDistance() <= 8 * renderScale;
}
export const mapTap = (activate: () => void) => (pointer: MapPointer): void => { if (isMapTap(pointer)) activate(); };
