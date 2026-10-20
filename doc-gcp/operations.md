# GCP運用と受入

## アプリの公開前

TerraformはVMとサービス基盤までを作ります。アプリ本体、認証Secret、TURN共有鍵、DNSの登録、招待/MFA設定はTerraformに含めません。今回アプリをデプロイする処理は実行せず、GCP専用の自動デプロイスクリプトもこの変更の対象外です。Azureの`deploy.mjs`はAzure出力とGraphの検査を前提とするため、そのままGCPへ実行しません。

将来の配備で満たす契約は以下です。

- アプリの配置は`/opt/waiwai/releases/<release>`と`/opt/waiwai/current`、環境は`/etc/waiwai/app.env`。Node.jsのアプリ用ユーザーは`waiwai`。
- `HOST=127.0.0.1`・`PORT=5173`・`NODE_ENV=production`。`WAIWAI_DATA_FILE=/var/lib/waiwai/office-objects.json`と既存の各保存先を同じマウント上に設定する。追加サーバーも`/var/lib/waiwai/spaces/`に含める。
- Microsoftを採用する場合は`REQUIRE_ENTRA_LOGIN=true`と既存Entra設定、アプリ割当・招待・全利用者のMFAを確認する。Slackを含む別の公開方針を採用する場合も認証必須とMFAの適用先を改めて確定し、ゲスト公開へフォールバックしない。
- `ENTRA_REDIRECT_URI`または`SLACK_REDIRECT_URI`はTerraform出力の新しいGCPドメインで登録し、旧一時URLのCookieやセッションを引き継げる前提にしない。利用者IDが同じなら個人データは停止移行後も引き継げる。
- `TURN_SHARED_SECRET`と`/etc/waiwai-turn/turnserver.conf`は権限を制限してSSHで配備する。共有鍵を維持し、固定IPとVMのPrivate IPの対応、3478/5349、49160–49959の範囲、private/link-local/loopback/multicast等への中継禁止を設定する。
- Caddyの証明書が発行されてから`waiwai-sync-turn-cert`でcoturnへ同期し、TURN TLSの更新を確認する。
- 配備前のコード・設定とSQLiteのバックアップを保存し、異常時はコード/設定を戻す。DBを無条件に巻き戻さない。外部から`/healthz`の200と本文`ok`を確認してから切り替えを確定する。

認証必須を設定しないままサービスを起動しないこと、秘密値をcloud-init/metadataに置かないことは、後続の自動配備を実装する際にも必須です。現在の初期化にはアプリ本体・設定がないため、`ConditionPathExists`でサービスを待機させます。

## 既存データの移行

AzureとGCPを同時に書き込み可能な状態で、JSONやSQLiteを定期コピーする運用は行いません。移行時は元のオフィスを停止し、`/var/lib/waiwai`相当をWAL・追加サーバーのDBも含めて保全し、新しいdataディスクへ復元します。移行前にSQLiteのスナップショットまたは停止中の完全バックアップを取得し、復元後にintegrity_check・所有者/0600のDB権限を確認します。

Microsoft/Slackの不変ID、管理者ID、`office-spaces.json`、メンバー名簿、各サーバーのディレクトリを一緒に移行します。AzureのTerraform stateは移行対象に含めません。稼働データとTerraform stateは別物です。誕生日・チャット等の既存形式はアプリ共通です。

## 性能と音声

実GCPのVMで、合計150接続・音声30人を複数の小グループに分けて試験します。複数の論理サーバーも混在させ、少なくとも1時間、CPU・メモリ・切断・応答時間・ネットワーク送信量・データディスクを確認します。既存のローカル負荷試験だけでGCPの性能を保証しません。

会社回線・VPN・家庭回線の2地点以上で、通常のP2Pと強制TURNの実音声・音量変化・離れた時の切断を確認します。シグナリングだけの負荷試験はメディアの帯域試験ではありません。失敗時は原因を測り、4 vCPU / 8GiBへの変更、サービス上限、必要なら中継方式を検討します。機種変更でのVM停止と接続切断を予定します。

## バックアップ・復元

OS/dataの毎日Snapshotを確認します。Snapshotを作る設定だけでは、アプリ整合性や復元成功の証明になりません。元ディスクを上書きせず、Snapshotから新しいディスクを作り、同じzone内の検証VMに接続して復元試験します。SQLiteのWALを捨てずに復元し、整合性とチャット・個人設定・各サーバーの所属を確認します。

GCS backendの履歴・soft delete、bootstrapのローカルstateは別々に復旧します。stateのforce-unlockやstate pushは通常操作に含めず、他の実行がないこととバックアップを確認して行います。Snapshot・stateの保管権限や長期保存費用も会社の運用に合わせます。

## 保守と費用

VMは一台なのでOS更新・再起動・配備中に切断があります。監視の入口は`/healthz`、Compute Engineのメトリクス、`journalctl`、ディスク使用量です。アラート通知先・閾値・予算は実運用のメールと金額を受領してから設定します。

平日15時間だけ使う場合でも、固定IP・ディスク・Snapshotは停止中に残ります。自動停止やSpot VMは勝手に有効化せず、突発会議・夜間利用・切断許容を確認して導入します。GCPの予算通知は上限での自動停止を保証しません。Azureを併用したまま放置せず、切り替え後の不要資源はそれぞれのstate・所有範囲を確認して別途整理します。
