import { VEHICLES, VEHICLE_KINDS, nearVehicleDock, touchingVehicleDock } from '../src/game/transport.ts';
import type { VehicleKind, VehicleUnit } from '../src/game/transport.ts';
import type { Player } from '../src/network/protocol.ts';

// Synchronous mutations keep competing requests atomic on the office server.
export class VehicleFleet {
  private contacts = new Map<string, VehicleKind>();
  private units: VehicleUnit[] = VEHICLE_KINDS.flatMap((kind) => Array.from({ length: VEHICLES[kind].count }, (_, i) => ({ id: `${kind}-${i + 1}`, kind, riderId: null })));
  list(): VehicleUnit[] { return this.units.map((unit) => ({ ...unit })); }
  take(player: Player, kind: VehicleKind): string | undefined {
    if (player.riding) return 'いま乗っているものを置き場に返してから借りてください。';
    if (!nearVehicleDock(player, kind)) return `${VEHICLES[kind].name}の置き場のすぐ横まで歩いてください。`;
    const unit = this.units.find((u) => u.kind === kind && u.riderId === null);
    if (!unit) return 'いまはすべて貸し出し中です。戻ってきたら借りられます。';
    unit.riderId = player.id; player.riding = { id: unit.id, kind };
  }
  return(player: Player): string | undefined {
    if (!player.riding) return 'いま借りている乗りものはありません。';
    if (!VEHICLE_KINDS.some((kind) => nearVehicleDock(player, kind))) return 'ひだまりオフィスの置き場に戻って返却してください。';
    this.release(player);
  }
  // Enter once, act once. Leaving the pad rearms the next pickup/return.
  touch(player: Player): boolean {
    const kind = touchingVehicleDock(player), previous = this.contacts.get(player.id);
    if (!kind) { this.contacts.delete(player.id); return false; }
    this.contacts.set(player.id, kind);
    if (kind === previous) return false;
    if (player.riding) { this.release(player); return true; }
    return !this.take(player, kind);
  }
  forget(player: Player): void { this.contacts.delete(player.id); this.release(player); }
  release(player: Player): void {
    for (const unit of this.units) if (unit.riderId === player.id) unit.riderId = null;
    delete player.riding;
  }
}
