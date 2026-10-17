import { IDLE_ROBOT, ROBOT_ACTIONS } from '../src/game/robot.ts';
import type { RobotAction, RobotSnapshot, RobotState } from '../src/game/robot.ts';
export class RobotSimulation {
  private state: RobotState = { ...IDLE_ROBOT };
  snapshot(now: number): RobotSnapshot {
    return { serverNow: now, state: this.state.action && now >= this.state.endsAt ? { ...IDLE_ROBOT, version: this.state.version } : { ...this.state } };
  }
  start(action: RobotAction, operator: string, now: number): boolean {
    if (this.state.action && now < this.state.endsAt) return false;
    this.state = { action, operator, startedAt: now, endsAt: now + ROBOT_ACTIONS[action].duration, version: this.state.version + 1 }; return true;
  }
  tick(now: number): boolean {
    if (!this.state.action || now < this.state.endsAt) return false;
    this.state = { ...IDLE_ROBOT, version: this.state.version }; return true;
  }
}
