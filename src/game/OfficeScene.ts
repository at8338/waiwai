import Phaser from 'phaser';
import { createAvatarTextures, drawOffice } from './art.ts';
import { Controls } from './controls.ts';
import { Walker, areaAt, COLS, ROWS, TILE } from './world.ts';
import type { Direction } from './world.ts';
import { OfficeConnection } from '../network/OfficeConnection.ts';
import type { ConnectionState } from '../network/OfficeConnection.ts';
import type { Player } from '../network/protocol.ts';
import { ProximityVoice } from '../audio/ProximityVoice.ts';
import type { VoiceUI } from '../audio/ProximityVoice.ts';
import { activateSlackDM, slackDMUrl } from '../slack/dm.ts';
import type { SlackIdentity } from '../slack/dm.ts';

type AvatarView = {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
};
type Peer = { player: Player; walker: Walker; view: AvatarView };

export class OfficeScene extends Phaser.Scene {
  readonly walker = new Walker();
  private controls = new Controls();
  private avatar!: AvatarView;
  private outfit = 0;
  private playerName = 'あなた';
  private lastArea = '';
  private inputController = new AbortController();
  private connection?: OfficeConnection;
  private localId?: string;
  private connected = false;
  private peers = new Map<string, Peer>();
  private players = new Map<string, Player>();
  private voice?: ProximityVoice;
  private speaking = new Set<string>();
  private slack: SlackIdentity | null;
  private selectedPlayer?: string;

  constructor(slack: SlackIdentity | null = null) { super('office'); this.slack = slack; }

  private makeAvatar(local: boolean): AvatarView {
    const shadow = this.add.graphics();
    shadow.fillStyle(0x6e684b, 0.3).fillRect(-6, -1, 12, 3);
    const sprite = this.add.image(0, 0, 'avatar-0-down-0').setOrigin(0.5, 1);
    const label = this.add.text(0, 0, '', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#fff9e6',
      backgroundColor: local ? '#355b49' : '#786346', padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setResolution(2);
    return { sprite, shadow, label };
  }

  create(): void {
    drawOffice(this);
    createAvatarTextures(this);
    this.avatar = this.makeAvatar(true);
    this.controls.attach(this.game.canvas);
    document.querySelector('#participants')?.addEventListener('click', (event) => {
      const target = (event.target as Element).closest<HTMLButtonElement>('[data-dm-player]');
      if (target) this.openSlackDM(target.dataset.dmPlayer!);
    }, { signal: this.inputController.signal });
    this.voice = new ProximityVoice({
      sendState: (state) => this.connection?.setVoice(state),
      sendSignal: (to, session, payload) => this.connection?.signalVoice(to, session, payload),
      notify: (state) => this.renderVoice(state),
    });
    document.querySelector('#voice-toggle')?.addEventListener('click', () => {
      if (document.querySelector('#voice-toggle')?.getAttribute('aria-pressed') === 'true') this.voice?.stop();
      else void this.voice?.start();
    }, { signal: this.inputController.signal });
    document.querySelector('#mic-toggle')?.addEventListener('click', () => { void this.voice?.toggleMicrophone(); }, { signal: this.inputController.signal });
    document.querySelector('#reset-position')?.addEventListener('click', () => {
      this.controls.clear();
      this.connection?.reset();
      this.game.canvas.focus({ preventScroll: true });
    }, { signal: this.inputController.signal });
    document.addEventListener('walk-step', ((event: CustomEvent<Direction>) => {
      if (!this.walker.moving) this.connection?.move(event.detail);
    }) as EventListener, { signal: this.inputController.signal });

    this.connection = new OfficeConnection({
      state: (state) => this.setConnectionState(state),
      welcome: (id, players) => {
        this.clearPeers();
        this.players.clear();
        this.localId = id;
        for (const player of players) this.receivePlayer(player, true);
      },
      player: (player, snap) => this.receivePlayer(player, snap),
      left: (id) => this.removePlayer(id),
      voice: (snapshot) => this.voice?.accept(snapshot),
      voiceSignal: (signal) => this.voice?.signal(signal),
    });
    this.sendProfile();
    const cleanup = () => {
      this.controls.destroy();
      this.inputController.abort();
      this.voice?.destroy();
      this.connection?.destroy();
    };
    this.events.once('shutdown', cleanup);
    this.events.once('destroy', cleanup);
    this.game.canvas.focus({ preventScroll: true });
    this.game.canvas.parentElement?.querySelector('.loading')?.remove();
    this.update(0, 0);
  }

  private setConnectionState(state: ConnectionState): void {
    this.connected = state === 'online';
    this.voice?.setConnected(this.connected);
    if (!this.connected) {
      this.controls.clear();
      this.clearPeers();
      this.players.clear();
      this.localId = undefined;
      if (this.selectedPlayer) this.renderSlackTarget();
    }
    const messages = {
      connecting: 'オフィスに接続しています…',
      online: '同じURLを開いて、いっしょに歩こう。',
      reconnecting: '接続が切れました。もう一度つないでいます…',
    };
    document.querySelector('#connection-message')!.textContent = messages[state];
    document.querySelector('#connection-label')!.textContent = this.connected ? 'みんなと接続中' : state === 'connecting' ? '接続しています' : '再接続しています';
    document.querySelector('#app')!.setAttribute('data-connection', state);
    document.querySelector('#profile-presence')!.textContent = this.connected ? 'オフィスにいます' : '接続を待っています';
    (document.querySelector('#reset-position') as HTMLButtonElement).disabled = !this.connected;
    this.renderParticipants();
  }

  private renderVoice(state: VoiceUI): void {
    this.speaking = state.speakers;
    const join = document.querySelector<HTMLButtonElement>('#voice-toggle')!;
    const mic = document.querySelector<HTMLButtonElement>('#mic-toggle')!;
    join.textContent = state.active ? '音声を終了' : state.busy ? '準備しています…' : '音声に参加';
    join.setAttribute('aria-pressed', String(state.active));
    join.disabled = !this.connected || (state.busy && !state.active);
    mic.textContent = state.microphone ? 'マイクをOFF' : 'マイクをON';
    mic.setAttribute('aria-pressed', String(state.microphone));
    mic.disabled = !state.active || state.busy;
    const status = document.querySelector('#voice-status')!;
    if (status.textContent !== state.message) status.textContent = state.message;
    document.querySelector('#voice-nearby')!.textContent = state.active ? `近くに${state.nearby}人 · ${state.connected}人と接続中` : '初期状態はマイクOFFです。';
    document.querySelector('#voice-controls')!.setAttribute('data-microphone', String(state.microphone));
    for (const item of document.querySelectorAll<HTMLElement>('[data-player-id]')) {
      item.dataset.speaking = String(this.speaking.has(item.dataset.playerId!));
    }
  }

  private clearPeers(): void {
    for (const { view } of this.peers.values()) this.destroyView(view);
    this.peers.clear();
  }

  private destroyView(view: AvatarView): void {
    view.sprite.destroy(); view.shadow.destroy(); view.label.destroy();
  }

  private receivePlayer(player: Player, snap: boolean): void {
    this.players.set(player.id, player);
    if (player.id === this.localId) {
      if (player.slackVerified) {
        this.playerName = player.name;
        this.slack = player.slack ?? null;
        document.querySelector('#profile-name')!.textContent = player.name;
      }
      this.walker.receive(player, player.facing, snap);
    } else {
      let peer = this.peers.get(player.id);
      if (!peer) {
        peer = { player, walker: new Walker(), view: this.makeAvatar(false) };
        peer.view.sprite.setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.openSlackDM(player.id));
        peer.view.label.setInteractive({ useHandCursor: true })
          .on('pointerup', () => this.openSlackDM(player.id));
        this.peers.set(player.id, peer);
        snap = true;
      }
      peer.player = player;
      peer.walker.receive(player, player.facing, snap);
    }
    this.renderParticipants();
    this.voice?.setWorld(this.localId, this.players);
    if (this.selectedPlayer === player.id) this.renderSlackTarget();
  }

