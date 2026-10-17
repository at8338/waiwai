import type { SlackIdentity } from './dm.ts';

export type AuthUser = { name: string; slack?: SlackIdentity; accountId?: string; email?: string; provider?: 'slack' | 'entra' };
export type AuthStatus = { configured: boolean; loginUrl: string | null; user: AuthUser | null; required?: boolean; microsoftLoginUrl?: string | null };
