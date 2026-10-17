import './style.css';
import { startOffice } from './game/OfficeScene.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="./" aria-label="Waiwai ホーム"><span class="brand-mark" aria-hidden="true">w</span>waiwai<span class="brand-dot">.</span></a>
    <span class="tagline">ふらっと歩いて、誰かのとなりへ。</span>
    <span class="local-badge"><i></i> ローカルでおためし</span>
  </header>
  <main class="workspace">
    <aside class="sidebar" aria-label="オフィス情報とアバター設定">
      <div class="office-heading"><span class="eyebrow">YOUR LITTLE OFFICE</span><h1>ひだまり<br>オフィス<span class="sun" aria-hidden="true">✳</span></h1><p>今日も、ここから。</p></div>
      <div class="room-card"><span class="room-icon" aria-hidden="true">▦</span><div><strong>ひだまりオフィス</strong><span>1F / ひとりで探索中</span></div><span class="room-dot" aria-hidden="true"></span></div>
      <section class="profile-section" aria-labelledby="profile-heading">
        <h2 id="profile-heading" class="section-label">あなたのアバター</h2>
        <div class="profile-top"><div class="avatar-preview" aria-hidden="true"><div class="pixel-person"></div></div><div><strong id="profile-name">あなた</strong><span class="profile-presence"><i></i> オフィスにいます</span></div></div>
        <label for="display-name">なまえ</label><input id="display-name" type="text" maxlength="12" placeholder="あなた" autocomplete="off" aria-describedby="name-hint" />
        <span class="field-hint" id="name-hint">12文字まで。いつでも変更できます。</span>
        <fieldset class="color-picker"><legend>ふくの色</legend><button type="button" class="swatch green" data-outfit="0" aria-label="みどりの服" aria-pressed="true"></button><button type="button" class="swatch orange" data-outfit="1" aria-label="オレンジの服" aria-pressed="false"></button><button type="button" class="swatch blue" data-outfit="2" aria-label="あおの服" aria-pressed="false"></button></fieldset>
      </section>
      <div class="sidebar-note"><span aria-hidden="true">✦</span><p>まずは、のんびり歩いてみよう。<br>お気に入りの席が見つかるかも。</p></div>
      <div class="version">WAIWAI <span>はじまりのバージョン / 0.1</span></div>
    </aside>
    <section class="office-view" aria-labelledby="map-title">
      <div class="map-heading"><div><span class="eyebrow">LET’S TAKE A LITTLE WALK</span><h2 id="map-title">小さなオフィスへ、ようこそ。</h2></div><button type="button" class="help-button" id="help-button" aria-label="操作方法を表示">?</button></div>
      <div class="game-frame">
        <div class="game-topline"><span><i></i> <span data-current-area>エントランス</span></span><span>ひだまりオフィス <b>1F</b></span></div>
        <div class="map-surround"><div id="game" aria-describedby="map-instructions"><p class="loading">オフィスを準備しています…</p></div></div>
        <div class="game-bottomline"><span class="location"><span aria-hidden="true">⌖</span> <span data-current-area>エントランス</span></span><span>歩いて、お気に入りの場所へ。</span></div>
      </div>
      <div class="under-map"><p id="map-instructions"><span class="keycaps"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span><span>または <strong>W A S D</strong> で移動 <span class="instruction-extra">· マップをクリックして操作</span></span></p><button type="button" class="reset-button" id="reset-position"><span aria-hidden="true">↩</span> 入口にもどる</button></div>
      <div class="touch-controls" aria-label="移動ボタン"><button type="button" data-direction="up" aria-label="上へ移動">↑</button><button type="button" data-direction="left" aria-label="左へ移動">←</button><span aria-hidden="true">✦</span><button type="button" data-direction="right" aria-label="右へ移動">→</button><button type="button" data-direction="down" aria-label="下へ移動">↓</button></div>
      <div class="map-legend"><span><i class="legend-work"></i>ワークエリア</span><span><i class="legend-meet"></i>ミーティングルーム</span><span><i class="legend-lounge"></i>ラウンジ</span><span class="scope-note">このバージョンは移動のみ。同期・音声・Slack連携はこれから。</span></div>
    </section>
  </main>
  <footer class="page-footer"><span>離れていても、おなじ場所に。</span><span>MADE FOR LITTLE ENCOUNTERS <span aria-hidden="true">✦</span></span></footer>
  <dialog id="help-dialog" aria-labelledby="help-title"><span class="eyebrow">HOW TO WALK</span><h2 id="help-title">オフィスを歩いてみよう</h2><p>マップをクリックするか、Tabキーでマップにフォーカスしてから、<strong>矢印キー / WASD</strong> を押すと移動します。</p><p>スマートフォンやタブレットでは、マップ下の方向ボタンを使えます。</p><p>壁や家具のあるマスは通れません。部屋の入口を探してみてください。</p><p>「入口にもどる」で最初の場所に戻れます。Tabキーでマップの操作を抜けられます。</p><form method="dialog"><button class="dialog-close">わかった、歩いてみる</button></form></dialog>
`;

const parent = document.querySelector<HTMLElement>('#game')!;
const { game, scene } = startOffice(parent);

document.querySelector<HTMLInputElement>('#display-name')!.addEventListener('input', (event) => {
  const name = (event.target as HTMLInputElement).value;
  scene.setName(name);
  document.querySelector('#profile-name')!.textContent = name.trim() || 'あなた';
});

document.querySelectorAll<HTMLButtonElement>('[data-outfit]').forEach((button) => {
  button.addEventListener('click', () => {
    const color = Number(button.dataset.outfit);
    scene.setOutfit(color);
    document.querySelectorAll('[data-outfit]').forEach((swatch) => swatch.setAttribute('aria-pressed', String(swatch === button)));
    const colors = ['#668d77', '#c17b5e', '#698aab'];
    document.querySelector<HTMLElement>('.pixel-person')!.style.setProperty('--shirt', colors[color]);
  });
});

const dialog = document.querySelector<HTMLDialogElement>('#help-dialog')!;
document.querySelector('#help-button')!.addEventListener('click', () => dialog.showModal());
dialog.addEventListener('close', () => game.canvas.focus({ preventScroll: true }));

if (import.meta.hot) import.meta.hot.dispose(() => game.destroy(true));
