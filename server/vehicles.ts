import { VEHICLES, VEHICLE_KINDS, nearVehicleDock, touchingVehicleDock, nearGroundVehicle } from '../src/game/transport.ts';
import type { VehicleKind, VehicleUnit } from '../src/game/transport.ts';
import type { Player } from '../src/network/protocol.ts';
import { canWalk } from '../src/game/world.ts';

// One authoritative unit per id: docked, ridden, or on a floor. Mutations are
// synchronous, so simultaneous borrowers cannot duplicate a dropped vehicle.
export class VehicleFleet {
  private contacts = new Map<string, string>();
  private units: VehicleUnit[] = VEHICLE_KINDS.flatMap((kind) => Array.from({ length: VEHICLES[kind].count }, (_, i) => ({ id: `${kind}-${i + 1}`, kind, riderId: null })));
  list(): VehicleUnit[] { return this.units.map((unit) => ({ ...unit, ...(unit.ground ? { ground: { ...unit.ground } } : {}) })); }
  private claim(player: Player, unit: VehicleUnit): void {
    unit.riderId = player.id; delete unit.ground;
    player.riding = { id: unit.id, kind: unit.kind };
  }
  take(player: Player, kind: VehicleKind): string | undefined {
    if (player.riding) return 'いま乗っているものを降りてから借りてください。';
    if (!nearVehicleDock(player, kind)) return `${VEHICLES[kind].name}の置き場のすぐ横まで歩いてください。`;
    const unit = this.units.find((u) => u.kind === kind && u.riderId === null && !u.ground);
    if (!unit) return '置き場には空きがありません。部屋の床に置かれたものも使えます。';
    this.claim(player, unit);
  }
  pickup(player: Player, unitId: string): string | undefined {
    if (player.riding) return 'いま乗っているものを降りてから乗ってください。';
    const unit = this.units.find((u) => u.id === unitId);
    if (!unit || unit.riderId || !unit.ground) return 'この乗りものは、すでにほかの人が使っています。';
    if (!nearGroundVehicle(player, unit)) return '同じ部屋の乗りもののすぐ横まで歩いてください。';
    this.claim(player, unit);
  }
  drop(player: Player): string | undefined {
    const unit = this.units.find((u) => u.riderId === player.id && u.id === player.riding?.id);
    if (!unit) return 'いま借りている乗りものはありません。';
    if (touchingVehicleDock(player)) { this.contacts.set(player.id, `dock:${touchingVehicleDock(player)}`); this.release(player); return; }
    if (!canWalk(player.x, player.y, player.roomId)) return '床の空いている場所で降りてください。';
    if (this.units.some((u) => u.ground?.roomId === player.roomId && u.ground.x === player.x && u.ground.y === player.y)) return 'ここには別の乗りものがあります。一歩移動してから降りてください。';
    unit.riderId = null; unit.ground = { roomId: player.roomId, x: player.x, y: player.y }; delete player.riding;
    // Dropping never immediately remounts the same unit. Leave the tile first.
    this.contacts.set(player.id, `floor:${unit.id}`);
  }
  return(player: Player): string | undefined {
    if (!player.riding) return 'いま借りている乗りものはありません。';
    if (!VEHICLE_KINDS.some((kind) => nearVehicleDock(player, kind))) return 'ひだまりオフィスの置き場に戻って返却してください。';
    this.release(player);
  }
  // One action per contact, preserving the existing pad-entry behavior.
  touch(player: Player): boolean {
    const kind = touchingVehicleDock(player);
    const unit = this.units.find((u) => u.ground?.roomId === player.roomId && u.ground.x === player.x && u.ground.y === player.y);
    const contact = kind ? `dock:${kind}` : unit ? `floor:${unit.id}` : undefined;
    const previous = this.contacts.get(player.id);
    if (!contact) { this.contacts.delete(player.id); return false; }
    this.contacts.set(player.id, contact);
    if (contact === previous) return false;
    if (kind) {
      if (player.riding) { this.release(player); return true; }
      return !this.take(player, kind);
    }
    return !!unit && !player.riding && !this.pickup(player, unit.id);
  }
  forget(player: Player): void { this.contacts.delete(player.id); this.release(player); }
  release(player: Player): void {
    for (const unit of this.units) if (unit.riderId === player.id) { unit.riderId = null; delete unit.ground; }
    delete player.riding;
  }
}
