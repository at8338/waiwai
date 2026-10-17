import { avatarPixels } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import { walkingMotion } from './walking.ts';
import type { Direction } from './world.ts';
export function drawWalkingPreview(canvas: HTMLCanvasElement, appearance: Appearance, time: number, direction: Direction, moving: boolean, reducedMotion: boolean): void {
  const ctx = canvas.getContext('2d')!, walk = walkingMotion(appearance.walkStyle, time, direction, moving, reducedMotion);
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#a89b78'; ctx.globalAlpha = 0.35;
  ctx.fillRect(Math.round(24 - 6 * walk.shadow), 40, Math.round(12 * walk.shadow), 2); ctx.globalAlpha = 1;
  ctx.save(); ctx.translate(24 + walk.offsetX, 40 - walk.lift); ctx.rotate(walk.tilt); ctx.scale(walk.scaleX, walk.scaleY);
  for (const p of avatarPixels(appearance, direction, walk.frame)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x - 10, p.y - 28, p.w, p.h); }
  ctx.restore(); canvas.dataset.walkStyle = String(appearance.walkStyle); canvas.dataset.walkFrame = String(walk.frame); canvas.dataset.previewRunning = String(moving);
}
