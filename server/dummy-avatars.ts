import { DEFAULT_APPEARANCE } from '../src/game/avatar.ts';
import { getRoom } from '../src/game/rooms.ts';
import type { RoomId } from '../src/game/rooms.ts';
import type { Player } from '../src/network/protocol.ts';
import type { RoomObject } from '../src/game/objects.ts';
import { walkableWithObjects } from '../src/game/objects.ts';
import type { ReactionKind } from '../src/game/reactions.ts';
import { REACTIONS } from '../src/game/reactions.ts';
import { SPELLS } from '../src/game/spells.ts';
import type { Point } from '../src/game/world.ts';
export const DUMMY_IDS = ['00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003'] as const;
const names = ['【テスト】ハナ', '【テスト】ソラ', '【テスト】モク'];
const moves = [{ direction: 'left', x: -1, y: 0 }, { direction: 'up', x: 0, y: -1 }, { direction: 'right', x: 1, y: 0 }, { direction: 'down', x: 0, y: 1 }] as const;
export class DummyAvatars {
  private people: Player[] = [];
  private paused = new Map<string, number>();
  private anchors = new Map<string, Point>();
  private step = 0;
  list(): Player[] { return this.people; }
  set(enabled: boolean, roomId: RoomId, slots: () => number, humans: Iterable<Player>, objects: readonly RoomObject[]): void {
    const previous = this.people; this.people = []; this.paused.clear(); this.anchors.clear();
    if (!enabled) return;
    const room = getRoom(roomId), occupied = [...humans].filter(p => p.roomId === roomId);
    for (let i = 0; i < DUMMY_IDS.length; i++) {
      const origin = { x: room.spawn.x - 4 + i * 3, y: room.spawn.y - 3 }, tiles: { x: number; y: number }[] = [];
      for (let y = 1; y < 19; y++) for (let x = 1; x < 29; x++)
        if (walkableWithObjects(x, y, roomId, objects) && ![...occupied, ...this.people].some(p => p.x === x && p.y === y) &&
            Math.abs(x - room.spawn.x) + Math.abs(y - room.spawn.y) > 1 && Math.abs(x - room.door.x) + Math.abs(y - room.door.y) > 1) tiles.push({ x, y });
      tiles.sort((a, b) => Math.abs(a.x - origin.x) + Math.abs(a.y - origin.y) - Math.abs(b.x - origin.x) - Math.abs(b.y - origin.y));
      if (!tiles[0]) continue;
      this.anchors.set(DUMMY_IDS[i], { ...room.spawn });
      this.people.push({ id: DUMMY_IDS[i], slot: previous.find(p => p.id === DUMMY_IDS[i])?.slot ?? slots(), name: names[i], dummy: true, outfit: i, roomId, ...tiles[0], facing: 'down', slack: null,
        appearance: { ...DEFAULT_APPEARANCE, color: i, gender: i === 0 ? 2 : i === 1 ? 1 : 0, hair: i, clothing: i, heldItem: [4, 1, 3][i] } });
    }
  }
  summoned(id: string, now: number): void {
    const person = this.people.find(p => p.id === id); if (!person) return;
    this.anchors.set(id, { x: person.x, y: person.y });
    this.paused.set(id, Math.max(this.paused.get(id) ?? 0, now + SPELLS.call.cooldown));
  }
  tick(humans: Iterable<Player>, objects: readonly RoomObject[], now = Date.now()): Player[] {
    const changed: Player[] = [], occupied = [...humans]; this.step++;
    for (const [i, player] of this.people.entries()) {
      if (player.resting || now < (this.paused.get(player.id) ?? 0) || (this.step + i) % 3 === 0) continue;
      const room = getRoom(player.roomId);
      const anchor = this.anchors.get(player.id) ?? room.spawn;
      for (let turn = 0; turn < moves.length; turn++) {
        const move = moves[(this.step + i + turn) % moves.length], x = player.x + move.x, y = player.y + move.y;
        if (!walkableWithObjects(x, y, player.roomId, objects) || Math.abs(x - anchor.x) > 7 || Math.abs(y - anchor.y) > 6 ||
            [...occupied, ...this.people.filter(p => p !== player)].some(p => p.roomId === player.roomId && p.x === x && p.y === y) ||
            Math.abs(x - room.door.x) + Math.abs(y - room.door.y) < 2) continue;
        Object.assign(player, { x, y, facing: move.direction }); changed.push(player); break;
      }
    }
    return changed;
  }
  respond(id: string, text: string, now = Date.now()): { text: string; player: Player; reaction?: ReactionKind; posture?: boolean } | undefined {
    const player = this.people.find(p => p.id === id); if (!player) return;
    const reaction: ReactionKind | undefined = /ジャンプ/.test(text) ? 'jump' : /お辞儀|おじぎ/.test(text) ? 'bow' : /バンザイ|ばんざい/.test(text) ? 'cheer' : /怒|投げ/.test(text) ? 'anger' : /喜|よろこ/.test(text) ? 'joy' : undefined;
    if (/起き|おきて/.test(text)) { player.resting = false; return { player, posture: true, text: '【テスト用・自動返信】起きました！ また少し歩いてみます。' }; }
    if (/寝|ねて/.test(text)) { player.resting = true; return { player, posture: true, text: '【テスト用・自動返信】床に寝転びました。「起きて」で戻ります。' }; }
    if (reaction) {
      player.resting = false; this.paused.set(id, Math.max(this.paused.get(id) ?? 0, now + REACTIONS[reaction].duration + 200));
      return { player, posture: true, reaction, text: `【テスト用・自動返信】${REACTIONS[reaction].label}をやってみました。アバターの動きも見てみてね！` };
    }
    const reply = /こんにちは|おはよう|こんばんは|はじめまして/.test(text) ? 'こんにちは！ メッセージが届いています。未読や履歴のテストにも使ってね。'
      : /ありがとう/.test(text) ? 'どういたしまして！ テストに付き合えてうれしいです。'
      : /ヘルプ|できる|使い方/.test(text) ? 'DMには自動で返事をします。「ジャンプ」「お辞儀」「バンザイ」「怒って」「寝て」「起きて」も試せます。音声には参加しません。'
      : `「${text.slice(0, 100)}」を受け取りました！ 「ジャンプ」や「お辞儀」と送ると、動きも試せます。`;
    return { player, text: `【テスト用・自動返信】${reply}` };
  }
}
