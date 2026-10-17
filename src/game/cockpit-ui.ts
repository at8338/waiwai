import { IDLE_ROBOT, ROBOT_ACTIONS, ROBOT_PARTS } from './robot.ts';
import type { RobotAction, RobotSnapshot } from './robot.ts';
import { robotPixels } from './robot-art.ts';
import { getRoom } from './rooms.ts';
import type { RoomId } from './rooms.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
export class CockpitUI {
  private room: RoomId = 'office';
  private connected = false;
  private ready = false;
  private snapshot: RobotSnapshot = { state: IDLE_ROBOT, serverNow: Date.now() };
  private offset = 0;
  private selected = 'head';
  private pending?: string;
  private timeout?: ReturnType<typeof setTimeout>;
  private refresh: ReturnType<typeof setInterval>;
  constructor(signal: AbortSignal, private send: (action: RobotAction, id: string) => boolean, private visit: (room: RoomId) => void, private beforeOpen: () => boolean) {
    el('cockpit-open').addEventListener('click', () => this.open(), { signal });
    el('cockpit-close').addEventListener('click', () => el<HTMLDialogElement>('cockpit-dialog').close(), { signal });
    el('cockpit-commands').addEventListener('click', (event) => {
      const action = (event.target as Element).closest<HTMLButtonElement>('[data-robot-action]')?.dataset.robotAction as RobotAction | undefined;
      if (!action || !this.connected || !this.ready || this.pending || this.active()) return;
      const id = crypto.randomUUID(); if (!this.send(action, id)) return;
      this.pending = id; el('cockpit-request-status').textContent = '操作を伝えています…';
      this.timeout = setTimeout(() => { this.pending = undefined; el('cockpit-request-status').textContent = '応答を確認できませんでした。接続状態を確認してください。'; this.render(); }, 8000); this.render();
    }, { signal });
    el('cockpit-parts').addEventListener('click', (event) => {
      const id = (event.target as Element).closest<HTMLButtonElement>('[data-robot-part]')?.dataset.robotPart;
      if (id) { this.selected = id; this.renderPart(); }
    }, { signal });
    el('robot-part-rooms').addEventListener('click', (event) => {
      const room = (event.target as Element).closest<HTMLButtonElement>('[data-robot-room]')?.dataset.robotRoom as RoomId | undefined;
      if (!room || !this.connected) return; el<HTMLDialogElement>('cockpit-dialog').close(); this.visit(room);
    }, { signal });
    this.renderPart(); this.render(); this.refresh = setInterval(() => this.render(), 120);
  }
  private active(): RobotAction | null { const s = this.snapshot.state; return s.action && Date.now() + this.offset < s.endsAt ? s.action : null; }
  setConnected(value: boolean): void { this.connected = value; if (!value) { this.ready = false; this.cancelPending(); } this.render(); }
  setRoom(room: RoomId): void {
    this.room = room; this.ready = false; this.cancelPending();
    el('cockpit-panel').hidden = room !== 'cockpit';
    if (room !== 'cockpit') el<HTMLDialogElement>('cockpit-dialog').close();
    this.render();
  }
  receive(snapshot: RobotSnapshot): void { this.snapshot = snapshot; this.offset = snapshot.serverNow - Date.now(); this.ready = true; this.render(); }
  result(id: string, error?: string): void {
    if (id !== this.pending) return; this.cancelPending(); el('cockpit-request-status').textContent = error ?? 'みんなに操縦の演出を共有しました。'; this.render();
  }
  open(): void { if (this.room !== 'cockpit' || !this.beforeOpen()) return; el('cockpit-request-status').textContent = ''; this.render(); el<HTMLDialogElement>('cockpit-dialog').showModal(); }
  private cancelPending(): void { clearTimeout(this.timeout); this.pending = undefined; }
  private renderPart(): void {
    const part = ROBOT_PARTS.find((part) => part.id === this.selected)!;
    el('robot-part-title').textContent = `${part.label} · ${part.title}`; el('robot-part-description').textContent = part.description;
    const rooms = el('robot-part-rooms'); rooms.replaceChildren();
    for (const id of part.rooms) { const button = document.createElement('button'); button.type = 'button'; button.dataset.robotRoom = id; button.textContent = `${getRoom(id).icon} ${getRoom(id).name}${id === 'cockpit' ? '（現在地）' : 'へ ↗'}`; button.disabled = !this.connected || id === this.room; rooms.append(button); }
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-robot-part]')) button.setAttribute('aria-pressed', String(button.dataset.robotPart === this.selected));
    this.paint();
  }
  private paint(): void {
    const canvas = el<HTMLCanvasElement>('cockpit-robot'), ctx = canvas.getContext('2d')!, action = this.active();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctx.fillStyle = '#233e54'; ctx.fillRect(0, 0, 128, 144);
    for (const p of robotPixels(action, Date.now() + this.offset - this.snapshot.state.startedAt, reduced, this.selected)) { ctx.fillStyle = '#' + p.color.toString(16).padStart(6, '0'); ctx.fillRect(p.x, p.y, p.w, p.h); }
    canvas.dataset.robotAction = action ?? 'standby';
  }
  private render(): void {
    if (this.room !== 'cockpit') return;
    const action = this.active(), s = this.snapshot.state, seconds = action ? Math.max(0, Math.ceil((s.endsAt - Date.now() - this.offset) / 1000)) : 0;
    const status = !this.connected ? '接続を待っています。' : !this.ready ? '機体の状態を確認しています…' : action ? `${s.operator} が操縦中 · ${ROBOT_ACTIONS[action].label} · あと${seconds}秒` : '全ブロック接続。次のパイロット、どうぞ！';
    for (const id of ['cockpit-status', 'cockpit-modal-status']) if (el(id).textContent !== status) el(id).textContent = status;
    el('cockpit-message').textContent = action ? ROBOT_ACTIONS[action].message : 'いつものオフィスは、実は巨大ロボットの中でした。';
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-robot-action]')) button.disabled = !this.connected || !this.ready || !!this.pending || !!action;
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-robot-room]')) button.disabled = !this.connected || button.dataset.robotRoom === this.room;
    if (el<HTMLDialogElement>('cockpit-dialog').open) this.paint();
  }
  destroy(): void { clearInterval(this.refresh); this.cancelPending(); }
}
