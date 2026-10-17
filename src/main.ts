import { VEHICLES, VEHICLE_KINDS } from './game/transport.ts';
import { setupBuddyEditor } from './game/buddy-editor.ts';
import { setupAvatarEditor } from './game/avatar-editor.ts';
import { ROOMS } from './game/rooms.ts';
import { OBJECT_CATALOG, OBJECT_KINDS } from './game/objects.ts';
import { REACTIONS, REACTION_KINDS } from './game/reactions.ts';
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
      <section class="buddy-section"><h2 class="section-label">あなたのバディ</h2><p id="buddy-current"></p><button type="button" id="buddy-edit" class="avatar-edit">バディを選ぶ</button><p class="field-hint">あなたの歩いた道を、一歩うしろから。</p></section>
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
      <section class="room-switcher" aria-label="フロア移動"><div><span class="eyebrow">${ROOMS.length} ROOMS TO EXPLORE</span><strong data-room-name>ひだまりオフィス</strong><p id="room-description"></p></div><div class="room-switcher-actions"><button type="button" id="people-open">人を探す</button><button type="button" id="room-picker-open">部屋を移動 <span aria-hidden="true">↗</span></button></div></section>
      <p id="people-travel-status" role="status"></p>
      <div class="game-frame">
        <div class="game-topline"><span><i></i> <span data-current-area>エントランス</span></span><span><span data-room-name>ひだまりオフィス</span> <b id="room-number">01</b></span></div>
        <div class="map-surround"><div class="window-wall"><canvas id="sky-window" width="480" height="56" role="img" aria-label="日本時間に合わせて変わる窓の風景"></canvas></div><div id="game" aria-describedby="map-instructions"><p class="loading">オフィスを準備しています…</p></div></div>
        <div class="game-bottomline"><span class="location"><span aria-hidden="true">⌖</span> <span data-current-area>エントランス</span></span><span id="lighting-status">JSTの時刻に合わせて照明を調整</span></div>
        <div class="reaction-toolbar" role="group" aria-label="アバターのリアクション"><span class="reaction-heading">気持ちを伝える</span>${REACTION_KINDS.map((kind, index) => `<button type="button" data-reaction="${kind}" disabled><span aria-hidden="true">${REACTIONS[kind].icon}</span> ${REACTIONS[kind].label}<kbd aria-hidden="true">${index + 1}</kbd></button>`).join('')}</div>
      </div>
      <p id="reaction-status" class="reaction-status" role="status">ボタンで気持ちを伝えよう。マップ操作中は1〜4キーでも使えます。歩くと動作が終わります。</p>
      <div class="under-map"><p id="map-instructions"><span class="keycaps"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>または <strong>W A S D</strong> で移動 <span class="instruction-extra">· マップをクリックして操作</span></span></p><button type="button" class="reset-button" id="vehicle-open">🚲 乗りもの置き場</button><button type="button" class="reset-button" id="reset-position"><span aria-hidden="true">↩</span> 入口にもどる</button></div>
      <p id="seating-status" class="office-notice" role="status">椅子・机・ソファの正面で止まると、自動で座ります。</p><p id="office-notice" class="office-notice" role="status"></p><details id="lost-items-panel"><summary>床の落とし物</summary><ul id="lost-item-list"></ul></details><section id="object-tools" class="object-tools" aria-labelledby="object-title">
        <div class="object-heading"><h2 id="object-title">家具と小物で、じぶんたちの部屋に。</h2><span id="object-count">0 / 60</span></div>
        <div class="object-actions"><label for="object-kind">置くもの<select id="object-kind">${OBJECT_KINDS.map((kind) => `<option value="${kind}">${OBJECT_CATALOG[kind].icon} ${OBJECT_CATALOG[kind].name}</option>`).join('')}</select><span id="object-dimensions"></span></label>
        <button type="button" data-object-mode="place" aria-pressed="false" disabled>置く</button><button type="button" data-object-mode="move" aria-pressed="false" disabled>動かす</button><button type="button" data-object-mode="remove" aria-pressed="false" disabled>片づける</button><button type="button" id="object-rotate" disabled>回転 0°</button><button type="button" data-object-mode="none" aria-pressed="true">おわる</button></div>
        <p id="object-status" role="status">家具・小物を選び、「置く」を押してマップをクリック。配置はみんなに共有されます。</p>
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
  <dialog id="object-links-dialog" class="object-links-dialog" aria-labelledby="object-links-title">
    <span class="eyebrow">OPEN TOGETHER</span><h2 id="object-links-title">オブジェクトのリンク</h2>
    <div class="object-links-body">
      <p id="object-links-help" class="links-help">使いたいリンクを選んで、作業をはじめよう。</p>
      <ul id="object-link-list" aria-label="登録済みのリンク"></ul>
      <p id="object-links-empty">まだリンクがありません。「リンクを設定」から追加できます。</p>
      <details id="object-links-settings"><summary>リンクを設定 · お気に入りから選択</summary>
        <p id="object-links-permission" class="links-help"></p>
        <div id="link-favorites" role="group" aria-label="共有のお気に入り"></div>
        <div class="link-save-row"><span id="object-links-selection"></span><button type="button" id="object-links-save">この選択を保存</button></div>
        <details id="favorite-add-section"><summary id="favorite-add-title">共有のお気に入りを追加</summary>
          <form id="favorite-form"><label>リンクの名前<input name="title" maxlength="60" placeholder="チームのMiroボード" required /></label><label>URL<input name="url" type="url" maxlength="2048" placeholder="https://…" required /></label><p class="links-help">オフィス全体で共有されます。HTTPSのURLを登録できます。</p><button type="submit">お気に入りに追加</button></form>
        </details>
      </details>
    </div>
    <p id="object-links-status" role="status"></p><button id="object-links-close" type="button" class="dialog-close">マップにもどる</button>
  </dialog>
  <dialog id="people-dialog" class="people-dialog" aria-labelledby="people-title">
    <span class="eyebrow">FIND YOUR PEOPLE</span><h2 id="people-title">あの人に、会いに行こう。</h2>
    <p class="people-help">Waiwaiへの入室状態を表示します。一度入室したSlackメンバーと、接続中のゲストを探せます。</p>
    <div class="people-search"><label for="people-query">名前・SlackメンバーID<input id="people-query" type="search" maxlength="80" placeholder="名前で検索" autocomplete="off" /></label><label for="people-filter">表示<select id="people-filter"><option value="all">すべて</option><option value="online">オンライン</option><option value="offline">オフライン</option></select></label></div>
    <p id="people-result-count" role="status"></p><p id="people-warning" role="status"></p>
    <ul id="people-results" aria-label="メンバー検索結果"></ul><p id="people-empty"></p>
    <p id="people-status" role="status">接続を確認しています。</p><button type="button" id="people-close" class="dialog-close">閉じる</button>
  </dialog>
  <dialog id="vehicle-dialog" class="vehicle-dialog" aria-labelledby="vehicle-title"><span class="eyebrow">SHARE A RIDE, TAKE A LITTLE TRIP</span><h2 id="vehicle-title">今日は、何に乗っていく？</h2><p id="vehicle-current"></p><p id="vehicle-location"></p><div class="vehicle-cards">${VEHICLE_KINDS.map((kind) => `<section><span class="vehicle-icon" aria-hidden="true">${VEHICLES[kind].icon}</span><h3>${VEHICLES[kind].name}</h3><p>歩く速さの${VEHICLES[kind].speed}</p><strong data-vehicle-count="${kind}">確認中…</strong><button type="button" data-vehicle-take="${kind}" disabled>${VEHICLES[kind].name}を借りる</button></section>`).join('')}</div><p id="vehicle-return-hint"></p><p id="vehicle-status" role="status"></p><div class="dialog-actions"><button type="button" id="vehicle-return" hidden>置き場に返す</button><button type="button" id="vehicle-close">マップにもどる</button></div></dialog>
  <dialog id="buddy-dialog" class="buddy-dialog" aria-labelledby="buddy-title"><form id="buddy-form"><span class="eyebrow">A LITTLE FRIEND, A LITTLE ADVENTURE</span><h2 id="buddy-title">今日の相棒は、だれにする？</h2><p>お気に入りを見つけて、一緒にオフィスを歩こう。</p><label class="buddy-filter"><input type="checkbox" id="buddy-favorites-only"> お気に入りだけ表示</label><div id="buddy-cards"></div><p class="field-hint">選択とお気に入りは、このブラウザーに保存します。</p><div class="dialog-actions"><button type="button" id="buddy-cancel">キャンセル</button><button type="submit">このバディと歩く</button></div></form></dialog>
  <dialog id="lost-item-info" aria-labelledby="lost-item-title"><span class="eyebrow">LITTLE LOST &amp; FOUND</span><h2 id="lost-item-title"></h2><p id="lost-item-description"></p><p class="field-hint">だれかの忘れもの。それとも、オフィスの七不思議？</p><div class="dialog-actions"><button type="button" id="lost-item-close">閉じる</button></div></dialog>
  <dialog id="buddy-info" aria-labelledby="buddy-info-title"><h2 id="buddy-info-title"></h2><p id="buddy-info-owner"></p><p id="buddy-info-description"></p><p>今は一緒に歩く、小さな仲間です。</p><div class="dialog-actions"><button type="button" id="buddy-info-close">閉じる</button></div></dialog>
  <dialog id="avatar-dialog" class="avatar-dialog" aria-labelledby="avatar-title"><form id="avatar-form"><span class="eyebrow">MAKE YOUR OWN CHARACTER</span><h2 id="avatar-title">あなたらしい姿に。</h2><div class="avatar-editor-layout"><div class="avatar-draft-backdrop"><canvas id="avatar-draft" width="20" height="28" aria-label="変更中のアバター"></canvas><p>性別や体型にかかわらず<br>すべての服と髪型を選べます。</p></div><div id="avatar-fields"></div></div><div class="dialog-actions"><button type="button" id="avatar-cancel">キャンセル</button><button type="submit">この見た目にする</button></div></form></dialog>
  <dialog id="room-dialog" class="room-dialog" aria-labelledby="room-dialog-title"><span class="eyebrow">FIND YOUR NEXT PLACE</span><h2 id="room-dialog-title">どの部屋へ行こう？</h2><p>部屋を変えると、移動先の近くの人と音声がつながります。</p><div class="room-grid">${ROOMS.map((room, i) => `<button type="button" data-room="${room.id}" style="--card-accent:#${room.rug.toString(16)}"><span class="room-card-number">${String(i + 1).padStart(2, '0')} / ${room.icon}</span><strong>${room.name}</strong><span>${room.description}</span><small data-room-occupancy="${room.id}">0人</small></button>`).join('')}</div><form method="dialog"><button class="dialog-close">いまの部屋にもどる</button></form></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><span class="eyebrow">HOW TO WALK</span><h2 id="help-title">オフィスを歩いてみよう</h2><p>マップをクリックするか、Tabキーでマップにフォーカスしてから、<strong>矢印キー / WASD</strong> を押すと移動します。</p><p>スマートフォンやタブレットでは、マップ下の方向ボタンを使えます。</p><p>リアクションのボタン、またはマップ操作中の<strong>1〜4キー</strong>で、お辞儀・ジャンプ・バンザイ・よろこぶ動作を同じ部屋の人に伝えられます。歩くと動作が終わります。</p><p>家具や小物をクリックすると、登録済みのリンクを選んで開けます。「リンクを設定」で共有のお気に入りから複数選べます。リンクのあるホワイトボードは、前に立っても一覧が開きます。</p><p>椅子・机・ソファの正面で止まると自動で座り、移動すると立ち上がります。カフェ・休憩室の自販機のすぐ横に行くとペットボトルを受け取れます。</p><p>オフィスの置き場で、自転車・スケボー・スケートを借りると速く移動できます。置き場に踏み入れると自動で乗り、乗って戻ると返却します。マップ操作中の<strong>Eキー</strong>で空き台数も確認できます。</p><p>床の不思議な落とし物は、クリックするとひと言読めます。「床の落とし物」からも選べます。</p><p>壁や家具のあるマスは通れません。部屋の入口を探してみてください。</p><p>「入口にもどる」で最初の場所に戻れます。Tabキーでマップの操作を抜けられます。</p><form method="dialog"><button class="dialog-close">わかった、歩いてみる</button></form></dialog>
`;

const parent = document.querySelector<HTMLElement>('#game')!;
const { game, scene } = startOffice(parent, initialSlack, authUnavailable || (!!auth.required && !auth.user));
setupAvatarEditor(scene);
setupBuddyEditor(scene);
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

document.querySelectorAll<HTMLDialogElement>('#avatar-dialog, #room-dialog, #object-links-dialog, #lost-item-info').forEach((item) => item.addEventListener('close', () => game.canvas.focus({ preventScroll: true })));

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
