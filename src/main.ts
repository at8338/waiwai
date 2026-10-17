import { setupAvatarEditor } from './game/avatar-editor.ts';
import { ROOMS } from './game/rooms.ts';
import { OBJECT_CATALOG, OBJECT_KINDS } from './game/objects.ts';
import './style.css';
import { startOffice } from './game/OfficeScene.ts';
import { parseSlackIdentity, readSlackSettings, SLACK_STORAGE_KEY } from './slack/dm.ts';
import type { SlackIdentity } from './slack/dm.ts';
import type { AuthStatus } from './slack/auth.ts';

let auth: AuthStatus = { configured: false, loginUrl: null, user: null };
let authUnavailable = false;
try {
  const response = await fetch('/api/auth/session', { credentials: 'same-origin', signal: AbortSignal.timeout(5000), cache: 'no-store' });
  if (!response.ok) throw new Error('Session unavailable');
  auth = await response.json() as AuthStatus;
} catch { authUnavailable = true; }

let initialSlack: SlackIdentity | null = null;
try { initialSlack = readSlackSettings(window.sessionStorage.getItem(SLACK_STORAGE_KEY)); } catch { /* Settings remain available in memory. */ }
if (auth.user) {
  initialSlack = auth.user.slack;
  try { window.sessionStorage.removeItem(SLACK_STORAGE_KEY); } catch { /* No browser persistence is needed for authenticated profiles. */ }
}

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Waiwai ホーム"><span class="brand-mark" aria-hidden="true">w</span>waiwai<span class="brand-dot">.</span></a>
    <span class="tagline">ふらっと歩いて、誰かのとなりへ。</span>
    <span class="local-badge"><i></i> <span id="connection-label">接続しています</span></span>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="オフィス情報とアバター設定">
      <div class="office-heading"><span class="eyebrow">YOUR LITTLE OFFICE</span><h1>ひだまり<br>オフィス<span class="sun" aria-hidden="true">✳</span></h1><p>今日も、ここから。</p></div>
      <div class="room-card"><span class="room-icon" aria-hidden="true">▦</span><div><strong data-room-name>ひだまりオフィス</strong><span>全フロア / <span data-player-count>接続を待っています</span></span></div><span class="room-dot" aria-hidden="true"></span></div>
      <section class="profile-section" aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="section-label">あなたのアバター</h2>
        <div class="profile-top"><div class="avatar-preview" aria-hidden="true"><canvas id="avatar-preview" width="20" height="28" aria-label="アバターのプレビュー"></canvas></div><div><strong id="profile-name">あなた</strong><span class="profile-presence"><i></i> <span id="profile-presence">接続を待っています</span></span></div></div>
        <label for="display-name">なまえ</label><input id="display-name" type="text" maxlength="12" placeholder="あなた" autocomplete="off" aria-describedby="name-hint" />
        <span class="field-hint" id="name-hint">12文字まで。いつでも変更できます。</span>
        <fieldset class="color-picker"><legend>ふくの色</legend><button type="button" class="swatch green" data-outfit="0" aria-label="みどりの服" aria-pressed="true"></button><button type="button" class="swatch orange" data-outfit="1" aria-label="オレンジの服" aria-pressed="false"></button><button type="button" class="swatch blue" data-outfit="2" aria-label="あおの服" aria-pressed="false"></button></fieldset>
        <button type="button" id="avatar-edit" class="avatar-edit">見た目を変える</button>
      </section>
      <section class="slack-settings" aria-labelledby="slack-settings-title">
        <h2 class="section-label" id="slack-settings-title">あなたのSlack</h2>
        <form id="slack-settings-form" novalidate>
          <label for="slack-team-id">ワークスペースID</label><input id="slack-team-id" type="text" maxlength="40" placeholder="T012ABCDEF" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="slack-settings-help slack-settings-status" />
          <label for="slack-user-id">メンバーID</label><input id="slack-user-id" type="text" maxlength="40" placeholder="U012ABCDEF" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="slack-settings-help slack-settings-status" />
          <p id="slack-settings-help">設定したIDを参加者に共有し、このタブに保存します。本人確認は行いません。</p>
          <div class="slack-settings-buttons"><button type="submit">Slack設定を保存</button><button type="button" id="slack-settings-clear">解除</button></div>
          <p id="slack-settings-status" role="status">Slackアプリで相手のDMを開けます。</p>
        </form>
      </section>
      <section class="participants-section" aria-labelledby="participants-title"><h2 class="section-label" id="participants-title">この部屋にいる人</h2><p class="participant-count" data-room-count aria-live="polite">接続を待っています</p><ul id="participants" aria-label="参加者一覧"></ul></section>
      <div class="sidebar-note"><span aria-hidden="true">✦</span><p>まずは、のんびり歩いてみよう。<br>お気に入りの席が見つかるかも。</p></div>
      <div class="version">WAIWAI <span>はじまりのバージョン / 0.1</span></div>
    </aside>
    <section class="office-view" aria-labelledby="map-title">
      <section class="slack-login" aria-labelledby="slack-login-title">
        <h2 class="section-label" id="slack-login-title">Slackでログイン</h2>
        <p id="slack-login-status" role="status"></p>
        <a id="slack-login-link" class="slack-login-button" hidden><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#36c5f0" d="M5 14a2 2 0 1 1-2-2h2zm1 0a2 2 0 0 1 4 0v6a2 2 0 0 1-4 0z"/><path fill="#2eb67d" d="M10 5a2 2 0 1 1 2-2v2zm0 1a2 2 0 0 1 0 4H4a2 2 0 0 1 0-4z"/><path fill="#ecb22e" d="M19 10a2 2 0 1 1 2 2h-2zm-1 0a2 2 0 0 1-4 0V4a2 2 0 0 1 4 0z"/><path fill="#e01e5a" d="M14 19a2 2 0 1 1-2 2v-2zm0-1a2 2 0 0 1 0-4h6a2 2 0 0 1 0 4z"/></svg>Sign in with Slack</a>
        <button type="button" id="slack-logout" hidden>ログアウト</button>
        <button type="button" id="slack-auth-retry" hidden>ログイン状態を再確認</button>
        <p id="slack-login-help">ログインすると、名前とSlack IDが自動で設定されます。</p>
      </section>
      <div class="map-heading"><div><span class="eyebrow">LET’S TAKE A LITTLE WALK</span><h2 id="map-title">小さなオフィスへ、ようこそ。</h2></div><button type="button" class="help-button" id="help-button" aria-label="操作方法を表示">?</button></div>
      <section class="room-switcher" aria-label="フロア移動"><div><span class="eyebrow">11 ROOMS TO EXPLORE</span><strong data-room-name>ひだまりオフィス</strong><p id="room-description"></p></div><button type="button" id="room-picker-open">部屋を移動 <span aria-hidden="true">↗</span></button></section>
      <div class="game-frame">
        <div class="game-topline"><span><i></i> <span data-current-area>エントランス</span></span><span><span data-room-name>ひだまりオフィス</span> <b id="room-number">01</b></span></div>
        <div class="map-surround"><div id="game" aria-describedby="map-instructions"><p class="loading">オフィスを準備しています…</p></div></div>
        <div class="game-bottomline"><span class="location"><span aria-hidden="true">⌖</span> <span data-current-area>エントランス</span></span><span>歩いて、お気に入りの場所へ。</span></div>
      </div>
      <div class="under-map"><p id="map-instructions"><span class="keycaps"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>または <strong>W A S D</strong> で移動 <span class="instruction-extra">· マップをクリックして操作</span></span></p><button type="button" class="reset-button" id="reset-position"><span aria-hidden="true">↩</span> 入口にもどる</button></div>
      <section id="object-tools" class="object-tools" aria-labelledby="object-title">
        <div class="object-heading"><h2 id="object-title">小物で、じぶんたちの部屋に。</h2><span id="object-count">0 / 60</span></div>
        <div class="object-actions"><label for="object-kind">置くもの<select id="object-kind">${OBJECT_KINDS.map((kind) => `<option value="${kind}">${OBJECT_CATALOG[kind].icon} ${OBJECT_CATALOG[kind].name}</option>`).join('')}</select></label>
        <button type="button" data-object-mode="place" aria-pressed="false" disabled>置く</button><button type="button" data-object-mode="move" aria-pressed="false" disabled>動かす</button><button type="button" data-object-mode="remove" aria-pressed="false" disabled>片づける</button><button type="button" id="object-rotate" disabled>回転 0°</button><button type="button" data-object-mode="none" aria-pressed="true">おわる</button></div>
        <p id="object-status" role="status">小物を選び、「置く」を押してマップをクリック。配置はみんなに共有されます。</p>
      </section>
      <p class="slack-map-hint">相手のアバター・名前をクリックすると、設定されたSlackのDMを開きます。</p>
      <section id="slack-target" class="slack-target" aria-labelledby="slack-target-name" hidden><h2 id="slack-target-name"></h2><p id="slack-target-message" role="status"></p><code id="slack-target-ids"></code><a id="slack-dm-link" hidden>SlackアプリでDMを開く</a></section>
      <div class="touch-controls" aria-label="移動ボタン"><button type="button" data-direction="up" aria-label="上へ移動">↑</button><button type="button" data-direction="left" aria-label="左へ移動">←</button><span aria-hidden="true">✦</span><button type="button" data-direction="right" aria-label="右へ移動">→</button><button type="button" data-direction="down" aria-label="下へ移動">↓</button></div>
      <p id="connection-message" class="connection-message" role="status">オフィスに接続しています…</p>
      <section id="voice-controls" class="voice-controls" aria-labelledby="voice-title">
        <div><h2 id="voice-title">近くで、ちょっと話そう。</h2><p id="voice-status" role="status">オフィスへの接続後に参加できます。</p><p id="voice-nearby">初期状態はマイクOFFです。</p></div>
        <div class="voice-buttons"><button type="button" id="voice-toggle" aria-pressed="false" disabled>音声に参加</button><button type="button" id="mic-toggle" aria-pressed="false" disabled>マイクをON</button></div>
        <p class="voice-hint">同じ部屋で5マス未満の人に声が届きます。近いほど大きく聞こえます。音声に参加しただけではマイクはONになりません。</p>
      </section>
      <div class="map-legend"><span><i class="legend-work"></i>ワークエリア</span><span><i class="legend-meet"></i>ミーティングルーム</span><span><i class="legend-lounge"></i>ラウンジ</span><span class="scope-note">近づいて会話、クリックしてSlackへ。</span></div>
    </section>
  </main>
  <footer class="page-footer"><span>離れていても、おなじ場所に。</span><span>MADE FOR LITTLE ENCOUNTERS <span aria-hidden="true">✦</span></span></footer>
  <dialog id="avatar-dialog" class="avatar-dialog" aria-labelledby="avatar-title"><form id="avatar-form"><span class="eyebrow">MAKE YOUR OWN CHARACTER</span><h2 id="avatar-title">あなたらしい姿に。</h2><div class="avatar-editor-layout"><div class="avatar-draft-backdrop"><canvas id="avatar-draft" width="20" height="28" aria-label="変更中のアバター"></canvas><p>性別や体型にかかわらず<br>すべての服と髪型を選べます。</p></div><div id="avatar-fields"></div></div><div class="dialog-actions"><button type="button" id="avatar-cancel">キャンセル</button><button type="submit">この見た目にする</button></div></form></dialog>
  <dialog id="room-dialog" class="room-dialog" aria-labelledby="room-dialog-title"><span class="eyebrow">FIND YOUR NEXT PLACE</span><h2 id="room-dialog-title">どの部屋へ行こう？</h2><p>部屋を変えると、移動先の近くの人と音声がつながります。</p><div class="room-grid">${ROOMS.map((room, i) => `<button type="button" data-room="${room.id}" style="--card-accent:#${room.rug.toString(16)}"><span class="room-card-number">${String(i + 1).padStart(2, '0')} / ${room.icon}</span><strong>${room.name}</strong><span>${room.description}</span><small data-room-occupancy="${room.id}">0人</small></button>`).join('')}</div><form method="dialog"><button class="dialog-close">いまの部屋にもどる</button></form></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><span class="eyebrow">HOW TO WALK</span><h2 id="help-title">オフィスを歩いてみよう</h2><p>マップをクリックするか、Tabキーでマップにフォーカスしてから、<strong>矢印キー / WASD</strong> を押すと移動します。</p><p>スマートフォンやタブレットでは、マップ下の方向ボタンを使えます。</p><p>壁や家具のあるマスは通れません。部屋の入口を探してみてください。</p><p>「入口にもどる」で最初の場所に戻れます。Tabキーでマップの操作を抜けられます。</p><form method="dialog"><button class="dialog-close">わかった、歩いてみる</button></form></dialog>
