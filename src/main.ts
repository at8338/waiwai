import { ARCADE_GAMES } from './game/arcade.ts';
import { ROBOT_ACTIONS, ROBOT_PARTS, robotLocation } from './game/robot.ts';
import { DURATIONS, LEADS, REPEATS } from './game/announcements.ts';
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
      <section class="buddy-section"><h2 class="section-label">あなたのバディ</h2><p id="buddy-current"></p><button type="button" id="buddy-edit" class="avatar-edit">バディを選ぶ</button><p class="field-hint">あなたの歩いた道を、一歩うしろから。</p><button type="button" id="pokemon-journal-open" class="avatar-edit">ポケモン図鑑 0 / 3</button><p class="field-hint">ポケモンを見つけてクリックすると、図鑑に記録できます。</p></section>
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
      <section class="room-switcher" aria-label="フロア移動"><div><span class="eyebrow">${ROOMS.length} ROOMS TO EXPLORE</span><strong data-room-name>ひだまりオフィス</strong><p id="room-description"></p><span id="robot-location" class="robot-location">WAIWAI-01 / 胴体</span></div><div class="room-switcher-actions"><button type="button" id="people-open">人を探す</button><button type="button" id="room-picker-open">部屋を移動 <span aria-hidden="true">↗</span></button></div></section>
      <p id="people-travel-status" role="status"></p>
      <section id="arcade-panel" class="arcade-panel" hidden aria-label="ゲームセンター"><div><span class="eyebrow">ONE LITTLE BREAK. PLAY TOGETHER.</span><h3>ひとりでも、みんなでも。あそぼう。</h3><p id="arcade-room-status"></p></div><button type="button" id="arcade-open">ゲームを選ぶ / 観戦する ↗</button></section>
      <section id="cockpit-panel" class="cockpit-panel" hidden aria-label="巨大ロボット操縦室"><div><span class="eyebrow">WAIWAI-01 · PLAY DECK</span><h3>ワイワイガー、発進準備。</h3><p id="cockpit-status" role="status"></p></div><button type="button" id="cockpit-open">操縦する / 機体の中を見る ↗</button></section>
      <section id="birthday-banner" class="birthday-banner" aria-label="今日のお誕生日" hidden><span class="eyebrow">HAPPY BIRTHDAY · WISH YOU A LOVELY DAY</span><h3>🎂 今日は、ちょっと特別な日。</h3><div id="birthday-people"></div></section><p id="birthday-status" class="birthday-status" role="status"></p>
      <section id="daily-event-panel" class="daily-event-panel" aria-label="今日の事件"><div><span class="eyebrow">SOMETHING HAPPENED TODAY</span><strong id="daily-event-title">今日の事件を確認しています…</strong><p id="daily-event-meta"></p><span id="daily-event-found">今日、どこかで小さな事件。</span></div><div class="daily-event-actions"><button type="button" id="daily-event-go" disabled>現場を見に行く ↗</button><button type="button" id="event-journal-open">事件の図鑑</button><button type="button" id="office-calendar-open">館内カレンダー</button></div></section>
      <section class="broadcast-panel" aria-label="全フロアの館内放送">
        <div class="broadcast-heading"><div><span class="eyebrow">OFFICE ANNOUNCEMENTS</span><strong>館内放送 <small>全フロア共通</small></strong></div><div class="broadcast-actions"><button type="button" id="broadcast-open" disabled>館内放送を出す</button><button type="button" id="schedule-open" disabled>予定・定例を設定</button><button type="button" id="birthday-open" disabled>🎂 誕生日</button></div></div>
        <div id="broadcast-banner" role="log" aria-label="現在の館内放送" aria-live="polite" aria-relevant="additions text"></div>
        <p id="broadcast-quiet">ただいま放送はありません。</p><p id="broadcast-warning" role="status"></p>
      </section>
      <div class="game-frame">
        <div class="game-topline"><span><i></i> <span data-current-area>エントランス</span></span><span><span data-room-name>ひだまりオフィス</span> <b id="room-number">01</b></span></div>
        <div class="map-surround"><div class="window-wall"><canvas id="sky-window" width="480" height="56" role="img" aria-label="日本時間に合わせて変わる窓の風景"></canvas></div><div id="game" aria-describedby="map-instructions"><p class="loading">オフィスを準備しています…</p><button type="button" id="vehicle-quick-drop" class="vehicle-quick-drop" aria-label="ここで降りる（Eキー）" hidden disabled>降りる <kbd>E</kbd></button><p id="vehicle-quick-status" class="vehicle-quick-status" role="status" hidden></p></div></div>
        <div class="game-bottomline"><span class="location"><span aria-hidden="true">⌖</span> <span data-current-area>エントランス</span></span><span id="lighting-status">JSTの時刻に合わせて照明を調整</span></div>
        <div class="reaction-toolbar" role="group" aria-label="アバターのリアクション"><span class="reaction-heading">気持ちを伝える</span>${REACTION_KINDS.map((kind, index) => `<button type="button" data-reaction="${kind}" disabled><span aria-hidden="true">${REACTIONS[kind].icon}</span> ${REACTIONS[kind].label}<kbd aria-hidden="true">${index + 1}</kbd></button>`).join('')}</div>
      </div>
      <p id="reaction-status" class="reaction-status" role="status">ボタンで気持ちを伝えよう。マップ操作中は1〜4キーでも使えます。歩くと動作が終わります。</p>
      <div class="under-map"><p id="map-instructions"><span class="keycaps"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>または <strong>W A S D</strong> で移動 <span class="instruction-extra">· マップをクリックして操作</span></span></p><button type="button" class="reset-button" id="vehicle-open">🚲 乗りものを探す</button><button type="button" class="reset-button" id="reset-position"><span aria-hidden="true">↩</span> 入口にもどる</button></div>
      <p id="seating-status" class="office-notice" role="status">椅子・机・ソファの正面で止まると、自動で座ります。</p><p id="office-notice" class="office-notice" role="status"></p><details id="lost-items-panel"><summary>床の落とし物（全館で最大3個）</summary><ul id="lost-item-list"></ul></details><section id="object-tools" class="object-tools" aria-labelledby="object-title">
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
  <dialog id="arcade-dialog" class="arcade-dialog" aria-labelledby="arcade-title"><div class="arcade-heading"><div><span class="eyebrow">WAIWAI SOCIAL ARCADE · FREE PLAY</span><p>ちいさな勝負で、ちょっと仲良く。</p></div><button type="button" id="arcade-close">閉じる</button></div><nav id="arcade-tabs" aria-label="遊ぶゲームを選ぶ">${Object.entries(ARCADE_GAMES).map(([id, game]) => `<button type="button" data-arcade-game="${id}" aria-pressed="${id === 'four'}" style="--arcade-accent:${game.color}"><strong>${game.name}</strong><span>${game.tag}</span><small>接続を確認中</small></button>`).join('')}</nav><div class="arcade-game-body"><section id="arcade-screen" class="arcade-screen"><span id="arcade-clock"></span><p id="arcade-rhythm-cue" hidden></p><p id="arcade-radar" hidden></p><canvas id="arcade-canvas" width="336" height="200" role="img" aria-label="共有ゲーム画面"></canvas><p id="arcade-board-text" class="sr-only"></p><div id="arcade-rhythm-controls" hidden><button type="button" data-rhythm-key="0"></button><button type="button" data-rhythm-key="1"></button><button type="button" data-rhythm-key="2"></button></div><p id="arcade-feedback" hidden></p><div id="arcade-drop-controls" aria-label="星を落とす列を選ぶ">${Array.from({length:7}, (_, x) => `<button type="button" data-arcade-command="drop" data-value="${x}" aria-label="${x + 1}列目に落とす">${x + 1} ↓</button>`).join('')}</div><div id="arcade-tap-controls" hidden><button type="button" id="arcade-reflex-button" data-arcade-command="tap">光ったら押そう</button></div><div id="arcade-fire-controls" hidden aria-label="空を迎撃する">${[0, 1, 2].map((lane) => `<button type="button" data-arcade-command="fire" data-value="${lane}">${lane + 1}番の空を守る</button>`).join('')}<small>キーボードの1・2・3でも迎撃できます。</small></div></section><section class="arcade-info"><span id="arcade-tag"></span><h2 id="arcade-title"></h2><p id="arcade-rules"></p><button id="arcade-sound" type="button" aria-pressed="false" hidden>効果音 OFF</button><div id="arcade-members" aria-label="参加者"></div><p id="arcade-status" role="status"></p><div class="arcade-actions"><button id="arcade-join" type="button" data-arcade-command="join">参加する</button><button id="arcade-start" type="button" data-arcade-command="start">スタート</button><button id="arcade-leave" type="button" data-arcade-command="leave">退席する</button></div><p id="arcade-error" role="status"></p><p id="arcade-participation" class="field-hint"></p></section></div></dialog>
  <dialog id="cockpit-dialog" class="cockpit-dialog" aria-labelledby="cockpit-title"><span class="eyebrow">WAIWAI-01 · EVERY ROOM IS PART OF US</span><h2 id="cockpit-title">ワイワイガー操縦室</h2><p>いつものオフィスは、巨大ロボットの中。ここは、みんなで遊ぶ操縦シミュレーター。</p><div class="cockpit-dialog-body"><div class="cockpit-hero"><canvas id="cockpit-robot" width="128" height="144" role="img" aria-label="巨大ロボット・ワイワイガーの全身図"></canvas><strong>WAIWAI-01</strong><span>WORK TOGETHER. PLAY TOGETHER.</span></div><section aria-label="操縦コマンド"><p id="cockpit-modal-status" role="status"></p><p id="cockpit-message" class="cockpit-message"></p><div id="cockpit-commands" class="cockpit-commands">${Object.entries(ROBOT_ACTIONS).map(([id, action]) => `<button type="button" data-robot-action="${id}" disabled><strong>${action.label}</strong><span>${action.description}</span></button>`).join('')}</div><p id="cockpit-request-status" class="field-hint" role="status"></p></section><section class="robot-inside" aria-label="機体の部屋案内"><h3>このオフィス、じつはここに。</h3><div id="cockpit-parts" class="cockpit-parts">${ROBOT_PARTS.map((part) => `<button type="button" data-robot-part="${part.id}" aria-pressed="${part.id === 'head'}">${part.label}</button>`).join('')}</div><h4 id="robot-part-title"></h4><p id="robot-part-description"></p><div id="robot-part-rooms" class="robot-part-rooms"></div></section></div><button type="button" id="cockpit-close" class="dialog-close">操縦室にもどる</button></dialog>
  <dialog id="event-detail-dialog" class="event-dialog" aria-labelledby="event-detail-title"><span class="eyebrow">TODAY’S LITTLE DISCOVERY</span><h2 id="event-detail-title"></h2><p id="event-detail-meta"></p><canvas id="event-detail-art" width="256" height="144" role="img" aria-label="事件のピクセルイラスト"></canvas><p id="event-detail-story" class="event-story"></p><p id="event-detail-stamp" class="event-stamp"></p><button type="button" id="event-detail-close" class="dialog-close">閉じる</button></dialog>
  <dialog id="event-journal-dialog" class="event-dialog" aria-labelledby="event-journal-title"><span class="eyebrow">THE OFFICE CHRONICLES · 365 STORIES</span><h2 id="event-journal-title">事件の図鑑</h2><p>あの日、この部屋で。今日を含む直近365日分の事件を振り返れます。未来の事件は、まだひみつ。</p><p id="event-journal-progress" class="event-stamp"></p><label for="event-history-select">日付と事件を選ぶ</label><select id="event-history-select"></select><div id="event-journal-content"><h3 id="event-history-title"></h3><p id="event-history-meta"></p><canvas id="event-history-art" width="256" height="144" role="img" aria-label="過去の事件のピクセルイラスト"></canvas><p id="event-history-story" class="event-story"></p><p id="event-history-stamp" class="event-stamp"></p></div><p class="field-hint">館内の記録は2026年10月17日から。発見済みの印はこのブラウザに保存します。</p><button type="button" id="event-journal-close" class="dialog-close">閉じる</button></dialog>
  <dialog id="office-calendar-dialog" class="office-calendar-dialog" aria-labelledby="office-calendar-title"><span class="eyebrow">OUR PLANS &amp; LITTLE INCIDENTS</span><h2 id="office-calendar-title">館内カレンダー</h2><p>どの部屋の壁からも、同じ予定と事件の記録へ。</p><div class="calendar-toolbar"><button type="button" id="calendar-prev" aria-label="前の月">‹</button><h3 id="calendar-month"></h3><button type="button" id="calendar-next" aria-label="次の月">›</button><button type="button" id="calendar-today">今日</button></div><div class="office-calendar-body"><div><div class="calendar-weekdays" aria-hidden="true"><span>日</span><span>月</span><span>火</span><span>水</span><span>木</span><span>金</span><span>土</span></div><div id="calendar-grid" class="calendar-grid" role="group" aria-label="日付を選ぶ"></div><p class="field-hint">予定：館内の定例・会議　✦：その日に起きた事件　🎂：誕生日</p></div><section class="calendar-details" aria-labelledby="calendar-selected-date"><h3 id="calendar-selected-date"></h3><div id="calendar-day-detail"></div></section></div><p id="calendar-sync-status" class="field-hint" role="status"></p><div class="dialog-actions"><button type="button" id="office-calendar-close">閉じる</button><button type="button" id="calendar-schedule-edit" disabled>予定を追加・編集</button></div></dialog>
  <dialog id="birthday-dialog" class="birthday-dialog" aria-labelledby="birthday-title"><span class="eyebrow">A LITTLE CELEBRATION FOR EVERYONE</span><h2 id="birthday-title" tabindex="-1" autofocus>みんなの誕生日</h2><p>一年に一度の、ちょっと特別な日。登録すると当日、全フロアでお祝いが表示されます。</p><form id="birthday-form"><h3>あなたの誕生日</h3><p>月日だけを登録します。生まれた年や年齢は使いません。</p><div class="birthday-date"><label for="birthday-month">月<select id="birthday-month">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}月</option>`).join('')}</select></label><label for="birthday-day">日<select id="birthday-day">${Array.from({length:31},(_,i)=>`<option value="${i+1}">${i+1}日</option>`).join('')}</select></label></div><p id="birthday-storage-help" class="field-hint"></p><p class="field-hint">JSTの0時から一日お祝いします。2月29日生まれは、うるう年以外は2月28日にお祝いします。自分の登録だけ変更・取り消しできます。</p><div class="dialog-actions"><button type="submit" id="birthday-save" disabled>登録してお祝いを受け取る</button><button type="button" id="birthday-delete" hidden>登録を取り消す</button></div><p id="birthday-form-status" role="status"></p></form><h3>みんなのバースデーカレンダー</h3><ul id="birthday-list"></ul><p id="birthday-empty">まだ登録がありません。最初のひとりになりませんか。</p><button type="button" id="birthday-close" class="dialog-close">閉じる</button></dialog>
  <dialog id="broadcast-dialog" class="announcement-dialog" aria-labelledby="broadcast-title"><span class="eyebrow">A MESSAGE FOR EVERY FLOOR</span><h2 id="broadcast-title">みんなに、ひとこと。</h2><p>全フロアのマップ上部に表示します。だれでも放送できます。</p>
    <form id="broadcast-form"><label>放送のタイトル<input name="title" maxlength="60" placeholder="例：全体会議のお知らせ" required></label><label>伝えたいこと<textarea name="message" maxlength="240" rows="3" placeholder="全体会議が始まります。作戦室に集まってください。" required></textarea></label><label>表示する時間<select name="durationMinutes">${DURATIONS.map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n}分</option>`).join('')}</select></label><p id="broadcast-form-status" role="status"></p><div class="dialog-actions"><button type="button" id="broadcast-close">閉じる</button><button type="submit">全フロアに放送</button></div></form>
  </dialog>
  <dialog id="schedule-dialog" class="schedule-dialog" aria-labelledby="schedule-title"><span class="eyebrow">MEETINGS &amp; LITTLE REMINDERS</span><h2 id="schedule-title">予定と定例の放送</h2><p>日本時間（JST）で設定します。だれでも追加・編集・停止できます。</p>
    <div class="schedule-body"><section aria-label="登録した予定"><div class="schedule-list-heading"><h3>みんなの予定</h3><button type="button" id="schedule-new">予定を追加</button></div><p id="schedule-empty">まだ予定がありません。</p><ul id="schedule-list"></ul></section>
    <form id="schedule-form"><h3 id="schedule-editor-title">新しい予定</h3><label>予定の名前<input name="title" maxlength="60" placeholder="例：毎週の全体会議" required></label><label>放送するメッセージ<textarea name="message" maxlength="240" rows="3" placeholder="全体会議が始まります。作戦室へどうぞ。" required></textarea></label><label>最初の開始日時（JST）<input name="startsAt" type="datetime-local" required></label><div class="schedule-fields"><label>繰り返し<select name="repeat">${Object.entries(REPEATS).map(([v, label]) => `<option value="${v}">${label}</option>`).join('')}</select></label><label>告知を始めるタイミング<select name="leadMinutes">${LEADS.map((n) => `<option value="${n}">${n === 0 ? '開始時刻' : `開始${n}分前`}</option>`).join('')}</select></label><label>開始後の表示時間<select name="displayMinutes">${DURATIONS.map((n) => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n}分</option>`).join('')}</select></label></div><label class="schedule-enabled"><input name="enabled" type="checkbox" checked> 自動放送を有効にする</label><p class="field-hint">告知開始から、会議開始後の表示時間まで掲示します。毎週の曜日は最初の開始日から決まります。</p><div class="dialog-actions"><button type="button" id="schedule-cancel-edit">入力をリセット</button><button type="submit" id="schedule-save">この予定を保存</button></div></form></div><p id="schedule-form-status" role="status"></p><button type="button" id="schedule-close" class="dialog-close">閉じる</button>
  </dialog>
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
  <dialog id="vehicle-dialog" class="vehicle-dialog" aria-labelledby="vehicle-title"><span class="eyebrow">SHARE A RIDE, TAKE A LITTLE TRIP</span><h2 id="vehicle-title">今日は、何に乗っていく？</h2><p id="vehicle-current"></p><p id="vehicle-location"></p><div class="vehicle-cards">${VEHICLE_KINDS.map((kind) => `<section><span class="vehicle-icon" aria-hidden="true">${VEHICLES[kind].icon}</span><h3>${VEHICLES[kind].name}</h3><p>歩く速さの${VEHICLES[kind].speed}</p><strong data-vehicle-count="${kind}">確認中…</strong><button type="button" data-vehicle-take="${kind}" disabled>${VEHICLES[kind].name}を借りる</button></section>`).join('')}</div><section class="vehicle-ground-section" aria-labelledby="vehicle-ground-title"><h3 id="vehicle-ground-title">床に置かれた乗りもの</h3><p>すぐ横まで歩くと乗れます。乗りもののマスに踏み入れると自動で乗れます。</p><ul id="vehicle-ground-list" aria-live="polite"></ul></section><p id="vehicle-return-hint"></p><p id="vehicle-status" role="status"></p><div class="dialog-actions"><button type="button" id="vehicle-drop" hidden>ここで降りる</button><button type="button" id="vehicle-return" hidden>置き場に返す</button><button type="button" id="vehicle-close">マップにもどる</button></div></dialog>
  <dialog id="buddy-dialog" class="buddy-dialog" aria-labelledby="buddy-title"><form id="buddy-form"><span class="eyebrow">A LITTLE FRIEND, A LITTLE ADVENTURE</span><h2 id="buddy-title">今日の相棒は、だれにする？</h2><p>お気に入りを見つけて、一緒にオフィスを歩こう。</p><label class="buddy-filter"><input type="checkbox" id="buddy-favorites-only"> お気に入りだけ表示</label><div id="buddy-cards"></div><p class="field-hint">選択とお気に入りは、このブラウザーに保存します。</p><div class="dialog-actions"><button type="button" id="buddy-cancel">キャンセル</button><button type="submit">このバディと歩く</button></div></form></dialog>
  <dialog id="lost-item-info" aria-labelledby="lost-item-title"><span class="eyebrow">LITTLE LOST &amp; FOUND</span><h2 id="lost-item-title"></h2><p id="lost-item-description"></p><p class="field-hint">だれかの忘れもの。それとも、オフィスの七不思議？</p><div class="dialog-actions"><button type="button" id="lost-item-close">閉じる</button></div></dialog>
  <dialog id="buddy-info" aria-labelledby="buddy-info-title"><h2 id="buddy-info-title"></h2><p id="buddy-info-owner"></p><p id="buddy-info-description"></p><p>今は一緒に歩く、小さな仲間です。</p><div class="dialog-actions"><button type="button" id="buddy-info-close">閉じる</button></div></dialog>
  <dialog id="pokemon-journal-dialog" class="pokemon-journal-dialog" aria-labelledby="pokemon-journal-title"><span class="eyebrow">LITTLE ENCOUNTERS · OFFICE COLLECTION</span><h2 id="pokemon-journal-title" tabindex="-1" autofocus>ポケモン図鑑</h2><p>オフィスで出会った、小さな仲間の記録。散歩中のポケモンも、誰かのバディも、クリックすると図鑑に追加されます。</p><p id="pokemon-journal-notice" role="status"></p><div class="pokemon-progress"><strong id="pokemon-journal-progress"></strong><progress id="pokemon-journal-meter" max="3" value="0" aria-label="発見したポケモンの種類数"></progress></div><ul id="pokemon-journal-cards" aria-label="ポケモンの発見記録"></ul><p id="pokemon-journal-storage" class="field-hint"></p><button type="button" id="pokemon-journal-close" class="dialog-close">マップにもどる</button></dialog>
  <dialog id="avatar-dialog" class="avatar-dialog" aria-labelledby="avatar-title"><form id="avatar-form"><span class="eyebrow">MAKE YOUR OWN CHARACTER</span><h2 id="avatar-title">あなたらしい姿に。</h2><div class="avatar-editor-layout"><div class="avatar-draft-backdrop"><canvas id="avatar-draft" width="48" height="48" aria-label="変更中のアバターの歩き方プレビュー"></canvas><div class="walk-preview-controls"><button type="button" id="walk-preview-toggle" aria-pressed="true">歩く動きを停止</button><button type="button" id="walk-preview-turn">向きを変える</button></div><p id="walk-preview-description"></p><p>移動速度はどの歩き方も同じです。</p><p>性別や体型にかかわらず<br>すべての服と髪型を選べます。</p></div><div id="avatar-fields"></div></div><div class="dialog-actions"><button type="button" id="avatar-cancel">キャンセル</button><button type="submit">この見た目にする</button></div></form></dialog>
  <dialog id="room-dialog" class="room-dialog" aria-labelledby="room-dialog-title"><span class="eyebrow">FIND YOUR NEXT PLACE</span><h2 id="room-dialog-title">どの部屋へ行こう？</h2><p>部屋を変えると、移動先の近くの人と音声がつながります。</p><div class="room-grid">${ROOMS.map((room, i) => `<button type="button" data-room="${room.id}" style="--card-accent:#${room.rug.toString(16)}"><span class="room-card-number">${String(i + 1).padStart(2, '0')} / ${room.icon} · ${robotLocation(room.id)}</span><strong>${room.name}</strong><span>${room.description}</span><small data-room-occupancy="${room.id}">0人</small></button>`).join('')}</div><form method="dialog"><button class="dialog-close">いまの部屋にもどる</button></form></dialog>
  <dialog id="help-dialog" aria-labelledby="help-title"><span class="eyebrow">HOW TO WALK</span><h2 id="help-title">オフィスを歩いてみよう</h2><p>マップをクリックするか、Tabキーでマップにフォーカスしてから、<strong>矢印キー / WASD</strong> を押すと移動します。</p><p>スマートフォンやタブレットでは、マップ下の方向ボタンを使えます。</p><p>リアクションのボタン、またはマップ操作中の<strong>1〜4キー</strong>で、お辞儀・ジャンプ・バンザイ・よろこぶ動作を同じ部屋の人に伝えられます。歩くと動作が終わります。</p><p>家具や小物をクリックすると、登録済みのリンクを選んで開けます。「リンクを設定」で共有のお気に入りから複数選べます。リンクのあるホワイトボードは、前に立っても一覧が開きます。</p><p>「館内放送を出す」で全フロアにテキストを届けられます。「予定・定例を設定」ではJSTの開始時刻と繰り返しを登録できます。</p><p>椅子・机・ソファの正面で止まると自動で座り、移動すると立ち上がります。カフェ・休憩室の自販機のすぐ横に行くとペットボトルを受け取れます。</p><p>オフィスの置き場で、自転車・スケボー・スケートを借りると速く移動できます。置き場に踏み入れると自動で乗り、乗って戻ると返却します。マップ操作中の<strong>Eキー</strong>で空き台数も確認できます。</p><p>床の不思議な落とし物は、クリックするとひと言読めます。「床の落とし物」からも選べます。</p><p>壁や家具のあるマスは通れません。部屋の入口を探してみてください。</p><p>「入口にもどる」で最初の場所に戻れます。Tabキーでマップの操作を抜けられます。</p><form method="dialog"><button class="dialog-close">わかった、歩いてみる</button></form></dialog>
`;

const parent = document.querySelector<HTMLElement>('#game')!;
const { game, scene } = startOffice(parent, initialSlack, authUnavailable || (!!auth.required && !auth.user));
const disposeAvatarEditor = setupAvatarEditor(scene);
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

document.querySelectorAll<HTMLDialogElement>('#avatar-dialog, #room-dialog, #object-links-dialog, #lost-item-info, #broadcast-dialog, #schedule-dialog, #event-detail-dialog, #event-journal-dialog, #office-calendar-dialog, #cockpit-dialog, #arcade-dialog').forEach((item) => item.addEventListener('close', () => game.canvas.focus({ preventScroll: true })));

if (import.meta.hot) import.meta.hot.dispose(() => { disposeAvatarEditor(); game.destroy(true); });
