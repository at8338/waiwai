import { personalStorage } from './personal-storage.ts';
import { drawWalkingPreview } from './walking-preview.ts';
import { WALK_STYLES } from './walking.ts';
import type { Direction } from './world.ts';
import { AVATAR_OPTIONS, DEFAULT_APPEARANCE, avatarPixels, parseAppearance } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import type { OfficeScene } from './OfficeScene.ts';
const STORAGE = 'waiwai.appearance.v1';
function preview(canvas: HTMLCanvasElement, appearance: Appearance) {
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of avatarPixels(appearance)) { context.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); context.fillRect(p.x, p.y, p.w, p.h); }
}
export function setupAvatarEditor(scene: OfficeScene): () => void {
  let saved = { ...DEFAULT_APPEARANCE };
  try { saved = parseAppearance(JSON.parse(personalStorage.getItem(STORAGE) ?? 'null')) ?? saved; } catch { /* Optional local preference. */ }
  let draft = { ...saved };
  const dialog = document.querySelector<HTMLDialogElement>('#avatar-dialog')!;
  const form = document.querySelector<HTMLFormElement>('#avatar-form')!;
  const fields = document.querySelector('#avatar-fields')!;
  const draftCanvas = document.querySelector<HTMLCanvasElement>('#avatar-draft')!;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let walking = true, direction = 0, animation = 0, lastFrame = -Infinity;
  const directions: Direction[] = ['down', 'left', 'up', 'right'];
  const paintDraft = (time = performance.now()) => {
    drawWalkingPreview(draftCanvas, draft, time, directions[direction], walking, reduced.matches);
    const description = document.querySelector('#walk-preview-description')!, text = WALK_STYLES[draft.walkStyle].description;
    if (description.textContent !== text) description.textContent = text;
    document.querySelector('#walk-preview-turn')!.textContent = `向きを変える（${['正面', '左向き', '後ろ向き', '右向き'][direction]}）`;
  };
  const animate = (time: number) => {
    if (!dialog.open || !dialog.isConnected) return;
    if (time - lastFrame >= 70) { paintDraft(time); lastFrame = time; }
    animation = requestAnimationFrame(animate);
  };
  const stop = () => cancelAnimationFrame(animation);
  dialog.addEventListener('close', stop);
  document.querySelector('#walk-preview-toggle')!.addEventListener('click', (event) => {
    walking = !walking; const button = event.currentTarget as HTMLButtonElement;
    button.textContent = walking ? '歩く動きを停止' : '歩く動きを見る'; button.setAttribute('aria-pressed', String(walking)); paintDraft();
  });
  document.querySelector('#walk-preview-turn')!.addEventListener('click', () => { direction = (direction + 1) % directions.length; paintDraft(); });
  for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof Appearance>) {
    const label = document.createElement('label'); label.textContent = AVATAR_OPTIONS[key].label;
    const select = document.createElement('select'); select.name = key; select.setAttribute('aria-label', AVATAR_OPTIONS[key].label);
    if (key === 'walkStyle') label.className = 'walk-style-field';
    AVATAR_OPTIONS[key].choices.forEach((text, value) => { const option = document.createElement('option'); option.value = String(value); option.textContent = text; select.append(option); });
    label.append(select); fields.append(label);
    select.addEventListener('change', () => { draft[key] = Number(select.value); paintDraft(); });
  }
  const apply = () => {
    scene.setAppearance(saved);
    preview(document.querySelector('#avatar-preview')!, saved);
    document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.outfit) === saved.color)));
  };
  apply();
  scene.onAppearancePickup((appearance: Appearance) => {
    saved = { ...appearance };
    preview(document.querySelector('#avatar-preview')!, saved);
    try { personalStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Optional preference. */ }
  });
  document.querySelector('#avatar-edit')!.addEventListener('click', () => {
    draft = { ...saved };
    for (const select of fields.querySelectorAll('select')) select.value = String(draft[select.name as keyof Appearance]);
    paintDraft(); dialog.showModal(); stop(); animation = requestAnimationFrame(animate);
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault(); saved = { ...draft }; apply();
    try { personalStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Keep this session's appearance. */ }
    dialog.close();
  });
  document.querySelector('#avatar-cancel')!.addEventListener('click', () => dialog.close());
  document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((button) => button.addEventListener('click', () => {
    saved = { ...saved, color: Number(button.dataset.outfit) }; apply();
    try { personalStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Optional preference. */ }
  }));
  return stop;
}
