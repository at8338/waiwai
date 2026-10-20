import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut, getMultiFactorResolver, multiFactor, TotpMultiFactorGenerator, sendEmailVerification, sendPasswordResetEmail, applyActionCode, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import type { Auth, MultiFactorError, MultiFactorResolver, TotpSecret, User } from 'firebase/auth';
import QRCode from 'qrcode';
import './identity-login.css';

/** Tokens, passwords and TOTP secrets stay in memory; only an HttpOnly session survives. */
export function setupIdentityLogin(anchor: HTMLElement, options: { inline?: boolean } = {}): () => void {
  const dialog = document.createElement('dialog'); dialog.className = 'identity-login'; dialog.setAttribute('aria-labelledby', 'identity-login-title');
  dialog.innerHTML = `<h2 id="identity-login-title">Waiwaiにログイン</h2><p>招待されたメールアドレスでログインしてください。</p>
    <form><label>メールアドレス<input name="email" type="email" autocomplete="username" required maxlength="254"></label>
    <label data-password-label>パスワード<input name="password" type="password" autocomplete="current-password" required maxlength="128"></label>
    <section data-enrollment hidden><p>認証アプリでQRコードを読み込むか、下のキーを登録してください。</p><img data-qr alt="認証アプリの登録用QRコード"><code data-secret></code><a data-otp-link>この端末の認証アプリで開く</a></section>
    <label data-code-label hidden>認証アプリの6桁コード<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>
    <p data-status role="status" aria-live="polite"></p><button type="submit" data-submit>ログイン</button></form>
    <div class="identity-login-actions"><button type="button" data-reset>パスワードを忘れた</button><button type="button" data-verify hidden>確認メールを送る</button><button type="button" data-retry hidden>確認したのでログインし直す</button><button type="button" data-close>閉じる</button></div>`;
  (options.inline ? anchor.parentElement! : document.body).append(dialog);
  if (options.inline) { anchor.hidden = true; dialog.querySelector<HTMLButtonElement>('[data-close]')!.hidden = true; }
  const form = dialog.querySelector('form')!, email = form.elements.namedItem('email') as HTMLInputElement, password = form.elements.namedItem('password') as HTMLInputElement, code = form.elements.namedItem('code') as HTMLInputElement;
  const status = dialog.querySelector<HTMLElement>('[data-status]')!, submit = dialog.querySelector<HTMLButtonElement>('[data-submit]')!;
  const enrollment = dialog.querySelector<HTMLElement>('[data-enrollment]')!, codeLabel = dialog.querySelector<HTMLElement>('[data-code-label]')!, passwordLabel = dialog.querySelector<HTMLElement>('[data-password-label]')!;
  const verifyButton = dialog.querySelector<HTMLButtonElement>('[data-verify]')!, retry = dialog.querySelector<HTMLButtonElement>('[data-retry]')!, reset = dialog.querySelector<HTMLButtonElement>('[data-reset]')!;
  let auth: Auth | undefined, resolver: MultiFactorResolver | undefined, secret: TotpSecret | undefined, oobCode: string | undefined;
  let action: 'login' | 'resetPassword' = 'login', busy = false;
  let generation = 0;
  const showCode = () => { codeLabel.hidden = false; code.required = true; password.required = false; passwordLabel.hidden = true; email.readOnly = true; code.focus(); submit.textContent = '認証して入室'; };
  const config = async () => {
    const r = await fetch('/api/auth/identity/config', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error('config'); return await r.json() as { projectId: string; apiKey: string; csrf: string };
  };
  const ensureAuth = async () => {
    if (!auth) { const expected = generation, c = await config(); if (expected !== generation || !dialog.open) throw new Error('Closed'); auth = initializeAuth(initializeApp({ projectId: c.projectId, apiKey: c.apiKey }, `waiwai-login-${crypto.randomUUID()}`), { persistence: inMemoryPersistence }); auth.languageCode = 'ja'; }
    return auth;
  };
  const finish = async (user: User) => {
    const expected = generation, current = auth!, idToken = await user.getIdToken(true), c = await config();
    if (expected !== generation || !dialog.open) return;
    const r = await fetch('/api/auth/identity/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Waiwai-CSRF': c.csrf }, body: JSON.stringify({ idToken }), signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error('session');
    if (expected !== generation || !dialog.open) { await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' }); return; }
    await signOut(current); location.assign('/');
  };
  const firstFactor = async (user: User) => {
    const expected = generation;
    if (!user.emailVerified) {
      status.textContent = 'メールアドレスの確認が必要です。確認メールのリンクを開いた後、ログインし直してください。'; verifyButton.hidden = false; retry.hidden = false; submit.hidden = true; return;
    }
    const claims = (await user.getIdTokenResult()).claims;
    if (expected !== generation || !dialog.open) return;
    if (claims.waiwaiInvited !== true) throw new Error('not invited');
    if (multiFactor(user).enrolledFactors.length) {
      await signOut(auth!); throw new Error('MFA login required');
    }
    const draft = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
    const url = draft.generateQrCodeUrl(user.email ?? 'Waiwai', 'Waiwai'), qr = await QRCode.toDataURL(url, { width: 200, margin: 2 });
    if (expected !== generation || !dialog.open) return;
    secret = draft;
    dialog.querySelector<HTMLImageElement>('[data-qr]')!.src = qr;
    dialog.querySelector('[data-secret]')!.textContent = secret.secretKey;
    dialog.querySelector<HTMLAnchorElement>('[data-otp-link]')!.href = url;
    enrollment.hidden = false; showCode(); submit.textContent = '認証アプリを登録'; status.textContent = '初回のみ、認証アプリの登録が必要です。';
  };
  const clear = async () => {
    generation++; resolver = undefined; secret = undefined; oobCode = undefined; action = 'login'; form.reset(); email.readOnly = false; password.required = true; password.autocomplete = 'current-password'; code.required = false; codeLabel.hidden = true; passwordLabel.hidden = false; enrollment.hidden = true;
    dialog.querySelector('[data-secret]')!.textContent = ''; dialog.querySelector<HTMLImageElement>('[data-qr]')!.removeAttribute('src'); dialog.querySelector('[data-otp-link]')!.removeAttribute('href');
    verifyButton.hidden = true; retry.hidden = true; submit.hidden = false; submit.textContent = 'ログイン'; reset.hidden = false;
    if (auth) { const current = auth; auth = undefined; await signOut(current).catch(() => {}); await deleteApp(current.app); }
  };
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return; busy = true; submit.disabled = true; status.textContent = '確認しています…';
    const currentGeneration = generation;
    try {
      const a = await ensureAuth();
      if (action === 'resetPassword') {
        if (password.value.length < 12) { status.textContent = 'パスワードは12文字以上で設定してください。'; return; }
        await confirmPasswordReset(a, oobCode!, password.value); await clear(); status.textContent = 'パスワードを設定しました。ログインしてください。'; return;
      }
      if (resolver) {
        const factor = resolver.hints.find(h => h.factorId === TotpMultiFactorGenerator.FACTOR_ID); if (!factor) throw new Error('Unsupported factor');
        const result = await resolver.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(factor.uid, code.value));
        if (currentGeneration === generation && dialog.open) await finish(result.user);
      } else if (secret) {
        await multiFactor(a.currentUser!).enroll(TotpMultiFactorGenerator.assertionForEnrollment(secret, code.value), '認証アプリ');
        await clear(); status.textContent = '認証アプリを登録しました。パスワードと認証コードでログインしてください。';
      } else {
        const result = await signInWithEmailAndPassword(a, email.value.trim(), password.value); password.value = '';
        if (currentGeneration === generation && dialog.open) await firstFactor(result.user);
      }
    } catch (error) {
      if (currentGeneration !== generation || !dialog.open) return;
      if ((error as { code?: string }).code === 'auth/multi-factor-auth-required' && auth) {
        resolver = getMultiFactorResolver(auth, error as MultiFactorError); password.value = ''; showCode(); status.textContent = '認証アプリのコードを入力してください。';
      } else { status.textContent = '完了できませんでした。招待・入力内容・リンクの有効期限を確認して、もう一度お試しください。'; code.value = ''; }
    } finally { busy = false; submit.disabled = false; }
  });
  verifyButton.addEventListener('click', async () => {
    if (!auth?.currentUser) return; verifyButton.disabled = true;
    try { await sendEmailVerification(auth.currentUser, { url: location.origin }); status.textContent = '確認メールを送りました。メール内のリンクで確認後、ログインし直してください。'; }
    catch { status.textContent = '送信できませんでした。少し待ってから再試行してください。'; }
    finally { verifyButton.disabled = false; }
  });
  reset.addEventListener('click', async () => {
    if (!email.validity.valid || !email.value) { email.reportValidity(); return; } reset.disabled = true;
    try { await sendPasswordResetEmail(await ensureAuth(), email.value.trim(), { url: location.origin }); }
    catch { /* Do not reveal whether the address has an account. */ }
    finally { status.textContent = '登録済みのアドレスなら、再設定メールが届きます。'; reset.disabled = false; }
  });
  retry.addEventListener('click', () => { void clear().then(() => { status.textContent = 'もう一度ログインしてください。'; }); });
  dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { void clear(); });
  const open = () => { status.textContent = ''; if (!dialog.open) { if (options.inline) dialog.show(); else dialog.showModal(); } };
  anchor.addEventListener('click', open);
  const params = new URL(location.href).searchParams, mode = params.get('mode'), codeFromUrl = params.get('oobCode');
  if (codeFromUrl && ['verifyEmail', 'resetPassword'].includes(mode ?? '')) {
    // Remove bearer action codes before the office UI or future navigation can propagate them.
    const clean = new URL(location.href); for (const k of ['mode', 'oobCode', 'apiKey', 'continueUrl', 'lang']) clean.searchParams.delete(k); history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
    open(); busy = true; submit.disabled = true;
    void ensureAuth().then(async a => {
      if (mode === 'verifyEmail') { await applyActionCode(a, codeFromUrl); status.textContent = 'メールアドレスを確認しました。ログインしてください。'; }
      else { email.value = await verifyPasswordResetCode(a, codeFromUrl); email.readOnly = true; action = 'resetPassword'; oobCode = codeFromUrl; password.autocomplete = 'new-password'; reset.hidden = true; submit.textContent = 'パスワードを設定'; status.textContent = '新しいパスワードを12文字以上で入力してください。'; }
    }).catch(() => { status.textContent = 'リンクが無効か期限切れです。管理者に再発行を依頼してください。'; submit.hidden = true; }).finally(() => { busy = false; submit.disabled = false; });
  }
  if (options.inline) open();
  return () => { anchor.removeEventListener('click', open); dialog.remove(); void clear(); };
}
