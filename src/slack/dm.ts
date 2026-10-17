export type SlackIdentity = { teamId: string; userId: string };
export const SLACK_STORAGE_KEY = 'waiwai.slack.v1';

// Accept IDs only; profile messages must never supply an arbitrary destination URL.
export function parseSlackIdentity(value: unknown): SlackIdentity | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object') return;
  const data = value as Record<string, unknown>;
  if (typeof data.teamId !== 'string' || typeof data.userId !== 'string') return;
  const teamId = data.teamId.trim().toUpperCase();
  const userId = data.userId.trim().toUpperCase();
  if (!/^T[A-Z0-9]{2,31}$/.test(teamId) || !/^[UW][A-Z0-9]{2,31}$/.test(userId)) return;
  return { teamId, userId };
}

export function slackDMUrl(identity: unknown): string | undefined {
  const parsed = parseSlackIdentity(identity);
  if (!parsed) return;
  return `slack://user?${new URLSearchParams({ team: parsed.teamId, id: parsed.userId })}`;
}

export function activateSlackDM(identity: unknown, open: (url: string) => void): boolean {
  const url = slackDMUrl(identity);
  if (!url) return false;
  try { open(url); return true; } catch { return false; }
}

export function readSlackSettings(raw: string | null): SlackIdentity | null {
  if (!raw) return null;
  try { return parseSlackIdentity(JSON.parse(raw)) ?? null; } catch { return null; }
}
