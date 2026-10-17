import { isRhythmGame, nearestBeat } from './arcade-rhythm.ts';
import type { ArcadeTable } from './arcade.ts';
export function rhythmCue(table: ArcadeTable, now: number, id: string): string {
  if (table.phase !== 'playing') return 'ひとりでも、みんなでも。気軽にどうぞ。';
  if (now < table.startedAt + 2500) return `${Math.max(1, Math.ceil((table.startedAt + 3000 - now) / 1000))}… 準備はいい？`;
  const hold = table.holds.find((h) => h.id === id);
  if (hold) return `${table.beats[hold.beatId].span / 1000}秒で取り出す！ あと${Math.max(0, (hold.startedAt + table.beats[hold.beatId].span - now) / 1000).toFixed(1)}秒`;
  const beat = nearestBeat(table.beats, now); if (!beat) return '';
  if (table.game === 'echo') {
    const demo = table.beats.find((b) => now >= b.cueAt - 150 && now < b.cueAt + 450);
    if (demo) return `お手本：${demo.key ? '右 →' : '← 左'}！ よく見てね`;
    const phrase = Math.max(0, Math.min(4, Math.floor((now - table.startedAt - 3000) / 6000))), first = table.beats[phrase * 3];
    if (now < first.at - 350) return 'ねこのお手本を見よう。左・右をおぼえて！';
  }
  if (Math.abs(now - beat.at) <= 340) return table.game === 'toast' ? 'いま、焼く！' : table.game === 'clap' ? 'パン！' : table.game === 'star' ? `${beat.key + 1}番の星！ キャッチ！` : table.game === 'echo' ? 'お返事！ 左・右をまねして！' : `${beat.key ? '右 →' : '← 左'}！ いま！`;
  return table.game === 'toast' ? `次は${beat.span / 1000}秒焼くよ。合図で押そう` : 'リズムにのって、次の合図を待とう。';
}
export function paintRhythm(ctx: CanvasRenderingContext2D, t: ArcadeTable, now: number, id: string): void {
  const rect = (color: string, x: number, y: number, w: number, h: number) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const text = (value: string, x: number, y: number, color = '#e9dfc6', size = 12) => { ctx.fillStyle = color; ctx.font = `bold ${size}px monospace`; ctx.textAlign = 'center'; ctx.fillText(value, x, y); };
  const nearest = nearestBeat(t.beats, now), pulse = nearest && Math.abs(nearest.at - now) < 180, mine = t.members.find((m) => m.id === id);
  if (t.game === 'clap') {
    const distance = nearest ? Math.min(62, Math.abs(nearest.at - now) / 12) : 40;
    ctx.strokeStyle = '#efbf76'; ctx.lineWidth = 3; ctx.strokeRect(168 - 32 - distance / 2, 70 - distance / 2, 64 + distance, 64 + distance);
    rect('#d9a389', 144, 66, 48, 48); rect('#665274', 144, 56, 48, 14); rect('#28374d', 156, 83, 5, 6); rect('#28374d', 177, 83, 5, 6); rect('#94cebd', 143, 115, 50, 32);
    const hand = pulse ? 0 : 20; rect('#f3d1a4', 151 - hand, 115, 14, 18); rect('#f3d1a4', 171 + hand, 115, 14, 18);
    text(pulse ? 'CLAP!' : 'READY...', 168, 177, '#efbf76', 16);
  } else if (t.game === 'echo') {
    const phrase = Math.max(0, Math.min(4, Math.floor((now - t.startedAt - 3000) / 6000)));
    const beats = t.beats.slice(phrase * 3, phrase * 3 + 3);
    text('LISTEN  >  ECHO', 168, 24, '#dba4b7');
    for (const [index, beat] of beats.entries()) {
      const x = 76 + index * 76, active = Math.abs(now - beat.cueAt) < 280 || Math.abs(now - beat.at) < 200;
      rect(active ? '#f2d2ac' : '#967b95', x, 64, 40, 38); rect('#dba4b7', x, 56, 10, 12); rect('#dba4b7', x + 30, 56, 10, 12);
      rect('#27374d', x + 8, 76, 5, 5); rect('#27374d', x + 27, 76, 5, 5); rect('#efbf76', x + 17, 89, 6, 4);
      text(now >= (beats[0]?.at ?? 0) - 350 ? '?' : now >= beat.cueAt - 200 ? beat.key ? '2 >' : '< 1' : '...', x + 20, 132, active ? '#efbf76' : '#b8c6cc', 16);
      if (active) rect('#94cebd', x + (beat.key ? 32 : -5), 96, 14, 18);
    }
    text(`${phrase + 1} / 5`, 168, 175, '#94cebd');
  } else if (t.game === 'sort' || t.game === 'star') {
    rect('#94cebd', 166, 34, 4, 135);
    if (t.game === 'sort') { rect('#738597', 12, 122, 312, 15); for (let i = 0; i < 16; i++) rect('#3e516e', 14 + i * 20, 126, 9, 7); text('LEFT  <  |  >  RIGHT', 168, 183); }
    else for (let lane = 0; lane < 3; lane++) { rect('#4b5e7e', 12, 68 + lane * 42, 312, 1); text(String(lane + 1), 22, 63 + lane * 42, '#b2aedb'); }
    for (const beat of t.beats) {
      const x = 168 + (beat.at - now) * .12; if (x < 26 || x > 308) continue;
      const y = t.game === 'sort' ? 86 : 50 + beat.key * 42;
      if (t.game === 'sort') { rect(beat.key ? '#a4bbc9' : '#efbf76', x - 16, y, 32, 32); text(beat.key ? '>' : '<', x, y + 23, '#25374e', 22); }
      else { rect('#efbf76', x - 9, y + 5, 18, 8); rect('#fff1bd', x - 4, y, 8, 18); }
    }
    text(t.game === 'sort' ? 'SORT!' : 'CATCH THE STAR', 168, 22, '#efbf76');
  } else {
    const hold = t.holds.find((h) => h.id === id), beat = hold ? t.beats[hold.beatId] : nearest;
    const elapsed = hold ? now - hold.startedAt : 0, ratio = Math.min(1.3, Math.max(0, elapsed / (beat?.span ?? 1200)));
    rect('#7a8795', 96, 87, 144, 73); rect('#d1b783', 103, 88, 130, 10); rect('#28374d', 112, 77, 111, 10);
    const breadY = hold ? 65 + Math.min(16, ratio * 16) : 49;
    rect(ratio > 1.1 ? '#b77c69' : '#f2cf93', 131, breadY, 74, 40); rect('#e7b478', 138, breadY + 6, 60, 28);
    rect('#28374d', 151, breadY + 14, 4, 5); rect('#28374d', 181, breadY + 14, 4, 5); rect('#94cebd', 157, 135, 23, 10);
    rect('#53647a', 48, 174, 240, 9); rect('#efbf76', 48, 174, Math.min(240, ratio * 180), 9); rect('#94cebd', 225, 169, 5, 20);
    text(hold ? 'TAKE IT OUT!' : `${(beat?.span ?? 1200) / 1000}s TOAST`, 168, 28, '#efbf76');
  }
  if (mine?.verdict) text(`${mine.score} PT  COMBO ${mine.combo ?? 0}`, 168, 196, '#a8d6c8', 9);
}
export class ArcadeSound {
  private context?: AudioContext;
  private scheduled = new Set<string>();
  private oscillators = new Set<OscillatorNode>();
  private key = '';
  enabled = false;
  async toggle(): Promise<boolean> {
    if (this.enabled) { this.enabled = false; this.stop(); return false; }
    try { this.context ??= new AudioContext(); await this.context.resume(); this.enabled = this.context.state === 'running'; this.scheduled.clear(); } catch { this.enabled = false; }
    return this.enabled;
  }
  update(t: ArcadeTable | undefined, now: number, id: string): void {
    if (!this.enabled || !this.context) return;
    if (!t || t.phase !== 'playing' || !isRhythmGame(t.game)) { this.stop(); return; }
    if (this.key !== t.roundId) { this.stop(); this.key = t.roundId; }
    const notes = t.beats.flatMap((b) => t.game === 'echo' ? [{ at: b.cueAt, key: b.key, tag: `demo-${b.id}` }, { at: b.at, key: b.key + 2, tag: `reply-${b.id}` }] : [{ at: b.at, key: t.game === 'clap' ? b.id % 4 : b.key, tag: `beat-${b.id}` }]);
    for (const hold of t.holds) if (hold.id === id) notes.push({ at: hold.startedAt + t.beats[hold.beatId].span, key: 4, tag: `toast-${hold.beatId}` });
    for (const note of notes) {
      if (this.scheduled.has(note.tag) || note.at < now - 80 || note.at > now + 250) continue;
      this.scheduled.add(note.tag); const at = this.context.currentTime + Math.max(0, (note.at - now) / 1000);
      const oscillator = this.context.createOscillator(), gain = this.context.createGain(); oscillator.type = 'square'; oscillator.frequency.value = [261.63, 329.63, 392, 523.25, 659.25][note.key % 5];
      gain.gain.setValueAtTime(.025, at); gain.gain.exponentialRampToValueAtTime(.001, at + .09); oscillator.connect(gain); gain.connect(this.context.destination); this.oscillators.add(oscillator);
      oscillator.onended = () => { this.oscillators.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }; oscillator.start(at); oscillator.stop(at + .1);
    }
  }
  stop(): void { for (const oscillator of this.oscillators) { try { oscillator.stop(); } catch { /* Already ended. */ } } this.oscillators.clear(); this.scheduled.clear(); }
  destroy(): void { this.stop(); void this.context?.close(); }
}
