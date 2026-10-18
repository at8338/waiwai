import type { ChatMessage } from './chat.ts';
import type { Player } from '../network/protocol.ts';
import type { RoomId } from './rooms.ts';
import { playerIdentity } from './identity.ts';
import { COLS, ROWS, TILE } from './world.ts';
export const SPEECH_MS = 8000;
export type Speech = { id: string; text: string; name: string; channel: '全館' | 'フロア' | 'グループ'; expiresAt: number };
const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
export function speechPreview(text: string): string {
  const parts = [...segmenter.segment(text.replace(/\s+/gu, ' ').trim())].map(p => p.segment);
  const preview = parts.length > 48 ? [...parts.slice(0, 47), '…'] : parts;
  return Array.from({ length: Math.ceil(preview.length / 16) }, (_, i) => preview.slice(i * 16, (i + 1) * 16).join('')).join('\n');
}
export function speechPosition(x: number, headY: number, width: number, height: number): { x: number; y: number } {
  return { x: Math.max(4, Math.min(COLS * TILE - width - 4, Math.round(x - width / 2))), y: Math.max(4, Math.min(ROWS * TILE - height - 10, Math.round(headY - height - 7))) };
}
export class SpeechBubbles {
  private entries = new Map<string, Speech>();
  private seen = new Set<string>();
  receive(message: ChatMessage, roomId: RoomId, players: Iterable<Player>, now: number): string[] {
    const channel = message.conversation === 'global' ? '全館' : message.conversation === `room:${roomId}` ? 'フロア' : message.conversation.startsWith('group:') ? 'グループ' : undefined;
    // Only live messages already authorized by ChatService reach this method.
    // Never infer a bubble from history, inbox previews or a private DM.
    if (!channel || this.seen.has(message.id)) return [];
    this.seen.add(message.id); if (this.seen.size > 256) this.seen.delete(this.seen.values().next().value!);
    const text = speechPreview(message.text); if (!text) return [];
    const ids: string[] = [];
    for (const person of players) if (person.roomId === roomId && playerIdentity(person) === message.authorId) {
      this.entries.set(person.id, { id: message.id, name: person.name, text, channel, expiresAt: now + SPEECH_MS }); ids.push(person.id);
    }
    return ids;
  }
  get(id: string, now: number): Speech | undefined {
    const entry = this.entries.get(id); if (entry && entry.expiresAt <= now) { this.entries.delete(id); return; } return entry;
  }
  remove(id: string): void { this.entries.delete(id); }
  clear(): void { this.entries.clear(); this.seen.clear(); }
}