`;

const parent = document.querySelector<HTMLElement>('#game')!;
const { game, scene } = startOffice(parent, initialSlack, authUnavailable || (!!auth.required && !auth.user));
setupAvatarEditor(scene);
const nameInput = document.querySelector<HTMLInputElement>('#display-name')!;
const loginStatus = document.querySelector<HTMLElement>('#slack-login-status')!;
const loginLink = document.querySelector<HTMLAnchorElement>('#slack-login-link')!;
const logout = document.querySelector<HTMLButtonElement>('#slack-logout')!;
const retry = document.querySelector<HTMLButtonElement>('#slack-auth-retry')!;
loginStatus.textContent = authUnavailable ? 'ログイン状態を確認できませんでした。再確認してください。'
  : auth.user ? `${auth.user.name}さんでログイン中`
  : auth.required ? '会社のSlackアカウントでログインして入室してください。'
  : auth.configured ? 'ゲストとして入室しています。' : 'Slackログインは準備中です。管理者の連携設定後に利用できます。';
if (!authUnavailable && auth.loginUrl) { loginLink.href = auth.loginUrl; loginLink.hidden = !!auth.user; }
logout.hidden = !auth.user;
retry.hidden = !authUnavailable;
retry.addEventListener('click', () => window.location.reload());
if (auth.user) {
  document.querySelector('#slack-login-help')!.textContent = '名前とSlack IDはSlackのプロフィールを使用しています。';
  nameInput.value = auth.user.name;
  nameInput.readOnly = true;
  scene.setName(auth.user.name);
  document.querySelector('#profile-name')!.textContent = auth.user.name;
  document.querySelector('#name-hint')!.textContent = 'Slackの名前を自動設定しています。';
}
const callbackStatus = new URL(window.location.href).searchParams.get('login');
if (callbackStatus === 'failed' || callbackStatus === 'expired') {
  loginStatus.textContent = callbackStatus === 'expired' ? 'ログインの有効時間が切れました。もう一度お試しください。' : 'Slackログインを完了できませんでした。キャンセルした場合も、もう一度試せます。';
  const cleanUrl = new URL(window.location.href); cleanUrl.searchParams.delete('login');
  window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
}
logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    const response = await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Logout failed');
    window.location.reload();
  } catch { loginStatus.textContent = 'ログアウトできませんでした。もう一度お試しください。'; logout.disabled = false; }
});
const slackTeam = document.querySelector<HTMLInputElement>('#slack-team-id')!;
const slackUser = document.querySelector<HTMLInputElement>('#slack-user-id')!;
const slackStatus = document.querySelector<HTMLElement>('#slack-settings-status')!;
slackTeam.value = initialSlack?.teamId ?? '';
slackUser.value = initialSlack?.userId ?? '';
if (auth.user || authUnavailable) {
  slackTeam.readOnly = true; slackUser.readOnly = true;
  document.querySelector<HTMLElement>('.slack-settings-buttons')!.hidden = true;
  document.querySelector('#slack-settings-help')!.textContent = auth.user ? 'Slackログインから自動設定され、接続中の参加者に共有されます。' : 'ログイン状態の再確認後に設定できます。';
  slackStatus.textContent = auth.user ? 'Slackログイン済みです。手動設定は不要です。' : 'ログイン状態を確認できていません。';
}
const saveSlack = (identity: SlackIdentity | null) => {
  if (auth.user || authUnavailable) return;
  scene.setSlack(identity);
  let stored = true;
  try {
    if (identity) window.sessionStorage.setItem(SLACK_STORAGE_KEY, JSON.stringify(identity));
    else window.sessionStorage.removeItem(SLACK_STORAGE_KEY);
  } catch { stored = false; }
  slackTeam.value = identity?.teamId ?? '';
  slackUser.value = identity?.userId ?? '';
  slackTeam.removeAttribute('aria-invalid'); slackUser.removeAttribute('aria-invalid');
  slackStatus.textContent = identity ? 'Slack設定を保存しました。接続中は参加者に共有されます。' : 'Slack設定を解除しました。';
  if (!stored) slackStatus.textContent += ' この環境では再読み込みすると設定が消える場合があります。';
};
document.querySelector('#slack-settings-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const identity = !slackTeam.value.trim() && !slackUser.value.trim() ? null
    : parseSlackIdentity({ teamId: slackTeam.value, userId: slackUser.value });
  if (identity === undefined) {
    slackStatus.textContent = 'Tで始まるワークスペースIDと、UまたはWで始まるメンバーIDを入力してください。URLや表示名は使えません。';
    slackTeam.setAttribute('aria-invalid', 'true'); slackUser.setAttribute('aria-invalid', 'true');
    slackTeam.focus(); return;
  }
  saveSlack(identity);
});
document.querySelector('#slack-settings-clear')!.addEventListener('click', () => saveSlack(null));

document.querySelector<HTMLInputElement>('#display-name')!.addEventListener('input', (event) => {
  const name = (event.target as HTMLInputElement).value;
  scene.setName(name);
  document.querySelector('#profile-name')!.textContent = name.trim() || 'あなた';
});

const dialog = document.querySelector<HTMLDialogElement>('#help-dialog')!;
document.querySelector('#help-button')!.addEventListener('click', () => dialog.showModal());
dialog.addEventListener('close', () => game.canvas.focus({ preventScroll: true }));

document.querySelectorAll<HTMLDialogElement>('#avatar-dialog, #room-dialog').forEach((item) => item.addEventListener('close', () => game.canvas.focus({ preventScroll: true })));

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
