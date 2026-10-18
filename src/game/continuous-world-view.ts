import Phaser from 'phaser';
import { ROOMS } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { COLS, ROWS, TILE } from './world.ts';
import type { Point } from './world.ts';
import { WORLD_COLUMNS, WORLD_ROWS, roomOrigin } from './continuous-world.ts';
import { configureArtCamera } from './art-resolution.ts';
import { CompanionsView } from './companions-view.ts';
import { DailyEventsView } from './daily-events-view.ts';
import { RoomLighting } from './RoomLighting.ts';
import type { DailyEventSnapshot } from './daily-events.ts';
import type { BuddyKind, RoomPet } from './buddies.ts';
import type { RoomObject } from './objects.ts';
import type { Player } from '../network/protocol.ts';
import { VehicleDocksView } from './transport-view.ts';
import type { VehicleUnit } from './transport.ts';
import { lostItemPixels } from './lost-items.ts';
import type { LostItem, LostItemsSnapshot } from './lost-items.ts';
type AreaViews = { companions: CompanionsView; lighting: RoomLighting; incident: DailyEventsView; vehicles: VehicleDocksView; nodes: Set<Phaser.GameObjects.GameObject>; hidden: Map<Phaser.GameObjects.GameObject, boolean> };

// Every area is drawn simultaneously at a fixed world origin. The camera follows
// the interpolated avatar, including while it crosses a shared boundary.
export class ContinuousWorldView {
  private roots = new Map<RoomId, Phaser.GameObjects.Container>();
  private maps = new Map<RoomId, Phaser.GameObjects.GameObject[]>();
  private fixed = new Set<Phaser.GameObjects.GameObject>();
  private pinned = new Set<Phaser.GameObjects.GameObject>();
  private companionAreas = new Map<string, RoomId>();
  private areas = new Map<RoomId, AreaViews>();
  private lostViews: Phaser.GameObjects.Graphics[] = [];
  private lostUntil = 0;
  constructor(private scene: Phaser.Scene, private room: RoomId, draw: (id: RoomId) => Phaser.GameObjects.GameObject[], inspect: () => void, pet: (kind: BuddyKind, owner: string, room: RoomId) => void, vehicle: (id?: string) => void, private inspectLost: (item: LostItem) => void) {
    for (const area of ROOMS) {
      const origin = roomOrigin(area.id);
      const root = scene.add.container(origin.x * TILE, origin.y * TILE).setDepth(origin.y * 100);
      this.roots.set(area.id, root);
      const views = draw(area.id);
      const label = scene.add.text((COLS - 1) * TILE - 4, (ROWS - 1) * TILE - 3, `${area.name} · 1F`, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#fff5da', backgroundColor: '#344d59', padding: { x: 4, y: 2 },
      }).setOrigin(1, 1).setResolution(2).setDepth(350);
      views.push(label); views.forEach(view => this.fixed.add(view)); root.add(views); this.maps.set(area.id, views);
    }
    this.adopt();
    for (const area of ROOMS) {
      const nodes = new Set<Phaser.GameObjects.GameObject>();
      const views = this.inArea(area.id, nodes, () => {
        const lighting = new RoomLighting(scene); lighting.setRoom(area.id);
        const incident = new DailyEventsView(scene, inspect); incident.setRoom(area.id); incident.setObjects([]); incident.setDecorations(this.map(area.id));
        const origin = roomOrigin(area.id); incident.setWorldOffset(origin.x * TILE, origin.y * TILE);
        const companions = new CompanionsView(scene, (kind, owner) => pet(kind, owner, area.id)); companions.setRoom(area.id, false);
        const vehicles = new VehicleDocksView(scene, vehicle, false); vehicles.setRoom(area.id); vehicles.setConnected(true);
        return { lighting, incident, companions, vehicles, nodes, hidden: new Map<Phaser.GameObjects.GameObject, boolean>() };
      });
      this.areas.set(area.id, views);
    }
    scene.cameras.main.setBounds(0, 0, WORLD_COLUMNS * COLS * TILE, WORLD_ROWS * ROWS * TILE);
  }
  private inArea<T>(id: RoomId, nodes: Set<Phaser.GameObjects.GameObject>, action: () => T): T {
    const before = new Set(this.scene.children.list), result = action();
    const added = this.scene.children.list.filter(view => !before.has(view));
    for (const view of added) { nodes.add(view); view.once('destroy', () => nodes.delete(view)); }
    this.bind(id, added); return result;
  }
  objects(id: RoomId, objects: RoomObject[], decorations: Phaser.GameObjects.GameObject[]): void {
    const area = this.areas.get(id)!; area.lighting.setObjects(objects); area.incident.setObjects(objects); area.incident.setDecorations([...this.map(id), ...decorations]);
  }
  event(state: DailyEventSnapshot): void { for (const area of this.areas.values()) area.incident.receive(state); }
  player(player: Player, snap: boolean): void {
    const previous = this.companionAreas.get(player.id);
    if (previous && previous !== player.roomId) this.areas.get(previous)!.companions.remove(player.id);
    const area = this.areas.get(player.roomId)!;
    this.inArea(player.roomId, area.nodes, () => area.companions.player(player, snap));
    this.companionAreas.set(player.id, player.roomId);
  }
  removePlayer(id: string): void { const room = this.companionAreas.get(id); if (room) this.areas.get(room)!.companions.remove(id); this.companionAreas.delete(id); }
  clearCompanions(): void { for (const area of this.areas.values()) area.companions.clear(); this.companionAreas.clear(); }
  pets(id: RoomId, pets: RoomPet[]): void { const area = this.areas.get(id)!; this.inArea(id, area.nodes, () => area.companions.pets(id, pets, false)); }
  vehicles(units: VehicleUnit[]): void { for (const [id, area] of this.areas) this.inArea(id, area.nodes, () => area.vehicles.receive(units)); }
  lost(snapshot: LostItemsSnapshot): void {
    this.lostViews.forEach(view => view.destroy()); this.lostViews = [];
    this.lostUntil = Date.now() + snapshot.expiresAt - snapshot.serverNow;
    for (const item of snapshot.items) {
      const area = this.areas.get(item.roomId)!;
      this.inArea(item.roomId, area.nodes, () => {
        const g = this.scene.add.graphics().setPosition((item.x + .5) * TILE, (item.y + .5) * TILE).setDepth(-20);
        g.fillStyle(0x5c604f, .15).fillRect(-5, 4, 11, 3);
        for (const p of lostItemPixels(item.kind)) g.fillStyle(p.color).fillRect(p.x - 8, p.y - 8, p.w, p.h);
        g.setInteractive(new Phaser.Geom.Rectangle(-8, -8, TILE, TILE), Phaser.Geom.Rectangle.Contains).on('pointerup', () => this.inspectLost(item)); this.lostViews.push(g);
      });
    }
  }
  map(room: RoomId): Phaser.GameObjects.GameObject[] { return this.maps.get(room)!; }
  setRoom(room: RoomId): void {
    const old = this.roots.get(this.room)!;
    this.roots.get(room)!.add(old.list.filter(view => !this.fixed.has(view) && !this.pinned.has(view)));
    this.room = room;
    this.areas.get(room)?.incident.suspend();
  }
  bind(room: RoomId, views: Phaser.GameObjects.GameObject[], pinned = true): void {
    if (pinned) views.forEach(view => { if (!this.pinned.has(view)) { this.pinned.add(view); view.once('destroy', () => this.pinned.delete(view)); } });
    this.roots.get(room)!.add(views);
  }
  private adopt(): void {
    const roots = new Set(this.roots.values());
    this.roots.get(this.room)!.add(this.scene.children.list.filter(view => !roots.has(view as Phaser.GameObjects.Container)));
  }
  update(point: Point, allowed: (room: RoomId) => boolean, time: number, delta: number, reducedMotion: boolean): void {
    this.adopt();
    if (this.lostUntil && Date.now() >= this.lostUntil) { this.lostViews.forEach(view => view.destroy()); this.lostViews = []; this.lostUntil = 0; }
    for (const [id, area] of this.areas) {
      if (id === this.room) {
        for (const node of area.nodes) if ('visible' in node) { if (!area.hidden.has(node)) { area.hidden.set(node, !!node.visible); node.once('destroy', () => area.hidden.delete(node)); } (node as Phaser.GameObjects.Image).setVisible(false); }
      } else {
        for (const [node, visible] of area.hidden) if (node.scene) (node as Phaser.GameObjects.Image).setVisible(visible);
        area.hidden.clear();
        area.lighting.update(Date.now(), undefined, false); area.incident.update(Date.now(), reducedMotion, false);
        area.companions.update(time, delta, reducedMotion);
      }
    }
    const origin = roomOrigin(this.room), camera = this.scene.cameras.main;
    camera.centerOn(origin.x * TILE + point.x, origin.y * TILE + point.y);
    for (const [id, root] of this.roots) {
      // Cull whole areas outside the viewport; do not render the entire building on every frame.
      root.setVisible(allowed(id) && root.x < camera.worldView.right + 64 && root.x + COLS * TILE > camera.worldView.left - 64
        && root.y < camera.worldView.bottom + 64 && root.y + ROWS * TILE > camera.worldView.top - 64);
      root.sort('depth');
    }
  }
  destroy(): void {
    this.lostViews.forEach(view => view.destroy()); this.lostViews = [];
    for (const area of this.areas.values()) { area.companions.clear(); area.lighting.destroy(); area.incident.destroy(); area.vehicles.destroy(); }
    this.areas.clear();
    const keep = this.roots.get(this.room)!.list.filter(view => !this.pinned.has(view) && (!this.fixed.has(view) || this.map(this.room).includes(view)));
    for (const view of keep) { view.parentContainer?.remove(view); this.scene.add.existing(view); }
    for (const root of this.roots.values()) root.destroy();
    this.roots.clear(); this.maps.clear(); this.fixed.clear(); this.pinned.clear();
    this.scene.cameras.main.removeBounds(); configureArtCamera(this.scene);
  }
}
