# Waiwaiのチャットとアカウント

## できること

- アバター・参加者の名前をクリックしてWaiwai内DMを開く。チャット画面の人検索からはオフラインの相手にも送信できる。
- 部屋チャットは現在の部屋に限定して配信し、その部屋の履歴だけを閲覧できる。部屋移動・ワープ・コールに追従する。
- 全体チャットは全フロアで共有する。Slackへの共有は管理者が連携を有効化したうえで、送信者が「#waiwaiにも送る」を選んだメッセージに限定する。
- DM・部屋チャットはSlackへ送信しない。Slackからの指定チャンネルの通常のテキスト投稿は全体チャットに取り込む。
- 履歴は50件ずつ取得し「以前のメッセージを読む」で遡る。1投稿1,000文字までのプレーンテキスト。HTMLを実行せず、添付・スレッド・編集・削除の同期は対象外。
- 履歴と既読位置はSQLiteに保存する。DMは本人・相手の接続にだけ配信し、第三者への履歴・未読一覧にも含めない。同じアカウントの複数タブで既読を共有する。未読の会話を開き、画面が前面で最新のメッセージまで読んだときに既読にする。
- ネットワークの応答が不明なときは下書きと送信IDを保持し、再送を重複保存しない。送信は1アカウントにつき5秒間で6回まで。

## 本人の識別

メールは認証トークンから得られる任意の連絡先情報として扱い、本人識別・データへのアクセス権判定・自動アカウント統合には使わない。メールは変更される可能性があり、同じメールだけでDM履歴を他のアカウントへ移すことはしない。

- Microsoft: 検証済みの `tid`（テナント）＋`oid`（ユーザー）を `entra:<tid>:<oid>` として使用。
- Slack: 検証済みのワークスペース＋ユーザーIDを `slack:<team>:<user>` として使用。既存の誕生日・配置オブジェクトの所有者IDは維持。
- メンバー検索・DM・誕生日は同じIDを使用する。名前・メール変更でIDは変わらず、別端末・再ログインでも同じ受信箱になる。
- 同じ人がMicrosoftとSlackの両方で別々にログインした場合、現在は別の受信箱になる。メール一致による自動統合は行わない。継続利用するログイン方法を会社で統一する。
- ゲストのDMはその接続に届く。退出後も履歴は送信相手の受信箱に残るが、ゲスト自身は再接続すると別のIDになる。継続的なDM受信・誕生日の永続保存にはログインを使用する。ゲストへの送信は接続中だけ許可する。

Microsoftのトークンは署名・issuer・audience・有効期限・state・nonce・PKCEを検証し、設定した単一テナント以外を拒否する。クライアントから送られたアカウントID・メール・送信者は採用しない。アクセストークン・Client Secretをブラウザーへ渡さない。

出典: [MicrosoftのIDトークンのクレーム](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)。メールは変更可能な属性で、ユーザーの固定識別には`oid`等を使う。

## Microsoftログインの設定

1. 会社のEntraテナントでWaiwaiのアプリを登録する。サポートするアカウントはこの組織ディレクトリのみ。
2. 「認証」→Webに`https://<Waiwaiのホスト>/auth/microsoft/callback`を登録する。
3. `.env`またはVMのサーバー設定へ`ENTRA_TENANT_ID`、`ENTRA_CLIENT_ID`、`ENTRA_CLIENT_SECRET`、`ENTRA_REDIRECT_URI`を設定する。Secretはチャット・Git・Terraform stateへ入れない。
4. `REQUIRE_ENTRA_LOGIN=true`でMicrosoftログインを必須にする。この場合はSlackログインによる入室の代替を許可しない。ログイン必須を無効にした開発環境ではゲストも利用できる。
5. エンタープライズアプリでユーザーの割り当てを必須にして利用者・グループを割り当てる。必要なMFAは会社の条件付きアクセスでこのアプリに適用する。Entraライセンス・管理権限と実テナントでの設定が別途必要。

