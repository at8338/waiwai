# GCP運用と受入

## アプリの公開前

TerraformはVMとサービス基盤までを作ります。アプリ本体、認証設定、TURN共有鍵、ドメインの購入・登録者情報、招待/MFA設定はTerraformに含めません。Cloud DNSのzoneとAレコードはTerraformで管理します。GCP専用の`scripts/gcp/deploy.mjs`が、実際のGCP出力・操作者・管理者の固定UIDを照合して配備します。Azureの`deploy.mjs`はAzure出力とGraphの検査を前提とするため、GCPへは実行しません。

Terraform管理対象以外の自動生成物・VM内サービス・外部設定を含む[全体一覧](resource-inventory.md)で、完了している基盤定義と公開・運用に残る作業を確認します。

配備で満たす契約は以下です。

- アプリの配置は`/opt/waiwai/releases/<release>`と`/opt/waiwai/current`、環境は`/etc/waiwai/app.env`。Node.jsのアプリ用ユーザーは`waiwai`。
- `HOST=127.0.0.1`・`PORT=5173`・`NODE_ENV=production`。`WAIWAI_DATA_FILE=/var/lib/waiwai/office-objects.json`と既存の各保存先を同じマウント上に設定する。追加サーバーも`/var/lib/waiwai/spaces/`に含める。
- GCPでは`REQUIRE_IDENTITY_PLATFORM_LOGIN=true`とGCIPのproject/API key/originを設定する。招待・メール確認・TOTP必須、管理者の固定UID、旧IDとの対応を[認証手順](identity-platform.md)に従って確認する。ゲストやSlack/Entraによる迂回を許可しない。
- `ENTRA_REDIRECT_URI`または`SLACK_REDIRECT_URI`はTerraform出力の新しいGCPドメインで登録し、旧一時URLのCookieやセッションを引き継げる前提にしない。利用者IDが同じなら個人データは停止移行後も引き継げる。
- `TURN_SHARED_SECRET`と`/etc/waiwai-turn/turnserver.conf`は権限を制限した非公開配布物からVMへ配備する。共有鍵を維持し、固定IPとVMのPrivate IPの対応、3478/5349、49160–49959の範囲、private/link-local/loopback/multicast等への中継禁止を設定する。
- Caddyの証明書が発行されてから`waiwai-sync-turn-cert`でcoturnへ同期し、TURN TLSの更新を確認する。
- 配備前のコード・設定とSQLiteのバックアップを保存し、異常時はコード/設定を戻す。DBを無条件に巻き戻さない。外部から`/healthz`の200と本文`ok`を確認してから切り替えを確定する。

認証必須を設定しないままサービスを起動しないこと、秘密値をcloud-init/metadataに置かないことは、後続の自動配備を実装する際にも必須です。初期化直後は本体・設定がないため、`ConditionPathExists`でサービスを待機させます。配備時に両方を揃えて開始します。

## GCPへの配備方法

本番ビルドと検証を行った後、管理者が作成した招待結果ファイルを指定します。招待ファイルとローカルのTURN共有鍵は0600で保存し、開発用`.env`は読み込みません。同じMacからの再配備では共有鍵を維持します。別端末へ移す場合は承認済みの安全な経路で`.local/gcp/dev/turn-secret`も引き継ぎ、意図せず鍵を変更しません。

```bash
npm run build
node --test scripts/gcp/deployment-config.test.mjs
node scripts/gcp/deploy.mjs \
  --project YOUR_PROJECT_ID \
  --account OPERATOR_EMAIL \
  --invitation .local/gcp/dev/admin-invitation.json
```

配布用GCSはstateとは別の非公開バケットで、公開アクセスを禁止します。VMのサービスアカウントには当該バケットの`releases/`オブジェクトだけの読取権限を付け、書込やstate読取は付けません。アプリ・環境ファイル・TURN設定をまとめた配布物のSHA-256を確認してから展開します。配布物は7日で削除、soft deleteは7日です。利用者データや招待リンクは配布物へ含めません。

