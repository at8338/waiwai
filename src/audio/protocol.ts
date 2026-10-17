export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type VoiceState = { listening: boolean; microphone: boolean };
export type VoicePeer = { id: string; session: string; microphone: boolean };
export type VoiceSnapshot = { type: 'voice'; self: VoiceState; peers: VoicePeer[]; iceServers: IceServer[]; error?: 'capacity' };
export type VoicePayload =
  | { kind: 'description'; type: 'offer' | 'answer'; sdp: string }
  | { kind: 'candidate'; candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };
export type VoiceSignal = { type: 'voice-signal'; from: string; session: string; payload: VoicePayload };

export function parseVoicePayload(value: unknown): VoicePayload | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (data.kind === 'description' && (data.type === 'offer' || data.type === 'answer') &&
      typeof data.sdp === 'string' && data.sdp.length <= 12_000 &&
      /^m=audio /m.test(data.sdp) && !/^m=(?!audio )/m.test(data.sdp)) {
    return { kind: 'description', type: data.type, sdp: data.sdp };
  }
  if (data.kind === 'candidate' && typeof data.candidate === 'string' && data.candidate.length <= 2048 &&
      (data.sdpMid === null || (typeof data.sdpMid === 'string' && data.sdpMid.length <= 128)) &&
      (data.sdpMLineIndex === null || (Number.isInteger(data.sdpMLineIndex) && (data.sdpMLineIndex as number) >= 0 && (data.sdpMLineIndex as number) < 16))) {
    return { kind: 'candidate', candidate: data.candidate, sdpMid: data.sdpMid as string | null, sdpMLineIndex: data.sdpMLineIndex as number | null };
  }
}
