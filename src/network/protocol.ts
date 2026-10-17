import type { Direction } from '../game/world.ts';
import type { VoicePayload, VoiceSignal, VoiceSnapshot } from '../audio/protocol.ts';
import { parseVoicePayload } from '../audio/protocol.ts';

export type Profile = { name: string; outfit: number };
export type Player = Profile & { id: string; x: number; y: number; facing: Direction };
export type ClientMessage =
  | { type: 'voice-state'; listening: boolean; microphone: boolean }
  | { type: 'voice-signal'; to: string; session: string; payload: VoicePayload }
  | { type: 'profile'; name: string; outfit: number }
  | { type: 'move'; direction: Direction; requestId: number }
  | { type: 'reset'; requestId: number };
export type ServerMessage =
  | VoiceSnapshot
  | VoiceSignal
  | { type: 'welcome'; id: string; players: Player[] }
  | { type: 'player'; player: Player; reason: 'join' | 'profile' | 'move' | 'reset'; requestId?: number }
  | { type: 'left'; id: string };

export const directions = ['up', 'down', 'left', 'right'] as const;
export function normalizeName(name: string): string {
  return name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 12) || 'ゲスト';
}

export function parseClientMessage(raw: string): ClientMessage | undefined {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return; }
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (data.type === 'voice-state' && typeof data.listening === 'boolean' && typeof data.microphone === 'boolean') {
    return { type: 'voice-state', listening: data.listening, microphone: data.listening && data.microphone };
  }
  if (data.type === 'voice-signal' && typeof data.to === 'string' && data.to.length <= 64 &&
      typeof data.session === 'string' && data.session.length <= 64) {
    const payload = parseVoicePayload(data.payload);
    if (payload) return { type: 'voice-signal', to: data.to, session: data.session, payload };
    return;
  }
  const validRequest = Number.isSafeInteger(data.requestId) && (data.requestId as number) > 0;
  if (data.type === 'reset' && validRequest) return { type: 'reset', requestId: data.requestId as number };
  if (data.type === 'move' && validRequest && directions.includes(data.direction as Direction)) return { type: 'move', direction: data.direction as Direction, requestId: data.requestId as number };
  if (data.type === 'profile' && typeof data.name === 'string' &&
      Number.isInteger(data.outfit) && (data.outfit as number) >= 0 && (data.outfit as number) <= 2) {
    return { type: 'profile', name: normalizeName(data.name), outfit: data.outfit as number };
  }
}
