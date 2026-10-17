import { AVATAR_OPTIONS, DEFAULT_APPEARANCE, avatarPixels, parseAppearance } from './avatar.ts';
import type { Appearance } from './avatar.ts';
import type { OfficeScene } from './OfficeScene.ts';
const STORAGE = 'waiwai.appearance.v1';
function preview(canvas: HTMLCanvasElement, appearance: Appearance) {
  const context = canvas.getContext('2d')!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const p of avatarPixels(appearance)) { context.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); context.fillRect(p.x, p.y, p.w, p.h); }
}
export function setupAvatarEditor(scene: OfficeScene): void {
  let saved = { ...DEFAULT_APPEARANCE };
  try { saved = parseAppearance(JSON.parse(localStorage.getItem(STORAGE) ?? 'null')) ?? saved; } catch { /* Optional local preference. */ }
  let draft = { ...saved };
  const dialog = document.querySelector<HTMLDialogElement>('#avatar-dialog')!;
  const form = document.querySelector<HTMLFormElement>('#avatar-form')!;
  const fields = document.querySelector('#avatar-fields')!;
  for (const key of Object.keys(AVATAR_OPTIONS) as Array<keyof Appearance>) {
    const label = document.createElement('label'); label.textContent = AVATAR_OPTIONS[key].label;
    const select = document.createElement('select'); select.name = key;
    AVATAR_OPTIONS[key].choices.forEach((text, value) => { const option = document.createElement('option'); option.value = String(value); option.textContent = text; select.append(option); });
    label.append(select); fields.append(label);
    select.addEventListener('change', () => { draft[key] = Number(select.value); preview(document.querySelector('#avatar-draft')!, draft); });
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
    try { localStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Optional preference. */ }
  });
  document.querySelector('#avatar-edit')!.addEventListener('click', () => {
    draft = { ...saved };
    for (const select of fields.querySelectorAll('select')) select.value = String(draft[select.name as keyof Appearance]);
    preview(document.querySelector('#avatar-draft')!, draft); dialog.showModal();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault(); saved = { ...draft }; apply();
    try { localStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Keep this session's appearance. */ }
    dialog.close();
  });
  document.querySelector('#avatar-cancel')!.addEventListener('click', () => dialog.close());
  document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((button) => button.addEventListener('click', () => {
    saved = { ...saved, color: Number(button.dataset.outfit) }; apply();
    try { localStorage.setItem(STORAGE, JSON.stringify(saved)); } catch { /* Optional preference. */ }
  }));
}
