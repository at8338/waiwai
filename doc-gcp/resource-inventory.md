# GCPリソースと公開作業の全体一覧

この一覧は「Terraformの管理件数」と「Waiwaiの公開環境を構成する全要素」を区別します。20件はTerraformの管理エントリー数で、名前付きGCPリソースの数や課金項目数ではありません。VM内のサービス、日々生成されるバックアップ、DNSや認証の外部設定まで20件で完成するという意味ではありません。

現在はdevのIaC・事前plan確認の段階で、apply・クラウド資源作成・アプリ配備は未実施です。入力・実名・planはGit対象外の`.local/gcp/dev/`に置き、この資料には既定の命名例を記載します。

## Terraformで名前を指定するリソース：12件

既定の`project_name=waiwai`、東京、連番`001`での名前です。名前は[唯一の命名定義](../infra-gcp/modules/naming/locals.tf)から渡し、モジュール側で変更しません。

| リソース | 名前 | GCP上のスコープ・設定 |
|---|---|---|
| VPC | `dev-waiwai-tky-vpc-office-001` | Global / custom mode |
| サブネット | `dev-waiwai-tky-snet-office-001` | 東京 / 既定`10.84.1.0/24` |
| 固定外部IPv4 | `dev-waiwai-tky-ip-office-001` | 東京 / Standard tier |
| Firewall / SSH | `dev-waiwai-tky-fw-office-ssh-001` | Global / 指定CIDRのTCP 22 |
| Firewall / Web | `dev-waiwai-tky-fw-office-web-001` | Global / TCP 80・443。会社IP制限はCaddy |
| Firewall / TURN TCP | `dev-waiwai-tky-fw-office-turn-tcp-001` | Global / TCP 3478・5349 |
| Firewall / TURN UDP | `dev-waiwai-tky-fw-office-turn-udp-001` | Global / UDP 3478・49160–49959 |
| VM | `dev-waiwai-tky-vm-office-001` | `asia-northeast1-a` / 初期2 vCPU・4GiB |
| OSディスク | `dev-waiwai-tky-disk-os-001` | 同zone / 20GB pd-balanced |
| データディスク | `dev-waiwai-tky-disk-data-001` | 同zone / 32GB pd-balanced |
| Snapshotスケジュールポリシー | `dev-waiwai-tky-snap-office-001` | 東京 / 毎日UTC17時開始枠・保持7日 |
| Terraform state用GCSバケット | `dev-waiwai-tky-gcs-tfstate-001-{hash8}` | 保存場所は東京 / 非公開・版管理・soft delete |

VPC・FirewallはGlobalのリソースです。名前の`tky`は、このdev構成の利用地域を表します。GCSのhashは実project ID等から計算し、planで確定します。個々のSnapshotではなくスケジュール用ポリシーをTerraformで命名しています。

## Terraformで管理する設定・紐付け等：8件

| 管理エントリー | 件数 | 対象・内容 |
|---|---:|---|
| `google_project_service.storage` | 1 | `storage.googleapis.com`の有効化状態 |
| `google_project_service.required` | 2 | `compute.googleapis.com`・`oslogin.googleapis.com`の有効化状態 |
| `google_storage_bucket_iam_member.operators` | 1 | state運用者へ当該バケットの`roles/storage.objectAdmin` |
| `google_compute_instance_iam_member.operators` | 1 | 人間の運用者へ当該VMの`roles/compute.osAdminLogin` |
| `google_compute_disk_resource_policy_attachment.backup` | 2 | OS/dataの各ディスクへ同じSnapshotポリシーを紐付け |
| `terraform_data.bootstrap_revision` | 1 | cloud-init変更検知用。GCPリソースを作成しないTerraform内部管理 |

合計はbootstrapが3件、devが17件、合わせて20件です。IAMは各運用者1人の場合で、入力に複数人・グループを指定すると件数が増えます。既に有効なAPIも、初回planでは新しいTerraform管理エントリーとして表示され得ます。20個の新しい課金サービスを起動する意味ではありません。

## 別の名前付きTerraformリソースとして作らない構成要素

| 構成要素 | 管理・生成方法 | 命名の扱い |
|---|---|---|
| VMのNIC・内部IP | VMの`network_interface`。内部IPは既定`10.84.1.10` | 独立したNICリソースや内部IP予約は作らない |
| Firewall用network tag | VMとFirewallの属性 | `dev-waiwai-tky-office-001` |
| dataディスクのdevice名 | VMの`attached_disk`属性 | `waiwai-data`固定 |
| Shielded VM・metadata・OS Login 2FA・削除保護 | VMの属性 | 独自のリソース名なし |
| Ubuntu 24.04のOSイメージ | Google公開イメージを参照 | 独自のカスタムイメージは作成しない |
| VPCのデフォルトルート・subnet route | VPC/Subnet作成に伴うGCPのシステム生成 | Google側の識別子。独自のrouteリソースは未定義 |
| 日々のOS/data Snapshot | スケジュールポリシーから自動生成 | 元ディスク名の先頭・スコープ・時刻等を使うGoogleの自動命名 |
| GCS内のstateオブジェクト・ロック・版履歴 | backendがstate保存・ロックを行い、GCSが版等を管理 | prefixは`waiwai/gcp/dev/001`。bucket以外の独立Terraformリソースは作らない |
| bootstrapのstate | bucket作成用rootのローカルstate | devのGCS backendとは別。手元の保全・安全なバックアップが必要 |
| Google管理のサービスエージェント等 | 既存project・各サービスの管理領域 | このIaCで独自名を付けたり、既存の権限を整理したりしない |

