import type { Point } from './world.ts';
import type { RoomId } from './rooms.ts';
export const WALK_STEP_MS = 145;
export const VEHICLES = {
  bike: { name: '自転車', icon: '🚲', stepMs: 75, speed: '約2倍', count: 3 },
  skateboard: { name: 'スケボー', icon: '🛹', stepMs: 95, speed: '約1.5倍', count: 3 },
  skates: { name: 'ローラースケート', icon: '🛼', stepMs: 105, speed: '約1.4倍', count: 3 },
} as const;
export type VehicleKind = keyof typeof VEHICLES;
export type Riding = { id: string; kind: VehicleKind };
export type VehicleGround = Point & { roomId: RoomId };
export type VehicleUnit = Riding & { riderId: string | null; ground?: VehicleGround };
export type VehicleAction = { type: 'vehicle-take'; kind: VehicleKind } | { type: 'vehicle-return' } | { type: 'vehicle-drop' } | { type: 'vehicle-pickup'; unitId: string };
export const VEHICLE_KINDS = Object.keys(VEHICLES) as VehicleKind[];
export const isVehicleKind = (value: unknown): value is VehicleKind => typeof value === 'string' && Object.hasOwn(VEHICLES, value);
export const movementStep = (kind?: VehicleKind) => kind ? VEHICLES[kind].stepMs : WALK_STEP_MS;
export const VEHICLE_DOCKS = VEHICLE_KINDS.map((kind, i) => ({ kind, roomId: 'office' as RoomId, x: 3 + i * 4, y: 14, w: 3, h: 1 }));
export function nearVehicleDock(player: Point & { roomId: RoomId }, kind: VehicleKind): boolean {
  const dock = VEHICLE_DOCKS.find((d) => d.kind === kind)!;
  const dx = Math.max(dock.x - player.x, 0, player.x - (dock.x + dock.w - 1));
  const dy = Math.max(dock.y - player.y, 0, player.y - (dock.y + dock.h - 1));
  return player.roomId === dock.roomId && dx + dy <= 2;
}
export function touchingVehicleDock(player: Point & { roomId: RoomId }): VehicleKind | undefined {
  return VEHICLE_DOCKS.find((d) => player.roomId === d.roomId && player.x >= d.x && player.x < d.x + d.w && player.y >= d.y && player.y < d.y + d.h)?.kind;
}

export function isVehicleId(value: unknown): value is string {
  return typeof value === 'string' && VEHICLE_KINDS.some((kind) => Array.from({ length: VEHICLES[kind].count }, (_, i) => `${kind}-${i + 1}`).includes(value));
}
export function nearGroundVehicle(player: VehicleGround, unit: VehicleUnit): boolean {
  return !unit.riderId && !!unit.ground && player.roomId === unit.ground.roomId
    && Math.abs(player.x - unit.ground.x) + Math.abs(player.y - unit.ground.y) <= 1;
}