Azureの配備スクリプトはMicrosoft必須で構成し、Graphで有効な全ユーザーMFAポリシーを照合する。Slack設定は任意で、Slackのみの配備へフォールバックしない。[Azure公開手順](azure.md)を参照。AzureリソースやEntraテナントへの変更は、この実装だけでは実行しない。

## Slack連携の設定

現在のSign in with Slack用アプリにBot権限を追加できる。ログインとBotの権限許可は別のフロー。

1. SlackアプリのOAuth & PermissionsでBot Token Scopesに`chat:write`と`channels:history`を設定し、ワークスペースへインストール／再インストールする。
2. Botを連携先の`#waiwai`へ招待する。今回は公開チャンネルのみ対応する。
3. `SLACK_BOT_TOKEN`、`SLACK_SIGNING_SECRET`、`SLACK_CHAT_TEAM_ID`、`SLACK_CHAT_CHANNEL_ID`、表示用`SLACK_CHAT_CHANNEL_NAME="#waiwai"`をサーバー側に設定する。
4. Event SubscriptionsのRequest URLを`https://<Waiwaiのホスト>/api/slack/events`にし、Bot Eventの`message.channels`を登録する。
5. `SLACK_CHAT_ENABLED=true`にしてサーバーを再起動する。未設定ではボタンも外部送信も無効。

受信は生のリクエスト本文のHMAC署名と5分以内の時刻を検証し、指定ワークスペース・チャンネルの通常テキスト投稿だけを保存する。Bot投稿を無視して送受信ループを防ぎ、Slack event IDで重複を排除する。送信時はメンション記法をエスケープし、リンク展開・通知用の解析を無効化する。

外部送信はDBトランザクションで本文と送信待ちキューを同時保存する。Slack停止時もWaiwaiのチャットは利用でき、429のRetry-Afterや指数バックオフで再送する。待ち行列は再起動後も残り、UIの「送信を受け付けました」はSlackでの配信完了を意味しない。配信成功後に応答だけ失われた場合、外部側に重複する可能性がある。

IP制限を導入する際は、SlackのEvents APIがこの受信URLへ到達できる入口を別途用意する。一般利用者向けの入口全体を開放する必要はない。DM履歴・本文・Bot Tokenをログへ記録しない。

出典: [chat.postMessage](https://docs.slack.dev/reference/methods/chat.postmessage)、[Slackリクエストの署名検証](https://docs.slack.dev/authentication/verifying-requests-from-slack/)、[Events API](https://docs.slack.dev/apis/events-api/)。

## 保存とバックアップ

Node.js組み込みの`node:sqlite`を使用し、追加DBサービスは不要。Nodeは既存の要件である22.18以上を使用する。`WAIWAI_CHAT_FILE`を省略すると、オブジェクト保存ファイルと同じディレクトリの`office-chat.sqlite`へ保存する。Azureでは`/var/lib/waiwai/office-chat.sqlite`で、リリースディレクトリ・公開distの外に置く。ファイルは0600、WALモード、同期書き込みで保存する。DBファイルとWAL/SHMをGitへ追加しない。

稼働中のバックアップはSQLiteのスナップショットAPIを使う。

```sh
node scripts/chat/backup.mjs /var/lib/waiwai/office-chat.sqlite /secure-backup/chat-2026-10-18.sqlite
```

バックアップ先は新規ファイルを指定する。既存のバックアップは上書きしない。復元時はアプリを停止し、現在のDB/WAL/SHMを保全してからバックアップを元のパスへ配置し、所有者・権限を戻して起動する。本文・既読・送信待ち情報も含むため、バックアップのアクセス権と保管先も会社で管理する。

履歴は自動削除しない。保管期間・退職者のアカウント停止・履歴削除運用は会社の規定に合わせて決める。SQLiteは単一VMのディスクを前提とし、複数VMから同じファイルを共有しない。
