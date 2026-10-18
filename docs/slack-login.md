# Slackログイン

「Sign in with Slack」でログインすると、Slackの名前・ワークスペースID・メンバーIDが自動設定されます。設定したプロフィールで入室し、相手のアバターから既存のSlack DM機能を使えます。ゲスト参加と手動ID設定も引き続き利用できます。

## Slackアプリを用意する

1. [Slackアプリ管理](https://api.slack.com/apps)でWaiwai用アプリを作成し、利用するワークスペースを選びます。今回利用予定のワークスペースは `cbsmapps.slack.com` です。チャンネルURLはClient IDやワークスペースIDの代わりにはなりません。
2. **Basic Information → App Credentials** のClient ID・Client Secretを確認します。
3. **OAuth & Permissions → Redirect URLs** に `https://<Waiwaiのホスト>/auth/slack/callback` を登録します。実際に使用するHTTPSホストを指定してください。
4. **User Token Scopes** でSign in with Slack用の `openid`・`profile`・`email` を設定します。`email` は管理者本人の初期確認に使います。チャンネル・メッセージ読み取り／送信権限は要求しません。既存の利用者は、追加後にログアウトして再ログインしてください。

[Slack公式のSign in with Slack手順](https://docs.slack.dev/authentication/sign-in-with-slack/)に準拠しています。アプリの公開範囲・ワークスペース側のアプリ承認設定によって、管理者の設定が必要になる場合があります。

## Waiwaiを設定する

リポジトリ内で `.env.example` を `.env` にコピーし、次を設定します。Client Secretをチャット・フロントエンド・Gitに含めないでください。

```dotenv
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
SLACK_REDIRECT_URI=https://your-waiwai-host/auth/slack/callback
```

開発サーバーはViteの環境変数読み込み、本番サーバーはNode.jsの `.env` 読み込みを使います。起動時の環境変数も利用できます。`VITE_` 接頭辞は付けません。3項目はすべて設定するか、すべて空にします。不完全な設定・HTTPの戻り先・異なるコールバックパスは起動時に拒否します。

```bash
npm ci
npm run dev
# 本番用ビルドで試す場合
npm run build
npm start
```

ローカルで実Slackを試す場合も、既存のHTTPSリバースプロキシや開発用トンネル経由のURLを登録し、そのURLからWaiwaiを開きます。画面、`/auth/*`、`/api/auth/session`、`/office` のWebSocketを同じホストへ転送し、元のHostヘッダーを維持してください。Viteでは設定した戻り先のホストだけを追加許可します。HTTPの `127.0.0.1` はゲスト検証に引き続き使用できます。

## 動作

- 画面上部の「Sign in with Slack」からログインし、`cbsmapps` など対象ワークスペースを選びます。ログインをキャンセルしたり認証が失敗した場合もゲストとして画面に戻り、再試行できます。
- 名前とSlack IDを自動設定します。名前は既存の12文字上限で表示します。ログイン中の名前・IDは読み取り専用で、服の色は変更できます。
- 名前・IDをサーバーのセッションからWebSocket参加者に適用します。ブラウザーから違う値を送っても、ログイン済みの名前・IDは変更できません。
- 一覧は「Slackログイン済み」「Slack手動設定」「Slack未設定」を区別します。ゲストの手動IDでは本人確認をしません。
- セッションは8時間で期限切れとなり、再ログインが必要です。再読み込み・同じブラウザーの別タブでも保持します。ログアウトと期限切れは同じセッションの接続を終了し、画面をゲストに戻します。Slack自体のログイン状態は変更しません。
- セッションは1プロセスのメモリー内に保持します。サーバー再起動時は再ログインが必要です。複数サーバー・永続セッション・Slack側の失効通知は未実装です。`REQUIRE_SLACK_LOGIN=true` で入室にログインを必須化でき、`SLACK_TEAM_ID` で許可ワークスペースを限定できます。Azure構成では両方を有効にしています。ローカルの既定設定ではゲストも入室できます。

## 認証処理

`openid-client` を使用し、Slackの固定エンドポイントへ認証要求・コード交換・署名鍵取得を行います。認証要求は `openid profile email`、`response_type=code`、`response_mode=form_post` です。state・nonce・PKCEを毎回生成し、RS256署名、issuer、audience、期限、nonce、Slack IDとsubjectの整合性を検証します。メールは署名済みIDトークンの `email_verified=true` の場合だけセッションに保持します。管理者の固定方法は [管理者モード](admin-mode.md) を参照してください。

ログイン開始から10分以内・1回限りのトランザクションを、HttpOnly / Secure / SameSite=None Cookieでブラウザーに紐づけます。これはSlackからのクロスサイトPOSTコールバックで使用します。ログイン成功後のランダムなセッションCookieはHttpOnly / Secure / SameSite=Laxで、Domainを指定しません。ログアウトは同一OriginのPOSTだけを受け付けます。

アクセストークン・IDトークンは検証後に破棄し、ブラウザーへ返さず、保存もしません。セッションには表示名とSlack IDだけを保持し、認証レスポンスや秘密情報をログへ出しません。

## 確認した範囲

- 全37テスト、TypeScriptチェック、本番ビルドが成功。
- 署名付きの模擬Slack応答を使い、正常ログイン、state・nonce・署名・issuer・audience・期限の不一致、コールバック再利用、拒否、トークン交換エラー、Cookie属性、ゲストの偽装拒否、プロフィール確定、全タブのログアウト、セッション期限切れを検証。
- 一時的なローカル模擬認証サーバーを使い、ブラウザーで名前・IDの自動入力と読み取り専用表示、再読み込み・別タブの保持、服変更、ログアウトで両タブがゲストへ戻る動作を確認。模擬認証のルートや鍵は本体には含めていません。
- SlackアプリのClient ID・Client Secret・HTTPSの戻り先URLは未提供のため、`cbsmapps` の実アカウントでのログインとDM開封は未確認です。設定後、2人でログインし、アバター名・ID・実DMの宛先を確認してください。
