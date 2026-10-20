import type { AuthStatus } from './auth.ts';

export function entryRoute(auth: AuthStatus, unavailable: boolean, url: URL): 'office' | 'login' | 'unavailable' {
  if (unavailable) return 'unavailable';
  const action = auth.identityPlatform && url.searchParams.has('oobCode') && ['verifyEmail', 'resetPassword'].includes(url.searchParams.get('mode') ?? '');
  if (action || ((auth.required || auth.identityPlatform) && !auth.user)) return 'login';
  return 'office';
}
