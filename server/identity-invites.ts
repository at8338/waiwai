import type { Auth } from 'firebase-admin/auth';
import { randomBytes } from 'node:crypto';

type InviteAdmin = Pick<Auth, 'createUser' | 'getUser' | 'setCustomUserClaims' | 'generatePasswordResetLink' | 'generateEmailVerificationLink' | 'revokeRefreshTokens'>;
export type InvitationInput = { action: 'invite' | 'reissue' | 'revoke'; email: string; name?: string; uid?: string };
function actionLink(link: string, origin: string, expected: string): string {
  const from = new URL(link), code = from.searchParams.get('oobCode');
  if (from.protocol !== 'https:' || from.searchParams.get('mode') !== expected || !code || code.length > 2048) throw new Error('Invalid generated action link');
  const url = new URL(origin); url.searchParams.set('mode', expected); url.searchParams.set('oobCode', code); return url.href;
}
/** Administrative provisioning only. This function never sends email or grants Waiwai administrator status. */
export async function prepareIdentityInvitation(admin: InviteAdmin, input: InvitationInput, origin: string) {
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254 || !['invite', 'reissue', 'revoke'].includes(input.action) || new URL(origin).origin !== origin || !origin.startsWith('https://')) throw new Error('Invalid invitation input');
  if (input.action !== 'invite' && (!input.uid || !/^[A-Za-z0-9_-]{1,128}$/.test(input.uid))) throw new Error('Existing user UID is required');
  // Existing accounts are never adopted by matching an email. Reissue/revoke
  // require the administrator to supply and verify the exact immutable UID.
  const record = input.action === 'invite'
    ? await admin.createUser({ uid: randomBytes(24).toString('hex'), email, displayName: input.name?.trim().slice(0, 60) || 'メンバー', emailVerified: false, password: randomBytes(48).toString('base64url') })
    : await admin.getUser(input.uid!);
  if (record.email?.toLowerCase() !== email || record.disabled) throw new Error('UID/email mismatch or disabled user');
  if (input.action === 'revoke') {
    await admin.setCustomUserClaims(record.uid, { ...record.customClaims, waiwaiInvited: false });
    await admin.revokeRefreshTokens(record.uid); return { uid: record.uid, revoked: true };
  }
  await admin.setCustomUserClaims(record.uid, { ...record.customClaims, waiwaiInvited: true });
  const passwordLink = await admin.generatePasswordResetLink(email, { url: origin });
  const verificationLink = await admin.generateEmailVerificationLink(email, { url: origin });
  return { uid: record.uid, email, passwordSetupUrl: actionLink(passwordLink, origin, 'resetPassword'), emailVerificationUrl: actionLink(verificationLink, origin, 'verifyEmail') };
}
