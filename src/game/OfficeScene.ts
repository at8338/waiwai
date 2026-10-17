import Phaser from 'phaser';
import { createAvatarTextures, drawOffice } from './art.ts';
import { Controls } from './controls.ts';
import { Walker, areaAt, COLS, ROWS, TILE } from './world.ts';
import type { Direction } from './world.ts';
import { OfficeConnection } from '../network/OfficeConnection.ts';
import type { ConnectionState } from '../network/OfficeConnection.ts';
import type { Player } from '../network/protocol.ts';

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

  constructor() { super('office'); }

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
    });
    this.connection.setProfile({ name: this.playerName, outfit: this.outfit });
    const cleanup = () => {
      this.controls.destroy();
      this.inputController.abort();
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
    if (!this.connected) {
      this.controls.clear();
      this.clearPeers();
      this.players.clear();
      this.localId = undefined;
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
      this.walker.receive(player, player.facing, snap);
    } else {
      let peer = this.peers.get(player.id);
      if (!peer) {
        peer = { player, walker: new Walker(), view: this.makeAvatar(false) };
        this.peers.set(player.id, peer);
        snap = true;
      }
      peer.player = player;
      peer.walker.receive(player, player.facing, snap);
    }
    this.renderParticipants();
  }

  private removePlayer(id: string): void {
    const peer = this.peers.get(id);
    if (peer) this.destroyView(peer.view);
    this.peers.delete(id);
    this.players.delete(id);
    this.renderParticipants();
  }

  private renderParticipants(): void {
    const list = document.querySelector('#participants')!;
    list.replaceChildren();
    for (const player of this.players.values()) {
      const item = document.createElement('li');
      item.dataset.playerId = player.id;
      item.dataset.tileX = String(player.x);
      item.dataset.tileY = String(player.y);
      item.dataset.outfit = String(player.outfit);
      const name = document.createElement('strong');
      name.textContent = player.name + (player.id === this.localId ? '（あなた）' : '');
      const location = document.createElement('span');
      location.textContent = areaAt(player);
      item.append(name, location);
      list.append(item);
    }
    document.querySelectorAll('[data-player-count]').forEach((element) => {
      const text = this.connected ? `${this.players.size}人が滞在中` : '接続を待っています';
      if (element.textContent !== text) element.textContent = text;
    });
  }

  setName(name: string): void {
    this.playerName = name.trim() || 'あなた';
    this.connection?.setProfile({ name: this.playerName, outfit: this.outfit });
  }

  setOutfit(color: number): void {
    this.outfit = color;
    this.connection?.setProfile({ name: this.playerName, outfit: this.outfit });
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
      this.drawAvatar(peer.view, peer.walker, peer.player.outfit, peer.player.name, time);
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

export function startOffice(parent: HTMLElement): { game: Phaser.Game; scene: OfficeScene } {
  const scene = new OfficeScene();
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, width: COLS * TILE, height: ROWS * TILE,
    backgroundColor: '#ead3a5', pixelArt: true, roundPixels: true,
    render: { antialias: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene], input: { keyboard: false }, audio: { noAudio: true },
  });
  return { game, scene };
}
