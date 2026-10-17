import Phaser from 'phaser';
import { cockpitHorizonPixels, robotPixels } from './robot-art.ts';
import { IDLE_ROBOT, ROBOT_ACTIONS } from './robot.ts';
import type { RobotSnapshot } from './robot.ts';
import type { RoomId } from './rooms.ts';
export class CockpitView {
  private room: RoomId = 'office';
  private snapshot: RobotSnapshot = { state: IDLE_ROBOT, serverNow: 0 };
  private offset = 0;
  private key = '';
  private horizon: Phaser.GameObjects.Graphics;
  private robot: Phaser.GameObjects.Graphics;
  private status: Phaser.GameObjects.Text;
  constructor(scene: Phaser.Scene) {
    this.horizon = scene.add.graphics().setPosition(150, 21).setDepth(97);
    this.robot = scene.add.graphics().setPosition(49, 37).setScale(0.36).setDepth(98);
    this.status = scene.add.text(240, 113, '', { fontFamily: 'sans-serif', fontSize: '7px', color: '#d9f1dc', backgroundColor: '#2d495c', padding: { x: 3, y: 2 } }).setOrigin(0.5, 0).setDepth(320 + 17).setResolution(2);
    this.setRoom('office');
  }
  setRoom(room: RoomId): void { this.room = room; this.key = ''; for (const view of [this.horizon, this.robot, this.status]) view.setVisible(room === 'cockpit'); }
  receive(snapshot: RobotSnapshot): void { this.snapshot = snapshot; this.offset = snapshot.serverNow - Date.now(); this.key = ''; }
  update(now: number, reduced: boolean): void {
    if (this.room !== 'cockpit') return;
    const state = this.snapshot.state, serverNow = now + this.offset, action = state.action && serverNow < state.endsAt ? state.action : null;
    const elapsed = action ? serverNow - state.startedAt : 0;
    const key = `${state.version}:${action}:${reduced}:${reduced ? 0 : Math.floor(elapsed / 120)}`; if (key === this.key) return; this.key = key;
    this.horizon.clear(); this.robot.clear();
    for (const p of cockpitHorizonPixels(action, elapsed, 182, 70, reduced)) this.horizon.fillStyle(p.color).fillRect(p.x, p.y, p.w, p.h);
    for (const p of robotPixels(action, elapsed, reduced)) this.robot.fillStyle(p.color).fillRect(p.x, p.y, p.w, p.h);
    this.status.setText(action ? ROBOT_ACTIONS[action].message : 'WAIWAI-01 · STANDBY / 訓練ビュー');
  }
  destroy(): void { this.horizon.destroy(); this.robot.destroy(); this.status.destroy(); }
}
