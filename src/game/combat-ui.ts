import Phaser from 'phaser';
import type { ArenaState, ArenaAction, IceSnapshot } from './arena.ts';
import type { RoomId } from './rooms.ts';
import { TILE } from './world.ts';
export class CombatUI {
  private state?: ArenaState;
  private ice?: IceSnapshot;
  private offset = 0;
  private room: RoomId = 'office';
  private selfId?: string;
  private connected = false;
  private pending?: string;
  private timeout?: ReturnType<typeof setTimeout>;
  private graphics: Phaser.GameObjects.Graphics;
  private key = '';
  constructor(private scene: Phaser.Scene, signal: AbortSignal, private send: (action: ArenaAction) => boolean) {
    this.graphics = scene.add.graphics().setDepth(40_000);
    for (const command of ['join', 'leave'] as const) document.querySelector(`#arena-${command}`)!.addEventListener('click', () => {
      if (!this.connected || this.pending) return;
      const actionId = crypto.randomUUID(); if (!this.send({ type: 'arena-action', command, actionId })) return; this.pending = actionId;
      this.timeout = setTimeout(() => { this.pending = undefined; this.render(); }, 5000); this.render();
    }, { signal });
  }
  setConnected(value: boolean, selfId?: string): void { this.connected = value; this.selfId = selfId; if (!value) { this.state = undefined; this.ice = undefined; this.pending = undefined; clearTimeout(this.timeout); this.graphics.clear(); } this.render(); }
  setRoom(room: RoomId): void { this.room = room; this.graphics.clear(); this.render(); }
  receive(state: ArenaState): void { this.state = state; this.render(); }
  receiveIce(state: IceSnapshot): void { this.ice = state; this.offset = state.serverNow - Date.now(); }
  result(id: string, error?: string): void { if (id !== this.pending) return; this.pending = undefined; clearTimeout(this.timeout); document.querySelector('#arena-error')!.textContent = error ?? ''; this.render(); }
  update(reducedMotion: boolean): void {
    const now = Date.now() + this.offset; this.graphics.clear();
    for (const shield of this.ice?.shields ?? []) if (shield.roomId === this.room && shield.expiresAt > now) {
      const x = shield.x * TILE + 1, y = shield.y * TILE - 7;
      this.graphics.fillStyle(0x5598d0, .85).fillRect(x, y + 2, 14, 22).fillStyle(0xa8e8fa, .9).fillRect(x + 2, y, 10, 21);
      this.graphics.fillStyle(0xe3ffff, .9).fillRect(x + 3, y + 2, 2, 14).fillRect(x + 6, y + 6, 6, 2);
      this.graphics.lineStyle(1, 0xd4f8ff).strokeRect(x, y + 2, 14, 22);
    }
    if (this.room === 'arena' && this.state) {
      for (const shot of this.state.projectiles) {
        const x = (shot.x + .5) * TILE, y = (shot.y + .5) * TILE - 6;
        this.graphics.fillStyle(0xe77d43).fillRect(x - 4, y - 7, 8, 10).fillStyle(0xffcf65).fillRect(x - 2, y - 4, 5, 7).fillStyle(0xfff0bd).fillRect(x, y, 2, 3);
        if (!reducedMotion) this.graphics.fillStyle(0xf6ba5d, .4).fillRect(x - 6, y + 2, 3, 3);
      }
      const key = `${this.state.revision}:${Math.ceil(Math.max(0, this.state.endsAt - now) / 1000)}`; if (key !== this.key) { this.key = key; this.render(); }
    }
    this.scene.game.canvas.dataset.iceShields = JSON.stringify(this.ice?.shields.filter((shield) => shield.roomId === this.room && shield.expiresAt > now) ?? []);
    this.scene.game.canvas.dataset.arena = this.room === 'arena' ? JSON.stringify(this.state ?? null) : '';
  }
  destroy(): void { clearTimeout(this.timeout); this.graphics.destroy(); }
  private render(): void {
    const panel = document.querySelector<HTMLElement>('#arena-panel')!; panel.hidden = this.room !== 'arena';
    const state = this.state, playing = state?.phase === 'playing', mine = state?.fighters.some((fighter) => fighter.id === this.selfId);
    document.querySelector('#arena-status')!.textContent = state ? `${state.result}${playing ? ` 残り${Math.max(0, Math.ceil((state.endsAt - (Date.now() + this.offset)) / 1000))}秒` : ''}` : '対戦の情報を確認しています。';
    const list = document.querySelector('#arena-fighters')!; list.replaceChildren();
    for (const fighter of state?.fighters ?? []) {
      const card = document.createElement('div'), name = document.createElement('strong'), bar = document.createElement('progress'), hp = document.createElement('span'); card.className = 'arena-fighter';
      name.textContent = fighter.name + (fighter.id === this.selfId ? '（あなた）' : ''); bar.max = 100; bar.value = fighter.hp; bar.setAttribute('aria-label', `${fighter.name}のHP`); hp.textContent = `HP ${fighter.hp} / 100`; card.append(name, bar, hp); list.append(card);
    }
    const join = document.querySelector<HTMLButtonElement>('#arena-join')!, leave = document.querySelector<HTMLButtonElement>('#arena-leave')!;
    join.disabled = !this.connected || !state || !!this.pending || !!playing || !!mine && state.phase === 'waiting'; join.textContent = state?.phase === 'finished' ? '次の対戦に参加' : '対戦に参加';
    leave.disabled = !this.connected || !!this.pending || !mine || state?.phase === 'finished';
  }
}
