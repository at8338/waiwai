import type { SlackIdentity } from './dm.ts';

export type AuthUser = { name: string; slack?: SlackIdentity; accountId?: string; email?: string; emailVerified?: boolean; provider?: 'slack' | 'entra' | 'gcip' };
export type AuthStatus = { configured: boolean; loginUrl: string | null; user: AuthUser | null; required?: boolean; microsoftLoginUrl?: string | null; identityPlatform?: boolean };
