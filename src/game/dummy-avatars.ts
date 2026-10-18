import { isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { validAnnouncementId } from './announcements.ts';
export type DummyControl = { type: 'dummy-control'; actionId: string; enabled: boolean; roomId?: RoomId };
export type DummyState = { enabled: boolean; count: number; editable: boolean; roomId?: RoomId };
export function parseDummyControl(data: Record<string, unknown>): DummyControl | undefined {
  if (data.type !== 'dummy-control' || !validAnnouncementId(data.actionId) || typeof data.enabled !== 'boolean' || data.roomId !== undefined && !isRoomId(data.roomId)) return;
  return { type: 'dummy-control', actionId: data.actionId, enabled: data.enabled, ...(data.roomId === undefined ? {} : { roomId: data.roomId as RoomId }) };
}
