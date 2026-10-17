import { isRhythmGame, nearestBeat } from './arcade-rhythm.ts';
import { paintRhythm, rhythmCue, ArcadeSound } from './arcade-rhythm-view.ts';
import { ARCADE_GAMES, arcadeCapacity } from './arcade.ts';
import type { ArcadeAction, ArcadeCommand, ArcadeGame, ArcadeSnapshot, ArcadeTable } from './arcade.ts';
import type { RoomId } from './rooms.ts';
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id)! as T;
export class ArcadeUI {
  private sound = new ArcadeSound();
  private room: RoomId = 'office';
  private connected = false;
  private id = '';
  private selected: ArcadeGame = 'four';
  private snapshot?: ArcadeSnapshot;
  private offset = 0;
  private pending?: string;
  private timeout?: ReturnType<typeof setTimeout>;
  private refresh: ReturnType<typeof setInterval>;
  constructor(signal: AbortSignal, private send: (action: ArcadeAction) => boolean, private beforeOpen: () => boolean) {
    el('arcade-open').addEventListener('click', () => this.open(), { signal });
    el('arcade-sound').addEventListener('click', () => { void this.sound.toggle().then((enabled) => { el('arcade-sound').textContent = `効果音 ${enabled ? 'ON' : 'OFF'}`; el('arcade-sound').setAttribute('aria-pressed', String(enabled)); }); }, { signal });
    el('arcade-dialog').addEventListener('close', () => this.sound.stop(), { signal });
    el('arcade-close').addEventListener('click', () => el<HTMLDialogElement>('arcade-dialog').close(), { signal });
    el('arcade-tabs').addEventListener('click', (e) => {
      const game = (e.target as Element).closest<HTMLElement>('[data-arcade-game]')?.dataset.arcadeGame as ArcadeGame | undefined;
      if (game) { this.selected = game; el('arcade-error').textContent = ''; this.render(); }
    }, { signal });
    el('arcade-dialog').addEventListener('click', (e) => {
      const rhythm = (e.target as Element).closest<HTMLButtonElement>('[data-rhythm-key]');
      if (rhythm && !rhythm.disabled) { this.rhythm(Number(rhythm.dataset.rhythmKey)); return; }
      const button = (e.target as Element).closest<HTMLButtonElement>('[data-arcade-command]');
      if (!button || button.disabled) return;
      this.command(button.dataset.arcadeCommand as ArcadeCommand, button.dataset.value === undefined ? undefined : Number(button.dataset.value));
    }, { signal });
    el('arcade-dialog').addEventListener('keydown', (event) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Space' && (event.target as Element).closest('button:not([data-rhythm-key])')) return;
      if (isRhythmGame(this.selected) && (['1', '2', '3'].includes(event.key) || event.code === 'Space')) {
        event.preventDefault(); this.rhythm(event.code === 'Space' ? 0 : Number(event.key) - 1);
      } else if (this.selected === 'meteor' && ['1', '2', '3'].includes(event.key)) { event.preventDefault(); this.command('fire', Number(event.key) - 1); }
    }, { signal });
    this.refresh = setInterval(() => { if (el<HTMLDialogElement>('arcade-dialog').open && !document.hidden) { this.clock(); this.paint(); this.sound.update(this.table(), Date.now() + this.offset, this.id); } else this.sound.stop(); }, 50);
  }
  setIdentity(id: string): void { this.id = id; this.render(); }
  setConnected(connected: boolean): void { this.connected = connected; if (!connected) { this.sound.stop(); this.snapshot = undefined; this.cancelPending(); } this.render(); }
  setRoom(room: RoomId): void {
    if (room !== this.room) { this.snapshot = undefined; this.cancelPending(); }
    this.sound.stop(); this.room = room; el('arcade-panel').hidden = room !== 'arcade';
    if (room !== 'arcade') el<HTMLDialogElement>('arcade-dialog').close(); this.render();
  }
  receive(snapshot: ArcadeSnapshot): void { const previous = this.table()?.phase; this.snapshot = { ...snapshot, tables: Object.values({ ...Object.fromEntries((this.snapshot?.tables ?? []).map((t) => [t.game, t])), ...Object.fromEntries(snapshot.tables.map((t) => [t.game, t])) }) }; this.offset = snapshot.serverNow - Date.now(); this.render(); if (previous !== 'playing' && this.table()?.phase === 'playing' && el<HTMLDialogElement>('arcade-dialog').open) el('arcade-screen').scrollIntoView({ block: 'center' }); }
  result(actionId: string, error?: string): void { if (this.pending !== actionId) return; this.cancelPending(); el('arcade-error').textContent = error ?? ''; this.render(); }
  open(game?: ArcadeGame): void {
    if (this.room !== 'arcade' || !this.beforeOpen()) return;
    if (game) this.selected = game; this.render(); el<HTMLDialogElement>('arcade-dialog').showModal();
  }
  private table(): ArcadeTable | undefined { return this.snapshot?.tables.find((t) => t.game === this.selected); }
  private command(command: ArcadeCommand, value?: number, beatId?: number): void {
    const table = this.table(); if (!this.connected || this.room !== 'arcade' || !table || this.pending) return;
    const actionId = crypto.randomUUID();
    if (!this.send({ type: 'arcade-action', game: this.selected, command, actionId, roundId: table.roundId, value: command === 'tap' ? table.round : value, beatId })) return;
    this.pending = actionId; el('arcade-error').textContent = '';
    this.timeout = setTimeout(() => { this.pending = undefined; el('arcade-error').textContent = '応答を確認できません。接続を確認して、もう一度お試しください。'; this.render(); }, 5000); this.render();
  }
  private rhythm(key: number): void {
    const t = this.table(); if (!t || t.phase !== 'playing' || !isRhythmGame(t.game) || !t.members.some((m) => m.id === this.id)) return;
    const max = t.game === 'star' ? 3 : t.game === 'echo' || t.game === 'sort' ? 2 : 1; if (key >= max) return;
    const hold = t.holds.find((h) => h.id === this.id);
    const beat = hold ? t.beats[hold.beatId] : nearestBeat(t.beats, Date.now() + this.offset);
    if (!beat) return;
    this.command(t.game === 'toast' ? hold ? 'toast-release' : 'toast-press' : 'beat', key, beat.id);
  }
  private cancelPending(): void { clearTimeout(this.timeout); this.pending = undefined; }
  private render(): void {
    if (this.room !== 'arcade') return;
    const table = this.table(), config = ARCADE_GAMES[this.selected];
    el('arcade-title').textContent = config.name; el('arcade-rules').textContent = config.description; el('arcade-tag').textContent = config.tag;
    el('arcade-status').textContent = !this.connected ? '再接続を待っています。再接続後は、あらためて参加してください。' : table?.message ?? 'ゲームの状態を確認中…';
    el('arcade-room-status').textContent = this.snapshot ? `${this.snapshot.tables.reduce((n, t) => n + t.members.filter((m) => !m.id.startsWith('cpu:')).length, 0)}人が参加中 · 筐体をクリックして参加・観戦` : 'ゲームの状態を確認中…';
    const own = this.snapshot?.tables.find((t) => t.members.some((m) => m.id === this.id));
    for (const button of el('arcade-tabs').querySelectorAll<HTMLButtonElement>('button')) {
      const game = button.dataset.arcadeGame as ArcadeGame, t = this.snapshot?.tables.find((t) => t.game === game);
      button.setAttribute('aria-pressed', String(game === this.selected));
      button.querySelector('small')!.textContent = `${t?.members.length ?? 0}/${arcadeCapacity(game)}人${t?.phase === 'playing' ? ' · プレイ中' : own?.game === game ? ' · 参加中' : ''}`;
    }
    const members = el('arcade-members'); members.replaceChildren();
    table?.members.forEach((member, i) => {
      const chip = document.createElement('span'); chip.className = `arcade-member player-${i}`;
      chip.textContent = `${member.name}${member.id === this.id ? '（あなた）' : ''}${this.selected !== 'four' ? ` · ${member.score}点${isRhythmGame(this.selected) ? ` / 最高${member.bestCombo ?? 0}連続` : ''}` : ` · ${i ? 'ミント' : 'ゴールド'}`}`; members.append(chip);
    });
    if (!table?.members.length) members.textContent = 'まだだれもいません。最初のひとりになろう。';
    const mine = !!table?.members.some((m) => m.id === this.id), ready = this.connected && !!table && !this.pending;
    const set = (id: string, disabled: boolean) => { el<HTMLButtonElement>(id).disabled = disabled; };
    set('arcade-join', !ready || !!own || table?.phase === 'playing' || (table?.members.length ?? 0) >= (arcadeCapacity(this.selected)));
    set('arcade-leave', !ready || !mine); set('arcade-start', !ready || !mine || table!.phase === 'playing');
    el('arcade-start').textContent = table?.phase === 'done' ? 'もう一回！' : 'スタート';
    el('arcade-participation').textContent = mine ? 'あなたは参加中。閉じても参加は続きます。退席・別の部屋への移動・切断で抜けます。待機は2分、終了後は1分で席が空きます。' : own ? `いまは「${ARCADE_GAMES[own.game].name}」に参加中。その台で退席すると、こちらに参加できます。` : '参加して遊ぶか、そのまま観戦できます。ひとりでもスタートできます！';
    el('arcade-drop-controls').hidden = this.selected !== 'four'; el('arcade-tap-controls').hidden = this.selected !== 'reflex'; el('arcade-fire-controls').hidden = this.selected !== 'meteor';
    el('arcade-reflex-button').textContent = table?.phase === 'playing' ? table.light === 'go' ? 'ピカッ！ 押す！' : table.light === 'result' ? '次のお題を待ってね' : 'まだだよ…' : '光ったら押そう';
    for (const button of el('arcade-drop-controls').querySelectorAll<HTMLButtonElement>('button')) button.disabled = !ready || !mine || table!.phase !== 'playing' || table!.members[table!.turn]?.id !== this.id || !!table!.board[Number(button.dataset.value)];
    set('arcade-reflex-button', !ready || !mine || table!.phase !== 'playing' || table!.light === 'result');
    for (const button of el('arcade-fire-controls').querySelectorAll<HTMLButtonElement>('button')) button.disabled = !ready || !mine || table!.phase !== 'playing';
    el('arcade-rhythm-controls').hidden = !isRhythmGame(this.selected);
    el('arcade-sound').hidden = !isRhythmGame(this.selected);
    el('arcade-feedback').hidden = !isRhythmGame(this.selected);
    el('arcade-feedback').textContent = table?.members.find((m) => m.id === this.id)?.verdict ?? 'ひとつずつ、リズムに合わせてどうぞ。';
    const keyCount = this.selected === 'star' ? 3 : this.selected === 'echo' || this.selected === 'sort' ? 2 : 1;
    for (const button of el('arcade-rhythm-controls').querySelectorAll<HTMLButtonElement>('[data-rhythm-key]')) {
      const key = Number(button.dataset.rhythmKey); button.hidden = key >= keyCount; button.disabled = !ready || !mine || table!.phase !== 'playing';
      button.textContent = this.selected === 'toast' ? table?.holds.some((h) => h.id === this.id) ? '取り出す！ / SPACE' : '焼く！ / SPACE' : keyCount === 1 ? 'パン！ / SPACE' : this.selected === 'star' ? `${key + 1}番をキャッチ` : key === 0 ? '← 左 / 1' : '右 / 2 →';
    }
    const radar = el('arcade-radar'); radar.hidden = this.selected !== 'meteor';
    radar.textContent = table ? `街のHP ${table.health}/8 · 迎撃 ${table.saved}個 ｜ ${[0, 1, 2].map((lane) => `${lane + 1}番:${table.meteors.filter((m) => m.lane === lane).length}個`).join(' / ')}` : '空を確認中…';
    const board = el('arcade-board-text'); board.hidden = this.selected !== 'four';
    board.textContent = table ? Array.from({ length: 6 }, (_, y) => table.board.slice(y * 7, y * 7 + 7).map((v) => v === 1 ? '金' : v === 2 ? '緑' : '空').join(' ')).join(' / ') : '';
    el('arcade-canvas').dataset.phase = table?.phase ?? 'loading'; el('arcade-canvas').dataset.game = this.selected;
    this.clock(); this.paint();
  }
  private clock(): void {
    const t = this.table();
    const cue = el('arcade-rhythm-cue'); cue.hidden = !isRhythmGame(this.selected);
    if (t && isRhythmGame(t.game)) cue.textContent = rhythmCue(t, Date.now() + this.offset, this.id);
    el('arcade-clock').textContent = t?.phase === 'playing' ? `残り ${Math.max(0, Math.ceil((t.endsAt - Date.now() - this.offset) / 1000))} 秒${this.selected === 'reflex' ? ` · ${t.round}/5本目` : ''}` : t?.phase === 'done' ? 'THANKS FOR PLAYING!' : 'READY WHEN YOU ARE';
  }
  private paint(): void {
    const canvas = el<HTMLCanvasElement>('arcade-canvas'), ctx = canvas.getContext('2d')!, t = this.table();
    const now = Date.now() + this.offset, motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ctx.fillStyle = '#222e47'; ctx.fillRect(0, 0, 336, 200);
    for (let i = 0; i < 36; i++) { ctx.fillStyle = ['#4b5878', '#73849c'][i % 2]; ctx.fillRect((i * 67 + 9) % 332, (i * 37 + 4) % 190, 2, 2); }
    if (t && isRhythmGame(this.selected)) { paintRhythm(ctx, t, now, this.id); return; }
    if (this.selected === 'four') {
      ctx.fillStyle = '#596387'; ctx.fillRect(60, 8, 216, 184);
      for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
        const v = t?.board[y * 7 + x] ?? 0, px = 66 + x * 30, py = 13 + y * 29;
        ctx.fillStyle = v ? v === 1 ? '#efbf76' : '#94cebd' : '#2c3d59'; ctx.fillRect(px, py, 24, 23);
        if (v) { ctx.fillStyle = v === 1 ? '#ffe7b9' : '#d5f4db'; ctx.fillRect(px + 10, py + 3, 4, 17); ctx.fillRect(px + 4, py + 9, 16, 4); }
      }
    } else if (this.selected === 'reflex') {
      const go = t?.phase === 'playing' && t.light === 'go';
      ctx.fillStyle = go ? '#94cebd' : '#6c5c84'; ctx.fillRect(119, 23, 98, 98); ctx.fillStyle = go ? '#e7f7b3' : '#aa8baf'; ctx.fillRect(132, 36, 72, 72);
      ctx.fillStyle = '#222e47'; ctx.fillRect(148, 56, 7, 8); ctx.fillRect(181, 56, 7, 8); ctx.fillRect(154, 83, 28, 5);
      ctx.fillStyle = '#f4e7c7'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText(go ? 'GO! GO! GO!' : t?.light === 'result' ? 'NICE TRY!' : 'WAIT FOR IT...', 168, 158);
      if (go) for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.fillStyle = '#efbf76'; ctx.fillRect(165 + Math.cos(a) * 74, 68 + Math.sin(a) * 62, 5, 5); }
    } else {
      for (let lane = 0; lane < 3; lane++) {
        ctx.fillStyle = '#35455e'; ctx.fillRect(lane * 112 + 4, 4, 1, 190);
        ctx.fillStyle = '#607e93'; for (let b = 0; b < 4; b++) ctx.fillRect(lane * 112 + b * 24 + 10, 169 - b % 2 * 9, 18, 31);
        ctx.fillStyle = '#efbf76'; for (let b = 0; b < 12; b++) ctx.fillRect(lane * 112 + b % 4 * 24 + 15, 177 + Math.floor(b / 4) * 8, 3, 3);
        ctx.fillStyle = '#94cebd'; ctx.fillRect(lane * 112 + 40, 154, 32, 5); ctx.fillRect(lane * 112 + 53, 145, 6, 10);
        ctx.fillStyle = '#d6e8da'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(String(lane + 1), lane * 112 + 56, 140);
      }
      for (const m of t?.meteors ?? []) {
        const y = 16 + Math.min(1, Math.max(0, ((motion ? now : m.bornAt + 1500) - m.bornAt) / (m.impactAt - m.bornAt))) * 138, x = m.lane * 112 + 50;
        ctx.fillStyle = '#d47879'; ctx.fillRect(x + 4, y - 10, 5, 12); ctx.fillStyle = '#efbf76'; ctx.fillRect(x, y, 14, 10); ctx.fillStyle = '#a77372'; ctx.fillRect(x + 4, y + 4, 6, 5);
      }
      ctx.fillStyle = '#edb4be'; ctx.font = '11px monospace'; ctx.textAlign = 'left'; ctx.fillText(`HP ${t?.health ?? 8}/8   SAVED ${t?.saved ?? 0}`, 12, 15);
    }
  }
  destroy(): void { this.cancelPending(); clearInterval(this.refresh); this.sound.destroy(); }
}
