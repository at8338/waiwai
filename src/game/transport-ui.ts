import { VEHICLES, VEHICLE_KINDS, nearVehicleDock } from './transport.ts';
import type { VehicleKind, VehicleUnit } from './transport.ts';
import type { Player } from '../network/protocol.ts';
export class TransportUI {
  private player?: Player;
  private connected = false;
  private units: VehicleUnit[] = [];
  private ready = false;
  private pending?: string;
  private pendingKind: VehicleKind | null = null;
  private timer?: number;
  private key = '';
  private send: (kind: VehicleKind | null, id: string) => boolean;
  private onOpen: () => void;
  constructor(signal: AbortSignal, send: (kind: VehicleKind | null, id: string) => boolean, onOpen: () => void) {
    this.send = send; this.onOpen = onOpen;
    document.querySelector('#vehicle-open')!.addEventListener('click', () => this.open(), { signal });
    document.querySelector('#vehicle-close')!.addEventListener('click', () => document.querySelector<HTMLDialogElement>('#vehicle-dialog')!.close(), { signal });
    document.querySelector('#vehicle-dialog')!.addEventListener('close', () => document.querySelector<HTMLCanvasElement>('#game canvas')?.focus({ preventScroll: true }), { signal });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-vehicle-take]')) button.addEventListener('click', () => this.request(button.dataset.vehicleTake as VehicleKind), { signal });
    document.querySelector('#vehicle-return')!.addEventListener('click', () => this.request(null), { signal });
    this.render();
  }
  setConnected(connected: boolean): void {
    this.connected = connected;
    if (!connected) { this.pending = undefined; this.ready = false; window.clearTimeout(this.timer); }
    this.render();
  }
  setPlayer(player: Player): void { this.player = player; this.render(); }
  inventory(units: VehicleUnit[]): void { this.units = units; this.ready = true; this.render(); }
  open(): void {
    this.onOpen();
    if (!this.pending) document.querySelector('#vehicle-status')!.textContent = '';
    const dialog = document.querySelector<HTMLDialogElement>('#vehicle-dialog')!; if (!dialog.open) dialog.showModal();
  }
  result(id: string, error?: string): void {
    if (id !== this.pending) return;
    const kind = this.pendingKind; this.pending = undefined; window.clearTimeout(this.timer);
    document.querySelector('#vehicle-status')!.textContent = error ?? (kind ? `${VEHICLES[kind].name}を借りました。一緒に走ってみよう！` : '置き場に返却しました。');
    this.render();
  }
  destroy(): void { window.clearTimeout(this.timer); }
  private request(kind: VehicleKind | null): void {
    if (this.pending || !this.connected || !this.ready) return;
    const id = crypto.randomUUID();
    if (!this.send(kind, id)) return;
    this.pending = id; this.pendingKind = kind;
    document.querySelector('#vehicle-status')!.textContent = '置き場の状況を確認しています…';
    this.timer = window.setTimeout(() => this.result(id, '応答を確認できませんでした。接続状態を確認してから試してください。'), 5000);
    this.render();
  }
  private render(): void {
    const near = VEHICLE_KINDS.map((kind) => !!this.player && nearVehicleDock(this.player, kind));
    const counts = VEHICLE_KINDS.map((kind) => this.units.filter((u) => u.kind === kind && !u.riderId).length);
    const riding = this.player?.riding;
    const key = `${this.connected}:${this.ready}:${this.pending}:${riding?.id}:${near}:${counts}`;
    if (this.key === key) return; this.key = key;
    document.querySelector('#vehicle-current')!.textContent = riding ? `${VEHICLES[riding.kind].icon} ${VEHICLES[riding.kind].name}で移動中 · 速さ${VEHICLES[riding.kind].speed}` : 'いまは歩いています。';
    document.querySelector('#vehicle-location')!.textContent = !this.connected ? '接続すると借りられます。'
      : riding ? (this.player && nearVehicleDock(this.player, riding.kind) ? 'ここで返却できます。返したあとは、ほかの乗りものも借りられます。' : '返すときは、ひだまりオフィスの同じ乗りものの置き場へ。')
      : near.some(Boolean) ? '置き場の近くにいます。空いている乗りものを借りよう。' : 'ひだまりオフィスのロビー左下。置き場のすぐ横まで歩いて借りてください。';
    VEHICLE_KINDS.forEach((kind, i) => {
      document.querySelector(`[data-vehicle-count="${kind}"]`)!.textContent = this.ready ? `${counts[i]} / ${VEHICLES[kind].count} ${kind === 'skates' ? '組' : '台'} 空き` : '確認中…';
      document.querySelector<HTMLButtonElement>(`[data-vehicle-take="${kind}"]`)!.disabled = !this.connected || !this.ready || !!this.pending || !!riding || !near[i] || counts[i] === 0;
    });
    const button = document.querySelector<HTMLButtonElement>('#vehicle-return')!;
    button.hidden = !riding; button.disabled = !this.connected || !!this.pending || !riding || !this.player || !nearVehicleDock(this.player, riding.kind);
    document.querySelector('#vehicle-return-hint')!.textContent = riding ? '乗ったまま部屋を移動できます。返すときは同じ乗りものの置き場へ。退出時には自動返却します。' : '1人につき1つ。みんなと共有する乗りものです。';
    document.querySelector('#vehicle-open')!.textContent = riding ? `${VEHICLES[riding.kind].icon} ${VEHICLES[riding.kind].name}で移動中` : '🚲 乗りもの置き場';
  }
}
