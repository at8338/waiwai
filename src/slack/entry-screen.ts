import type { AuthStatus } from './auth.ts';
import './entry-screen.css';

export async function showEntryScreen(auth: AuthStatus, unavailable: boolean): Promise<void> {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = '<main class="auth-entry"><header><a class="auth-entry-brand" href="/">waiwai<span>.</span></a><p>ふらっと歩いて、誰かのとなりへ。</p></header><section class="auth-entry-card" aria-label="Waiwaiへのログイン"><p class="auth-entry-status" role="status"></p><div class="auth-entry-form"></div></section><footer>ログインすると、みんなのオフィスに入れます。</footer></main>';
  const status = app.querySelector<HTMLElement>('.auth-entry-status')!, host = app.querySelector<HTMLElement>('.auth-entry-form')!;
  if (unavailable) {
    status.textContent = 'ログイン状態を確認できませんでした。接続を確認して、もう一度お試しください。';
    const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'もう一度確認する'; retry.addEventListener('click', () => location.reload()); host.append(retry); return;
  }
  if (auth.identityPlatform) {
    status.hidden = true;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'メールアドレスでログイン'; host.append(button);
    const { setupIdentityLogin } = await import('./identity-login.ts');
    const dispose = setupIdentityLogin(button, { inline: true });
    if (import.meta.hot) import.meta.hot.dispose(dispose);
    return;
  }
  status.textContent = 'アカウントでログインしてください。';
  for (const [url, label] of [[auth.microsoftLoginUrl, 'Microsoftでログイン'], [auth.loginUrl, 'Slackでログイン']] as const) {
    if (!url) continue;
    const link = document.createElement('a'); link.href = url; link.textContent = label; link.className = 'slack-login-button'; host.append(link);
  }
}
