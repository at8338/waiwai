# 2026-10-17 検証記録

- `npm test`: 42件成功。150人の入室・151人目拒否・退出後の再入室、30人の音声枠、6組×5人の相互音声許可、密集時の最大4接続、離隔による許可失効、時限TURN資格情報、Slackワークスペース制限を含みます。
- `npm run check` / `npm run build`: 成功。Phaserを含む大きなJS chunkの既存警告は残ります。
- `terraform validate`: `infra/bootstrap` と `infra/azure` が成功。AzureRM 4.81.0。
- `terraform -chdir=infra/azure test`: Azureを呼ばないmock providerで2件成功。VMサイズ、静的IP、SSHのCIDR制限、鍵認証、cloud-initに秘密値を含めないこと、callback出力を検証。
- `load-150-macos-2026-10-17.json`: Mac arm64上、専用サーバープロセスで150クライアント全員が約6.3回/秒で継続移動する60秒試験。30人が音声状態とシグナリングを使用。56,672リクエスト、切断0、応答p95 4.66ms、最大44.93ms。サーバーRSS約126MiB、CPUは1コア換算約16％。JSON payload送信約17.39Mbps。TLS/TCPのヘッダーと実音声は含まず、通常より移動の多い条件です。
- `voice-30-browser-2026-10-17.json`: Chromium系のin-app browserで30人の本番 `ProximityVoice` / `OfficeConnection` を起動。合成音声をマイク入力へ注入し、スピーカー出力は無音へルーティング。53組＝106方向すべてでWebRTC接続・音声レベルの検出に成功。各端末最大4接続。STUN/TURNなしのローカル直接接続です。
- ブラウザー2タブ＋148 WebSocket botで150アバターの描画・移動と参加者一覧150件を確認。画面のエラーログなし。2タブ間で名前と移動座標の同期も確認。スクリーンショットはgit対象外の `artifacts/azure-150-avatars.png` と `artifacts/voice-30-pass.png`。

測定値はAzure VMの処理能力や会社回線の接続を保証するものではありません。Azure上での継続試験、実端末・異なるネットワーク・強制TURN・TURN TLS・認証資格情報更新・Safari/iOSは公開前の確認事項です。実行日時、テスト対象、条件はこの記録とJSONを併せて参照してください。

## 部屋・アバター・小物の追加後

- `npm test`: 51件成功。11部屋の通行、ロビーにデスクを置かない配置、独立した容姿設定、小物による通路封鎖の拒否、所有者だけの編集、部屋移動による音声許可失効、ファイル保存・再起動・保存失敗を追加検証。
- `npm run build` とTerraformのvalidate・mockテスト2件成功。Azureへの適用は行っていません。
- `rooms-load-150-macos-2026-10-17.json`: 150人全員が60秒間連続移動、30人が音声シグナリングを使用。56,500要求、切断0、応答p95 3.97ms、最大7.73ms。今回の試験は音声メディア自体を測定していません。
- ブラウザー2タブで小物の配置共有・移動・再起動後の復元、見た目編集と保存、部屋一覧、屋上・星空ラウンジへの移動を確認。ビルド版の画面エラーログなし。スクリーンショットはgit対象外の `artifacts/avatar-editor.png`、`artifacts/rooms-directory.png`、`artifacts/room-sky.png`。
