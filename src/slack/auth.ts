import type { SlackIdentity } from './dm.ts';

export type AuthUser = { name: string; slack: SlackIdentity };
export type AuthStatus = { configured: boolean; loginUrl: string | null; user: AuthUser | null; required?: boolean };
