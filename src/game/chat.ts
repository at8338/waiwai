import { isRoomId } from './rooms.ts';
import type { RoomId } from './rooms.ts';
import { validIdentity } from './identity.ts';
export type ChatTarget = { kind: 'dm'; peerId: string } | { kind: 'room'; roomId: RoomId } | { kind: 'global' } | { kind: 'group'; groupId: string };
export type ChatAction = { type: 'chat-history'; target: ChatTarget; before?: number; actionId: string } | { type: 'chat-send'; target: ChatTarget; text: string; shareSlack: boolean; actionId: string } | { type: 'chat-read'; target: ChatTarget; through: number; actionId: string } | { type: 'chat-group-create'; groupId: string; name: string; memberIds: string[]; actionId: string };
export type ChatMessage = { seq: number; id: string; conversation: string; authorId: string; authorName: string; text: string; createdAt: number; source: 'waiwai' | 'slack' };
export type ChatThread = { target: ChatTarget; conversation: string; name: string; unread: number; last?: ChatMessage; members?: { id: string; name: string }[] };
export type ChatState = { type: 'chat-state'; selfId: string; persistent: boolean; threads: ChatThread[]; slackEnabled: boolean; slackChannel?: string };
export type ChatEvent = ChatState | { type: 'chat-history'; actionId: string; target: ChatTarget; conversation: string; messages: ChatMessage[]; hasMore: boolean } | { type: 'chat-message'; message: ChatMessage } | { type: 'chat-group-created'; actionId: string; target: Extract<ChatTarget, { kind: 'group' }> } | { type: 'chat-result'; actionId: string; error?: string; delivery?: 'saved' | 'slack-queued' };
export const chatText = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && v.trim().length <= 1000 && !/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(v);
export function parseChatAction(data: Record<string, unknown>): ChatAction | undefined {
  const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9-]{36}$/.test(v);
  if (!['chat-history', 'chat-send', 'chat-read', 'chat-group-create'].includes(String(data.type)) || !uuid(data.actionId)) return;
  if (data.type === 'chat-group-create') {
    if (!uuid(data.groupId) || !chatText(data.name) || data.name.trim().length > 40 || !Array.isArray(data.memberIds) || data.memberIds.length < 1 || data.memberIds.length > 19 || !data.memberIds.every(validIdentity) || new Set(data.memberIds).size !== data.memberIds.length) return;
    return { type: 'chat-group-create', actionId: data.actionId, groupId: data.groupId, name: data.name.trim(), memberIds: data.memberIds };
  }
  const t = data.target as Record<string, unknown> | undefined; if (!t) return;
  let target: ChatTarget;
  if (t.kind === 'global') target = { kind: 'global' };
  else if (t.kind === 'room' && isRoomId(t.roomId)) target = { kind: 'room', roomId: t.roomId };
  else if (t.kind === 'dm' && validIdentity(t.peerId)) target = { kind: 'dm', peerId: t.peerId };
  else if (t.kind === 'group' && uuid(t.groupId)) target = { kind: 'group', groupId: t.groupId };
  else return;
  const actionId = data.actionId;
  if (data.type === 'chat-history' && (data.before === undefined || Number.isSafeInteger(data.before) && Number(data.before) > 0)) return { type: 'chat-history', target, actionId, ...(data.before === undefined ? {} : { before: Number(data.before) }) };
  if (data.type === 'chat-read' && Number.isSafeInteger(data.through) && Number(data.through) >= 0) return { type: 'chat-read', target, actionId, through: Number(data.through) };
  if (data.type === 'chat-send' && chatText(data.text) && typeof data.shareSlack === 'boolean' && (!data.shareSlack || target.kind === 'global')) return { type: 'chat-send', target, actionId, text: data.text.trim(), shareSlack: data.shareSlack };
}
