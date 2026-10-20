import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryRoute } from './entry-route.ts';
import type { AuthStatus } from './auth.ts';

const origin = new URL('https://office.example.com/?space=default');
const required: AuthStatus = { configured: true, required: true, identityPlatform: true, loginUrl: null, user: null };
test('A pasted URL in a new browser starts at login, not the office or a guest session', () => {
  assert.equal(entryRoute(required, false, origin), 'login');
  assert.equal(entryRoute({ ...required, required: false }, false, origin), 'login');
  assert.equal(entryRoute({ ...required, identityPlatform: false }, false, origin), 'login');
});
test('Only a verified existing session enters directly; unavailable auth never opens the office', () => {
  const signedIn = { ...required, user: { name: 'メンバー', accountId: 'gcip:project:uid' } };
  assert.equal(entryRoute(signedIn, false, origin), 'office');
  assert.equal(entryRoute(signedIn, true, origin), 'unavailable');
  assert.equal(entryRoute({ configured: false, loginUrl: null, user: null }, false, origin), 'office');
});
test('Invitation/password action links are handled before the office even with an existing session', () => {
  for (const mode of ['verifyEmail', 'resetPassword']) {
    const url = new URL(`/?mode=${mode}&oobCode=private-example`, origin);
    assert.equal(entryRoute({ ...required, user: { name: 'メンバー' } }, false, url), 'login');
  }
});