Compute Engineの一時的なstartup-script metadataには、ダウンロード処理とバケット名・オブジェクト名・SHA-256・release IDだけを渡します。パスワード、API key、TURN共有鍵、招待リンクはmetadataへ入れません。VMを再起動してゲストエージェントで起動します。OS Login・2FA・会社IP制限を変更しません。今回の操作者にはOS Loginの組織外ユーザー権限が不足していたため、この配備方法を使用します。SSH管理が必要な場合は組織管理者が`roles/compute.osLoginExternalUser`の要否・付与範囲を確認します。

VM上で独立データディスクのマウント、依存パッケージ、アプリとTURNの起動を確認します。操作端末が公開HTTPSのhealth、認証必須、正しいIdentity Platform project、ゲスト入室拒否と旧ログイン拒否を確認し、同じrelease IDをmetadataで承認して確定します。確認できなければVM側でコード・設定を戻すタイマーが動きます。データベースを無条件に戻す処理はありません。終了時に一時metadataを削除し、最後に通常のTerraform planで差分を確認します。

配備結果はGit対象外の`.local/gcp/dev/deployment-status.json`とリリース別のディレクトリへ記録します。新しい配備経路でも、実ユーザーのTOTP・音声・負荷・復元の受入を省略しません。[Compute Engineの起動スクリプト](https://docs.cloud.google.com/compute/docs/instances/startup-scripts/linux?hl=ja)を参照してください。

## 既存データの移行

AzureとGCPを同時に書き込み可能な状態で、JSONやSQLiteを定期コピーする運用は行いません。移行時は元のオフィスを停止し、`/var/lib/waiwai`相当をWAL・追加サーバーのDBも含めて保全し、新しいdataディスクへ復元します。移行前にSQLiteのスナップショットまたは停止中の完全バックアップを取得し、復元後にintegrity_check・所有者/0600のDB権限を確認します。

Identity PlatformのUIDと旧Microsoft/Slackの不変IDの対応ファイル、管理者ID、`office-spaces.json`、メンバー名簿、各サーバーのディレクトリを一緒に移行します。AzureのTerraform stateは移行対象に含めません。稼働データとTerraform stateは別物です。誕生日・チャット等の既存形式はアプリ共通です。

## 性能と音声

実GCPのVMで、合計150接続・音声30人を複数の小グループに分けて試験します。複数の論理サーバーも混在させ、少なくとも1時間、CPU・メモリ・切断・応答時間・ネットワーク送信量・データディスクを確認します。既存のローカル負荷試験だけでGCPの性能を保証しません。

会社回線・VPN・家庭回線の2地点以上で、通常のP2Pと強制TURNの実音声・音量変化・離れた時の切断を確認します。シグナリングだけの負荷試験はメディアの帯域試験ではありません。失敗時は原因を測り、4 vCPU / 8GiBへの変更、サービス上限、必要なら中継方式を検討します。機種変更でのVM停止と接続切断を予定します。

## バックアップ・復元

OS/dataの毎日Snapshotを確認します。Snapshotを作る設定だけでは、アプリ整合性や復元成功の証明になりません。元ディスクを上書きせず、Snapshotから新しいディスクを作り、同じzone内の検証VMに接続して復元試験します。SQLiteのWALを捨てずに復元し、整合性とチャット・個人設定・各サーバーの所属を確認します。

GCS backendの履歴・soft delete、bootstrapのローカルstateは別々に復旧します。stateのforce-unlockやstate pushは通常操作に含めず、他の実行がないこととバックアップを確認して行います。Snapshot・stateの保管権限や長期保存費用も会社の運用に合わせます。

## 保守と費用

VMは一台なのでOS更新・再起動・配備中に切断があります。確認の入口は`/healthz`、Compute Engineのメトリクス、`journalctl`、ディスク使用量です。これらを利用した監視・ログ集約・アラート通知・予算ルールは未実装です。運用メールが入力済みでも、通知チャネルはまだありません。監視方式・閾値・保持期間・予算額を決めて別途設定します。

平日15時間だけ使う場合でも、固定IP・ディスク・Snapshotは停止中に残ります。自動停止やSpot VMは勝手に有効化せず、突発会議・夜間利用・切断許容を確認して導入します。GCPの予算通知は上限での自動停止を保証しません。Azureを併用したまま放置せず、切り替え後の不要資源はそれぞれのstate・所有範囲を確認して別途整理します。
