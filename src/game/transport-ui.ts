import { VEHICLES, VEHICLE_KINDS, nearVehicleDock, nearGroundVehicle, touchingVehicleDock } from './transport.ts';
import type { VehicleAction, VehicleKind, VehicleUnit } from './transport.ts';
import { getRoom } from './rooms.ts';
import type { Player } from '../network/protocol.ts';
export class TransportUI {
  private player?: Player;
  private connected = false;
  private units: VehicleUnit[] = [];
  private ready = false;
  private pending?: string;
  private pendingAction?: VehicleAction;
  private pendingKind?: VehicleKind;
  private droppedOnPad = false;
  private pendingQuick = false;
  private feedbackTimer?: number;
  private selected?: string;
  private timer?: number;
  private key = '';
  private send: (action: VehicleAction, id: string) => boolean;
  private onOpen: () => void;
  constructor(signal: AbortSignal, send: (action: VehicleAction, id: string) => boolean, onOpen: () => void) {
    this.send = send; this.onOpen = onOpen;
    document.querySelector('#vehicle-open')!.addEventListener('click', () => this.quickAction(), { signal });
    document.querySelector('#vehicle-quick-drop')!.addEventListener('click', () => this.quickAction(), { signal });
    document.querySelector('#vehicle-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#vehicle-dialog')!.close(), { signal });
    document.querySelector('#vehicle-dialog')!.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-vehicle-take]')) button.addEventListener('click', () => this.request({ type: 'vehicle-take', kind: button.dataset.vehicleTake as VehicleKind }), { signal });
    document.querySelector('#vehicle-return')!.addEventListener('click', () => this.request({ type: 'vehicle-return' }), { signal });
    document.querySelector('#vehicle-drop')!.addEventListener('click', () => this.request({ type: 'vehicle-drop' }), { signal });
    document.querySelector('#vehicle-ground-list')!.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-vehicle-pickup]');
      if (button && !button.disabled) this.request({ type: 'vehicle-pickup', unitId: button.dataset.vehiclePickup! });
    }, { signal });
    this.render();
  }
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) { this.pending = undefined; this.ready = false; this.player = undefined; this.units = []; window.clearTimeout(this.timer); window.clearTimeout(this.feedbackTimer); document.querySelector<HTMLElement>('#vehicle-quick-status')!.hidden = true; }
    this.render();
  }
  setPlayer(player: Player): void { this.player = player; this.render(); }
  inventory(units: VehicleUnit[]): void { this.units = units; this.ready = true; this.render(); }
  quickAction(): void {
    if (!this.player?.riding) { this.open(); return; }
    if (this.pending || !this.connected || !this.ready) return;
    this.onOpen(); this.request({ type: 'vehicle-drop' }, true);
  }
  open(unitId?: string): void {
    this.onOpen(); this.selected = unitId; this.render();
    if (!this.pending) {
      const unit = this.units.find((u) => u.id === unitId && u.ground);
      document.querySelector('#vehicle-status')!.textContent = unit ? `${VEHICLES[unit.kind].name}が置かれています。誰でも、すぐ横から乗れます。` : '';
    }
    const dialog = document.querySelector<HTMLDialogElement>('#vehicle-dialog')!; if (!dialog.open) dialog.showModal();
  }
  result(id: string, error?: string): void {
    if (id !== this.pending) return;
    const action = this.pendingAction, kind = this.pendingKind;
    this.pending = undefined; this.pendingAction = undefined; window.clearTimeout(this.timer);
    document.querySelector('#vehicle-status')!.textContent = error ?? (action?.type === 'vehicle-drop' && !this.droppedOnPad
      ? 'ここに置きました。ほかの人も使えます。もう一度乗るときは、一歩離れて戻ろう。'
      : action?.type === 'vehicle-return' || action?.type === 'vehicle-drop' ? '置き場に返却しました。'
      : `${kind ? VEHICLES[kind].name : '乗りもの'}に乗りました。一緒に走ってみよう！`);
    if (this.pendingQuick) {
      const feedback = document.querySelector<HTMLElement>('#vehicle-quick-status')!;
      feedback.textContent = error ?? (this.droppedOnPad ? '置き場に返しました。' : '降りました。ここに置いておきます。');
      feedback.hidden = false; window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = window.setTimeout(() => { feedback.hidden = true; }, 3500);
    }
    this.pendingQuick = false; this.render();
  }
  destroy(): void { window.clearTimeout(this.timer); window.clearTimeout(this.feedbackTimer); }
  private request(action: VehicleAction, quick = false): void {
    if (this.pending || !this.connected || !this.ready) return;
    const id = crypto.randomUUID();
    if (!this.send(action, id)) return;
    this.pending = id; this.pendingAction = action; this.pendingQuick = quick;
    this.pendingKind = action.type === 'vehicle-take' ? action.kind : action.type === 'vehicle-pickup' ? this.units.find((u) => u.id === action.unitId)?.kind : undefined;
    this.droppedOnPad = !!this.player && !!touchingVehicleDock(this.player);
    document.querySelector('#vehicle-status')!.textContent = '乗りものの状況を確認しています…';
    this.timer = window.setTimeout(() => this.result(id, '応答を確認できませんでした。接続状態を確認してから試してください。'), 5000);
    this.render();
  }
  private render(): void {
    const near = VEHICLE_KINDS.map((kind) => !!this.player && nearVehicleDock(this.player, kind));
    const counts = VEHICLE_KINDS.map((kind) => this.units.filter((u) => u.kind === kind && !u.riderId && !u.ground).length);
    const ground = this.units.filter((u) => u.ground && !u.riderId);
    const riding = this.player?.riding;
    const key = `${this.connected}:${this.ready}:${this.pending}:${riding?.id}:${near}:${counts}:${this.player?.roomId}:${this.selected}:${ground.map((u) => `${u.id}/${u.ground!.roomId}/${u.ground!.x}/${u.ground!.y}/${!!this.player && nearGroundVehicle(this.player, u)}`)}`;
    if (this.key === key) return; this.key = key;
    document.querySelector('#vehicle-current')!.textContent = riding ? `${VEHICLES[riding.kind].icon} ${VEHICLES[riding.kind].name}で移動中 · 速さ${VEHICLES[riding.kind].speed}` : 'いまは歩いています。';
    document.querySelector('#vehicle-location')!.textContent = !this.connected ? '接続すると借りられます。'
      : riding ? 'どの部屋でも「ここで降りる」で床に置けます。置き場に踏み入れると返却します。'
      : '置き場や、床に置かれた乗りものに踏み入れると自動で乗れます。床の乗りものはクリックして、すぐ横から乗ることもできます。';
    VEHICLE_KINDS.forEach((kind, i) => {
      document.querySelector(`[data-vehicle-count="${kind}"]`)!.textContent = this.ready ? `置き場 ${counts[i]} / ${VEHICLES[kind].count} ${kind === 'skates' ? '組' : '台'}` : '確認中…';
      document.querySelector<HTMLButtonElement>(`[data-vehicle-take="${kind}"]`)!.disabled = !this.connected || !this.ready || !!this.pending || !!riding || !near[i] || counts[i] === 0;
    });
    const list = document.querySelector('#vehicle-ground-list')!; list.replaceChildren();
    if (!ground.length) { const empty = document.createElement('li'); empty.textContent = '床に置かれた乗りものは、まだありません。'; list.append(empty); }
    for (const unit of ground) {
      const row = document.createElement('li'); row.className = 'vehicle-ground-item'; row.dataset.vehicleUnit = unit.id;
      if (unit.id === this.selected) row.classList.add('is-selected');
      const description = document.createElement('span'); description.textContent = `${VEHICLES[unit.kind].icon} ${VEHICLES[unit.kind].name} · ${getRoom(unit.ground!.roomId).name}`;
      const button = document.createElement('button'); button.type = 'button'; button.dataset.vehiclePickup = unit.id; button.textContent = 'これに乗る';
      button.disabled = !this.connected || !this.ready || !!this.pending || !!riding || !this.player || !nearGroundVehicle(this.player, unit);
      row.append(description, button); list.append(row);
    }
    const button = document.querySelector<HTMLButtonElement>('#vehicle-return')!;
    button.hidden = !riding; button.disabled = !this.connected || !!this.pending || !riding || !this.player || !near.some(Boolean);
    const quickDrop = document.querySelector<HTMLButtonElement>('#vehicle-quick-drop')!;
    quickDrop.hidden = !riding || !this.connected; quickDrop.disabled = !this.ready || !!this.pending || !riding;
    const drop = document.querySelector<HTMLButtonElement>('#vehicle-drop')!;
    drop.hidden = !riding; drop.disabled = !this.connected || !this.ready || !!this.pending || !riding;
    document.querySelector('#vehicle-return-hint')!.textContent = '1人1つ、各3つの共有です。床に置いたものは、降りた人が退出しても残ります。乗ったまま退出すると置き場へ戻ります。';
    document.querySelector('#vehicle-open')!.textContent = riding ? `${VEHICLES[riding.kind].icon} 降りる（E）` : '🚲 乗りものを探す';
  }
}