  private removePlayer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) this.destroyView(peer.view);
    this.peers.delete(id);
    this.players.delete(id);
    this.voice?.setWorld(this.localId, this.players);
    this.renderParticipants();
    if (this.selectedPlayer === id) this.renderSlackTarget();
  }

  private renderParticipants(): void {
    const list = document.querySelector('#participants')!;
    // Preserve keyboard focus while positions, names, or Slack settings change.
    const existing = new Map([...list.children].map((element) => [(element as HTMLElement).dataset.playerId, element as HTMLElement]));
    for (const [id, item] of existing) if (!id || !this.players.has(id)) item.remove();
    for (const player of this.players.values()) {
      let item = existing.get(player.id);
      if (!item) {
        item = document.createElement('li');
        const name = document.createElement(player.id === this.localId ? 'strong' : 'button');
        name.className = 'participant-name';
        if (name instanceof HTMLButtonElement) {
          name.type = 'button';
          name.dataset.dmPlayer = player.id;
        }
        const location = document.createElement('span');
        const slackStatus = document.createElement('span');
        slackStatus.className = 'participant-slack';
        item.append(name, location, slackStatus);
        list.append(item);
      }
      item.dataset.playerId = player.id;
      item.dataset.tileX = String(player.x);
      item.dataset.tileY = String(player.y);
      item.dataset.outfit = String(player.outfit);
      item.dataset.speaking = String(this.speaking.has(player.id));
      const name = item.children[0];
      name.textContent = player.name + (player.id === this.localId ? '（あなた）' : '');
      if (player.id !== this.localId) name.setAttribute('aria-label', `${player.name}さんのSlack DMを開く`);
      item.children[1].textContent = areaAt(player);
      item.children[2].textContent = player.slackVerified ? 'Slackログイン済み' : player.slack ? 'Slack手動設定' : 'Slack未設定';
    }
    document.querySelectorAll('[data-player-count]').forEach((element) => {
      const text = this.connected ? `${this.players.size}人が滞在中` : '接続を待っています';
      if (element.textContent !== text) element.textContent = text;
    });
  }

  setName(name: string): void {
    this.playerName = name.trim() || 'あなた';
    this.sendProfile();
  }

  setOutfit(color: number): void {
    this.outfit = color;
    this.sendProfile();
  }

  setSlack(slack: SlackIdentity | null): void { this.slack = slack; this.sendProfile(); }

  private sendProfile(): void {
    this.connection?.setProfile({ name: this.playerName, outfit: this.outfit, slack: this.slack });
  }

  private openSlackDM(id: string): void {
    this.controls.clear();
    this.selectedPlayer = id;
    this.renderSlackTarget();
    document.querySelector('#slack-target')?.scrollIntoView({ block: 'nearest' });
    const player = this.players.get(id);
    if (!this.connected || !player || id === this.localId) return;
    if (!activateSlackDM(player.slack, (url) => window.location.assign(url)) && slackDMUrl(player.slack)) {
      document.querySelector('#slack-target-message')!.textContent = 'Slackアプリを開けませんでした。インストール状態を確認し、下のリンクからもう一度お試しください。';
    }
  }

  private renderSlackTarget(): void {
    const card = document.querySelector<HTMLElement>('#slack-target')!;
    card.hidden = false;
    const player = this.selectedPlayer ? this.players.get(this.selectedPlayer) : undefined;
    const link = document.querySelector<HTMLAnchorElement>('#slack-dm-link')!;
    const url = player && this.connected ? slackDMUrl(player.slack) : undefined;
    document.querySelector('#slack-target-name')!.textContent = player ? `${player.name}さんのSlack DM` : '相手はオフィスにいません';
    const message = !this.connected ? 'オフィスへの接続が切れています。再接続後に相手を選び直してください。'
      : !player ? '相手が退出しました。Slackのリンクを解除しました。'
      : url ? 'SlackアプリでDMを開きます。開かなかった場合は、下のリンクからもう一度開けます。'
      : '相手のSlackが未設定です。相手にワークスペースIDとメンバーIDの設定をお願いしてください。';
    document.querySelector('#slack-target-message')!.textContent = message;
    document.querySelector('#slack-target-ids')!.textContent = url && player?.slack ? `${player.slack.teamId} / ${player.slack.userId}` : '';
    if (url) { link.href = url; link.hidden = false; }
    else { link.removeAttribute('href'); link.hidden = true; }
  }

  private drawAvatar(view: AvatarView, walker: Walker, outfit: number, name: string, time: number): void {
    const { x, y } = walker.position();
    const frame = walker.moving ? 1 + Math.floor(time / 95) % 2 : 0;
    view.sprite.setPosition(Math.round(x), Math.round(y) + 6)
      .setTexture(`avatar-${outfit}-${walker.facing}-${frame}`).setDepth(y + 7);
    view.shadow.setPosition(Math.round(x), Math.round(y) + 5).setDepth(y + 6);
    view.label.setText(name).setPosition(Math.round(x), Math.round(y) - 20).setDepth(ROWS * TILE + 20);
  }

  update(time: number, delta: number): void {
    this.walker.update(delta);
    if (!this.walker.moving && this.connection?.readyToMove) {
      const direction = this.controls.direction();
      if (direction) this.connection.move(direction);
    }
    this.drawAvatar(this.avatar, this.walker, this.outfit, this.playerName, time);
    this.avatar.sprite.setAlpha(this.connected ? 1 : 0.45);
    for (const peer of this.peers.values()) {
      peer.walker.update(delta);
      this.drawAvatar(peer.view, peer.walker, peer.player.outfit, peer.player.name + (this.speaking.has(peer.player.id) ? ' ♪' : ''), time);
    }
    const area = areaAt(this.walker.tile);
    if (area !== this.lastArea) {
      this.lastArea = area;
      document.querySelectorAll('[data-current-area]').forEach((element) => { element.textContent = area; });
    }
    this.game.canvas.dataset.tileX = String(this.walker.tile.x);
    this.game.canvas.dataset.tileY = String(this.walker.tile.y);
    this.game.canvas.dataset.connectedPlayers = String(this.players.size);
  }
}

export function startOffice(parent: HTMLElement, slack: SlackIdentity | null = null): { game: Phaser.Game; scene: OfficeScene } {
  const scene = new OfficeScene(slack);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: COLS * TILE, height: ROWS * TILE,
    backgroundColor: '#ead3a5', pixelArt: true, roundPixels: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], input: { keyboard: false }, audio: { noAudio: true },
  });
  return { game, scene };
}
