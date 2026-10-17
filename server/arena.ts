import { randomUUID } from 'node:crypto';
import { ARENA_HP, FIRE_DAMAGE, ARENA_DURATION, ICE_DURATION } from '../src/game/arena.ts';
import type { ArenaState, IceShield, IceSnapshot } from '../src/game/arena.ts';
import type { Player } from '../src/network/protocol.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import type { RoomId } from '../src/game/rooms.ts';
const vectors = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] } as const;
export class IceShields {
  private shields: IceShield[] = [];
  tick(now: number): boolean { const count = this.shields.length; this.shields = this.shields.filter((shield) => shield.expiresAt > now); return count !== this.shields.length; }
  snapshot(ownerId: string, roomId: RoomId, now: number): IceSnapshot {
    return { shields: this.shields.filter((shield) => shield.roomId === roomId && shield.expiresAt > now).map((shield) => ({ ...shield })), activeUntil: this.shields.find((shield) => shield.ownerId === ownerId && shield.expiresAt > now)?.expiresAt ?? 0, serverNow: now };
  }
  objects(now: number): RoomObject[] { return this.shields.filter((shield) => shield.expiresAt > now).map((shield) => ({ id: shield.id, owner: shield.ownerId, roomId: shield.roomId, x: shield.x, y: shield.y, kind: 'box', rotation: 0 })); }
  place(player: Player, people: Iterable<Player>, objects: readonly RoomObject[], now: number): string | undefined {
    this.tick(now);
    if (this.shields.some((shield) => shield.ownerId === player.id)) return '前の氷が消えるまでブリザドは使えません。';
    const [dx, dy] = vectors[player.facing], x = player.x + dx, y = player.y + dy;
    if (!walkableWithObjects(x, y, player.roomId, [...objects, ...this.objects(now)]) || [...people].some((person) => person.roomId === player.roomId && person.x === x && person.y === y)) return '目の前のマスが空いていません。向きを変えてください。';
    this.shields.push({ id: randomUUID(), ownerId: player.id, roomId: player.roomId, x, y, expiresAt: now + ICE_DURATION });
  }
  clearArena(): void { this.shields = this.shields.filter((shield) => shield.roomId !== 'arena'); }
}
export class MagicArena {
  private state: ArenaState = { roundId: '', phase: 'waiting', fighters: [], endsAt: 0, result: '2人が参加すると対戦が始まります。', projectiles: [], revision: 0 };
  snapshot(): ArenaState { return structuredClone(this.state); }
  active(id: string): boolean { return this.state.phase === 'playing' && this.state.fighters.some((fighter) => fighter.id === id); }
  join(player: Player, now: number): string | undefined {
    if (player.roomId !== 'arena') return '魔法闘技場で参加してください。';
    if (this.state.phase === 'playing') return '対戦中です。結果が出るまで観戦できます。';
    if (this.state.phase === 'finished') this.state = { ...this.state, phase: 'waiting', fighters: [], projectiles: [], winnerId: undefined, result: '対戦相手を待っています。' };
    if (this.state.fighters.some((fighter) => fighter.id === player.id)) return 'すでに参加しています。';
    this.state.fighters.push({ id: player.id, name: player.name, hp: ARENA_HP }); this.state.revision++;
    if (this.state.fighters.length === 2) { this.state.phase = 'playing'; this.state.roundId = randomUUID(); this.state.endsAt = now + ARENA_DURATION; this.state.result = '対戦開始！ ファイアで相手に当てよう。'; }
  }
  leave(id: string): boolean {
    if (!this.state.fighters.some((fighter) => fighter.id === id)) return false;
    if (this.state.phase === 'playing') this.finish(this.state.fighters.find((fighter) => fighter.id !== id)?.id, '途中退出');
    else if (this.state.phase === 'waiting') { this.state.fighters = this.state.fighters.filter((fighter) => fighter.id !== id); this.state.revision++; }
    return true;
  }
  fire(player: Player, now: number): void {
    if (!this.active(player.id)) return;
    this.state.projectiles.push({ id: randomUUID(), ownerId: player.id, x: player.x, y: player.y, direction: player.facing, nextAt: now + 80, remaining: 10 }); this.state.revision++;
  }
  tick(now: number, people: Iterable<Player>, objects: readonly RoomObject[]): boolean {
    if (this.state.phase !== 'playing') return false;
    const revision = this.state.revision, players = [...people];
    if (now >= this.state.endsAt) {
      const [a, b] = this.state.fighters; this.finish(a.hp === b.hp ? undefined : a.hp > b.hp ? a.id : b.id, '時間切れ'); return true;
    }
    const active = [];
    for (const shot of this.state.projectiles) {
      let live = true;
      while (live && shot.nextAt <= now && this.state.phase === 'playing') {
        const [dx, dy] = vectors[shot.direction]; shot.x += dx; shot.y += dy; shot.remaining--; shot.nextAt += 80; this.state.revision++;
        if (!walkableWithObjects(shot.x, shot.y, 'arena', objects)) { live = false; break; }
        const target = this.state.fighters.find((fighter) => fighter.id !== shot.ownerId && players.some((person) => person.id === fighter.id && person.roomId === 'arena' && person.x === shot.x && person.y === shot.y));
        if (target) { target.hp = Math.max(0, target.hp - FIRE_DAMAGE); live = false; if (!target.hp) this.finish(shot.ownerId, 'HPが0になりました'); }
        if (!shot.remaining) live = false;
      }
      if (live && this.state.phase === 'playing') active.push(shot);
    }
    this.state.projectiles = this.state.phase === 'playing' ? active : [];
    return revision !== this.state.revision;
  }
  private finish(winnerId: string | undefined, reason: string): void {
    this.state.phase = 'finished'; this.state.winnerId = winnerId; this.state.result = `${winnerId ? `${this.state.fighters.find((fighter) => fighter.id === winnerId)!.name}さんの勝ち！` : '引き分け！'} ${reason}`; this.state.projectiles = []; this.state.revision++;
  }
}
