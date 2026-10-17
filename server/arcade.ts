import { isRhythmGame, rhythmBeats, timingScore, TIMING_WINDOW } from '../src/game/arcade-rhythm.ts';
import { randomUUID } from 'node:crypto';
import { ARCADE_IDS, fourWinner, arcadeCapacity } from '../src/game/arcade.ts';
import type { ArcadeAction, ArcadeGame, ArcadeSnapshot, ArcadeTable } from '../src/game/arcade.ts';
type Station = { table: ArcadeTable; expires: number; cueAt: number; nextAt: number; serial: number; fireAt: Map<string, number>; attempted: Map<string, Set<number>>; cpuAt: number };
export class ArcadeRoom {
  private stations = new Map<ArcadeGame, Station>();
  private random: () => number;
  constructor(random = Math.random) { this.random = random; for (const game of ARCADE_IDS) this.reset(game); }
  private reset(game: ArcadeGame): void {
    this.stations.set(game, { table: { game, roundId: randomUUID(), revision: 0, phase: 'lobby', members: [], startedAt: 0, beats: [], holds: [], endsAt: 0, message: 'ひとりでも、みんなでも。参加してスタート！', board: Array<number>(42).fill(0), turn: 0, round: 0, light: 'wait', health: 8, meteors: [], saved: 0 }, expires: 0, cueAt: 0, nextAt: 0, serial: 0, fireAt: new Map(), attempted: new Map(), cpuAt: 0 });
  }
  snapshot(now: number): ArcadeSnapshot { return { serverNow: now, tables: structuredClone([...this.stations.values()].map((s) => s.table)) }; }
  private finish(s: Station, message: string, now: number): void { s.table.phase = 'done'; s.table.message = message; s.table.meteors = []; s.expires = now + 60_000; }
  private nextReflex(s: Station, now: number): void { s.table.round++; s.table.light = 'wait'; s.table.message = 'まだだよ…「ピカッ！」を待って！'; s.cueAt = now + 1800 + Math.floor(this.random() * 2600); s.cpuAt = s.cueAt + 650 + Math.floor(this.random() * 650); }
  private reflexPoint(s: Station, winner: number | undefined, text: string, now: number): void {
    const t = s.table; if (winner !== undefined) t.members[winner].score++;
    t.light = 'result'; t.message = text; s.nextAt = now + 1600;
    if (t.round >= 5) {
      const [a, b] = t.members;
      this.finish(s, a.score === b.score ? '5本終了！ 引き分け。もう一回？' : `${a.score > b.score ? a.name : b.name} の勝ち！ お互いに拍手！`, now);
    }
  }
  apply(action: ArcadeAction, person: { id: string; name: string }, now: number): string | undefined {
    this.tick(now);
    const s = this.stations.get(action.game)!, t = s.table;
    if (action.roundId !== t.roundId) return '試合が更新されました。現在の状態でもう一度操作してください。';
    const member = t.members.findIndex((m) => m.id === person.id);
    if (action.command === 'join') {
      if (member >= 0) return 'すでに参加しています。';
      if ([...this.stations.values()].some((v) => v.table.members.some((m) => m.id === person.id))) return '参加中のゲームから抜けてから、こちらへどうぞ。';
      if (t.phase !== 'playing') t.members = t.members.filter((m) => !m.id.startsWith('cpu:'));
      if (t.phase === 'playing' || t.members.length >= arcadeCapacity(t.game)) return 'ただいまプレイ中、または満席です。観戦して待ってね。';
      t.members.push({ ...person, name: person.name.slice(0, 12), score: 0 }); s.expires = now + 120_000;
      if (t.phase === 'lobby') t.message = t.members.length >= 2 ? 'メンバー集合！ どちらからでもスタートできます。' : 'ひとりでもスタートできます。友だちを待ってもOK！';
    } else {
      if (member < 0) return 'まず「参加する」を押してください。';
      if (action.command === 'leave') { this.leave(person.id, now); return; }
      if (action.command === 'start') {
        if (t.phase === 'playing') return 'いまはプレイ中です。';
        if ((t.game === 'four' || t.game === 'reflex') && t.members.length === 1) t.members.push({ id: `cpu:${t.game}`, name: 'ワイワイCPU', score: 0 });
        // A fresh round identity rejects delayed clicks from the previous game.
        t.roundId = randomUUID(); t.phase = 'playing'; t.startedAt = now; t.endsAt = now + (t.game === 'four' ? 90_000 : 60_000);
        t.members.forEach((m) => { m.score = 0; }); t.board.fill(0); t.turn = 0; t.round = 0; t.health = 8; t.saved = 0; t.meteors = []; s.fireAt.clear(); s.attempted.clear(); t.beats = []; t.holds = [];
        t.members.forEach((m) => { m.combo = 0; m.bestCombo = 0; m.lastHit = -1; m.verdict = ''; });
        if (isRhythmGame(t.game)) { t.beats = rhythmBeats(t.game, now, this.random); const last = t.beats.at(-1)!; t.endsAt = last.at + last.span + 1800; }
        t.message = t.game === 'four' ? `${t.members[0].name} の番！ 星を落とす列を選ぼう。` : '空を分担して、60秒間街を守ろう！';
        if (t.game === 'reflex') this.nextReflex(s, now);
        if (t.game === 'meteor') s.nextAt = now + 1000;
        if (isRhythmGame(t.game)) t.message = '3、2、1… 自分のペースで、リズムにのろう！';
      } else {
        if (t.phase !== 'playing') return 'いまはプレイ中ではありません。';
        if (action.command === 'drop' && t.game === 'four') {
          if (member !== t.turn) return '相手の番です。';
          const error = this.drop(s, member, action.value!, now); if (error) return error;
        } else if (action.command === 'tap' && t.game === 'reflex') {
          if (action.value !== t.round || t.light === 'result') return '次のお題を待ってください。';
          const winner = t.light === 'go' ? member : 1 - member;
          this.reflexPoint(s, winner, t.light === 'go' ? `${t.members[winner].name} が先に押した！` : `${person.name} がフライング！ 相手に1点。`, now);
        } else if (action.command === 'fire' && t.game === 'meteor') {
          if (now - (s.fireAt.get(person.id) ?? -Infinity) < 450) return 'チャージ中…0.45秒おきに撃てます。';
          s.fireAt.set(person.id, now);
          const target = t.meteors.find((m) => m.lane === action.value);
          if (target) { t.meteors = t.meteors.filter((m) => m.id !== target.id); t.saved++; t.members[member].score++; t.message = `${person.name} が${target.lane + 1}番の空を守った！`; }
          else t.message = `${person.name} が${action.value! + 1}番の空を確認。まだ平和！`;
        } else if (isRhythmGame(t.game) && (action.command === 'beat' || action.command === 'toast-press' || action.command === 'toast-release')) {
          const error = this.rhythmInput(s, action, member, now); if (error) return error;
        } else return 'このゲームでは使えない操作です。';
      }
    }
    t.revision++; return;
  }
  private drop(s: Station, member: number, col: number, now: number): string | undefined {
    const t = s.table; let row = 5;
    while (row >= 0 && t.board[row * 7 + col]) row--;
    if (row < 0) return 'その列はいっぱいです。';
    const index = row * 7 + col; t.board[index] = member + 1; t.members[member].score++;
    if (fourWinner(t.board, index)) this.finish(s, `${t.members[member].name} の勝ち！ 4つつながった！`, now);
    else if (t.board.every(Boolean)) this.finish(s, '盤面いっぱい！ 引き分け。いい勝負！', now);
    else { t.turn = 1 - t.turn; t.message = `${t.members[t.turn].name} の番！`; s.cpuAt = now + 650; }
  }
  private cpuColumn(board: number[], piece: number): number {
    const columns = [3, 2, 4, 1, 5, 0, 6].filter((col) => !board[col]);
    for (const candidate of [piece, 3 - piece]) for (const col of columns) {
      let row = 5; while (board[row * 7 + col]) row--;
      const trial = [...board], index = row * 7 + col; trial[index] = candidate;
      if (fourWinner(trial, index)) return col;
    }
    return columns[Math.floor(this.random() * Math.min(3, columns.length))];
  }
  private rhythmInput(s: Station, action: ArcadeAction, index: number, now: number): string | undefined {
    const t = s.table, member = t.members[index], beat = t.beats.find((b) => b.id === action.beatId);
    if (!beat || (t.game === 'toast' ? action.command === 'beat' : action.command !== 'beat')) return 'このお題では使えない操作です。';
    const attempted = s.attempted.get(member.id) ?? new Set<number>(); s.attempted.set(member.id, attempted);
    let delta = now - beat.at;
    if (action.command === 'toast-release') {
      const hold = t.holds.find((h) => h.id === member.id && h.beatId === beat.id); if (!hold) return 'まず合図に合わせてパンを焼いてね。';
      delta = now - hold.startedAt - beat.span; t.holds = t.holds.filter((h) => h.id !== member.id);
    } else {
      if (attempted.has(beat.id)) return 'この拍は判定済み。次の合図を待ってね。';
      if (Math.abs(delta) > 1500) return 'まだそのお題の時間ではありません。';
      attempted.add(beat.id);
      if (action.command === 'toast-press' && Math.abs(delta) <= TIMING_WINDOW) {
        t.holds = t.holds.filter((h) => h.id !== member.id); t.holds.push({ id: member.id, beatId: beat.id, startedAt: now }); member.verdict = '焼いています…目盛りで取り出して！'; return;
      }
    }
    const score = action.value === beat.key ? timingScore(delta) : 0;
    member.score += score;
    member.combo = score ? member.lastHit === beat.id - 1 ? (member.combo ?? 0) + 1 : 1 : 0;
    if (score) member.lastHit = beat.id;
    member.bestCombo = Math.max(member.bestCombo ?? 0, member.combo);
    member.verdict = score === 30 ? 'ぴったり！ +30' : score ? 'いい感じ！ +15' : 'おっと！ 次の拍で合わせよう。';
    t.message = `${member.name}：${member.verdict}`;
  }
  private rhythmResult(t: ArcadeTable): string {
    const best = Math.max(...t.members.map((m) => m.score));
    const names = t.members.filter((m) => m.score === best).map((m) => m.name).join('・');
    const percent = Math.round(best / (t.beats.length * 30) * 100);
    return `${percent >= 80 ? 'ノリノリ！' : percent >= 40 ? 'いいリズム！' : 'ナイストライ！'} ${t.members.length === 1 ? '' : `${names} がトップ！ `}${best}点 / ${t.beats.length * 30}点。もう一回どうぞ！`;
  }
  leave(id: string, now: number): boolean {
    let changed = false;
    for (const [game, s] of this.stations) {
      const t = s.table, member = t.members.find((m) => m.id === id); if (!member) continue;
      t.members = t.members.filter((m) => m.id !== id); s.fireAt.delete(id); s.attempted.delete(id); t.holds = t.holds.filter((h) => h.id !== id); changed = true;
      if (!t.members.some((m) => !m.id.startsWith('cpu:'))) this.reset(game);
      else if (t.phase === 'playing' && (game === 'four' || game === 'reflex')) { this.finish(s, `${member.name} が退席したため終了。ありがとう、また遊ぼう！`, now); t.revision++; }
      else { t.message = `${member.name} が退席しました。`; t.revision++; }
    }
    return changed;
  }
  tick(now: number): boolean {
    let changed = false;
    for (const [game, s] of this.stations) {
      const t = s.table;
      if (t.phase !== 'playing') {
        if (s.expires && now >= s.expires) { this.reset(game); changed = true; }
        continue;
      }
      let updated = false;
      if (now >= t.endsAt) {
        // Resolve impacts due before the deadline even if the server timer ran late.
        if (game === 'meteor') t.health = Math.max(0, t.health - t.meteors.filter((m) => m.impactAt <= t.endsAt).length);
        this.finish(s, game === 'meteor' ? t.health ? `街を守りきった！ ${t.saved}個迎撃。みんな、ありがとう！` : `${t.saved}個迎撃！ 街はお昼寝モード。次は分担して再挑戦！` : isRhythmGame(game) ? this.rhythmResult(t) : '時間いっぱい！ 引き分け。また遊ぼう！', now); updated = true;
      }
      else if (game === 'four' && t.members[t.turn]?.id.startsWith('cpu:') && now >= s.cpuAt) {
        this.drop(s, t.turn, this.cpuColumn(t.board, t.turn + 1), now); updated = true;
      } else if (game === 'reflex') {
        if (t.light === 'wait' && now >= s.cueAt) { t.light = 'go'; t.message = 'ピカッ！ いまだ、押して！'; updated = true; }
        else if (t.light === 'go' && t.members.some((m) => m.id.startsWith('cpu:')) && now >= s.cpuAt) { this.reflexPoint(s, t.members.findIndex((m) => m.id.startsWith('cpu:')), 'ワイワイCPU が先に押した！ 次はチャンス！', now); updated = true; }
        else if (t.light === 'go' && now >= s.cueAt + 4500) { this.reflexPoint(s, undefined, 'ふたりとも見逃した！ 次こそ！', now); updated = true; }
        else if (t.light === 'result' && now >= s.nextAt) { this.nextReflex(s, now); updated = true; }
      } else if (game === 'meteor') {
        const missed = t.meteors.filter((m) => m.impactAt <= now).length;
        if (missed) { t.health = Math.max(0, t.health - missed); t.meteors = t.meteors.filter((m) => m.impactAt > now); t.message = '隕石が落ちた！ 空を分担して守ろう。'; updated = true; }
        if (!t.health) { this.finish(s, `${t.saved}個迎撃！ 街はお昼寝モード。次は分担して再挑戦！`, now); updated = true; }
        else if (now >= s.nextAt) { t.meteors.push({ id: ++s.serial, lane: Math.floor(this.random() * 3), bornAt: now, impactAt: now + 4500 }); s.nextAt = now + (t.members.length === 1 ? 1800 : 1100); updated = true; }
      }
      if (isRhythmGame(game)) for (const hold of [...t.holds]) {
        const beat = t.beats[hold.beatId];
        if (now > hold.startedAt + beat.span + TIMING_WINDOW) {
          t.holds = t.holds.filter((h) => h.id !== hold.id); const member = t.members.find((m) => m.id === hold.id);
          if (member) { member.combo = 0; member.verdict = 'こんがり焼きすぎた！ 次のパンへ。'; } updated = true;
        }
      }
      if (updated) { t.revision++; changed = true; }
    }
    return changed;
  }
}