自動生成物の数は変動するため、20件に加えた固定の「全リソース数」は定義しません。[VPCルートの仕様](https://docs.cloud.google.com/vpc/docs/routes)、[Snapshotの命名・保持仕様](https://docs.cloud.google.com/compute/docs/disks/about-snapshot-schedules)、[GCS backendの保存・ロック](https://developer.hashicorp.com/terraform/language/backend/gcs)を参照してください。

## VM内に置くサービス・データ

これらは独立したGCPサービスではなく、上記VM・ディスク内の構成です。[cloud-init](../infra-gcp/modules/office-vm/templates/cloud-init.yaml.tftpl)と[配備契約](operations.md)で管理します。

| 要素 | 配置・状態 |
|---|---|
| HTTPS / WebSocket入口 | Caddy。cloud-initでインストール・設定し、会社IP制限を適用 |
| HTTPS証明書 | DNS疎通後にCaddyのACMEで取得・更新する想定。Certificate Managerの証明書リソースは作らない |
| 音声中継 | coturn / `waiwai-turn.service`。プログラムは初期化し、共有鍵・設定は後続の配備で投入 |
| TURN TLS証明書同期 | `waiwai-turn-cert.service`・`.timer`。Caddyの証明書を同期 |
| アプリ実行基盤 | Node.js・`waiwai.service`・実行ユーザー`waiwai`。本体と環境ファイルが揃うまで開始しない |
| アプリ本体 | `/opt/waiwai/releases/<release>`・`current`。GCP用の自動配備スクリプトは未実装 |
| チャット・ユーザー個人データ等 | SQLite・JSONを`/var/lib/waiwai`へ保存。各チームの`spaces/<ID>/`も同じディスク内 |
| ログ | systemd journal / journaldのローカル保持設定。WaiwaiのアプリログをCloud Loggingへ送る設定は未実装 |
| アプリ認証Secret・TURN共有鍵 | `/etc/waiwai/app.env`・`/etc/waiwai-turn/turnserver.conf`等の権限制限ファイルに後続配備する設計。Terraformの入力・metadata・stateに保存しない |

## 公開・運用のために別途整備する対象

| 対象 | 現在の状態・残作業 |
|---|---|
| ドメイン取得 | 希望名は決まっているが未取得。登録サービス・取得作業はTerraform外 |
| DNSゾーン・Aレコード | 管理サービス未確定。VMの固定IPを向けるAレコードが必要。現IaCにはCloud DNS zone/recordを含めない |
| 正式な会社/VPN許可IP | 手元の公開IPを暫定planに使用中。正式CIDRを受領後、実行用planを再作成 |
| 利用者のSSO・MFA・招待 | アプリのMicrosoft/Slackログイン機能は実装済み。Entra側のアプリ登録・外部参加者の招待・MFA適用・新ドメインのcallback設定は別途確認・設定 |
| アプリ・音声設定の配備 | GCPのVMへの本体配備、認証Secret・TURN共有鍵の投入、既存データの停止移行が必要。Azureの配備スクリプトをそのまま使わない |
| アプリ監視・ログ集約 | プロセス停止、疎通、メモリ、filesystem容量、バックアップ失敗等の検知と通知は未実装。Ops Agent等の収集方法・認証権限も未定義 |
| 通知先 | `acme_email`入力は証明書の連絡先。監視のメール通知チャネルを作るものではない。運用メールへの監視通知設定は別途必要 |
| 予算・費用通知 | 予算額・通知ルール・請求スコープの権限を確認し、別途設定。現IaCにはBilling Budgetを含めない |
| 公開前の受入 | GCP実機での150接続・30人音声、会社回線のTURN/TLS、認証・権限制御、Snapshot/SQLite復元を確認 |

監視の収集対象・送信先・保持期間はまだ実装していません。[Ops Agent](https://docs.cloud.google.com/monitoring/agent/ops-agent)等を採用する場合は、現在サービスアカウントを付けていないVMに必要最小限の送信権限を追加する設計と、費用も含めて更新します。運用メールが決まっただけで監視・通知が完成したとは扱いません。

## 現在追加しないマネージドサービス

単一VMのdev構成では、Caddy・coturn・アプリ・SQLiteを同居させます。このためLB、MIG、GKE、Cloud Run、Cloud SQL、Memorystore、Cloud NAT/Cloud Router、Artifact Registry、Secret Manager、Certificate Manager、Cloud Armor、GCP IAP/Identity Platform、独自KMS鍵は定義していません。会社ネットワークとのCloud VPN/Interconnectも作りません。

これはそれらを構築済み・自動生成とみなすという意味ではなく、現構成で採用しないという設計判断です。例えば利用者認証は既存Entra/Slack、秘密設定はVM内の権限制限ファイル、データベースはデータディスク内のSQLiteを使います。冗長化・秘密管理・運用監視の要件が変われば対象を見直します。

既存のGCPプロジェクト、課金アカウント、default VPC、既存IAM/Google Workspace/Entraテナントは新規作成対象ではありません。会社で既に使うNew Relic等への監視連携も、部屋にダッシュボードURLを置く機能とは別の作業です。
