# GCPリソースと公開作業の全体一覧

この一覧は「Terraformの管理件数」と「Waiwaiの公開環境を構成する全要素」を区別します。35件はTerraformの管理エントリー数で、名前付きGCPリソースの数や課金項目数ではありません。VM内のサービス、日々生成されるバックアップ、DNSや認証の外部設定まで35件で完成するという意味ではありません。

2026-10-20にドメイン登録・メール確認と、3つのrootのTerraform applyを完了しました。Identity Platform・IAMを含むdev基盤とstate用GCSは構築済みで、同日に配布用GCSを追加してアプリとTURNを配備し、管理者1名を招待しました。本人の初回設定と公開前の受入は未実施です。入力・実名・planはGit対象外の`.local/gcp/dev/`に置き、この資料には既定の命名例を記載します。

## Terraformで名前を指定するリソース：17件

既定の`project_name=waiwai`、東京、連番`001`での名前です。独自名を付ける16件は[唯一の命名定義](../infra-gcp/modules/naming/locals.tf)から渡します。残るDNS Aレコード名はdomain入力から作るFQDNで、基本ルールの例外です。

| リソース | 名前 | GCP上のスコープ・設定 |
|---|---|---|
| VPC | `dev-waiwai-tky-vpc-office-001` | Global / custom mode |
| サブネット | `dev-waiwai-tky-snet-office-001` | 東京 / 既定`10.84.1.0/24` |
| 固定外部IPv4 | `dev-waiwai-tky-ip-office-001` | 東京 / Standard tier |
| Firewall / SSH | `dev-waiwai-tky-fw-office-ssh-001` | Global / 指定CIDRのTCP 22 |
| Firewall / Web | `dev-waiwai-tky-fw-office-web-001` | Global / TCP 80・443。会社IP制限はCaddy |
| Firewall / TURN TCP | `dev-waiwai-tky-fw-office-turn-tcp-001` | Global / TCP 3478・5349 |
| Firewall / TURN UDP | `dev-waiwai-tky-fw-office-turn-udp-001` | Global / UDP 3478・49160–49959 |
| Cloud DNS公開ゾーン | `dev-waiwai-tky-dns-office-001` | Global / DNSSEC有効 |
| DNS Aレコード | `waiwai-dev.example.com.`（実際はdomain入力） | 公開ゾーン内 / 予約IPv4へ連動 |
| VM | `dev-waiwai-tky-vm-office-001` | `asia-northeast1-a` / 初期2 vCPU・4GiB |
| OSディスク | `dev-waiwai-tky-disk-os-001` | 同zone / 20GB pd-balanced |
| データディスク | `dev-waiwai-tky-disk-data-001` | 同zone / 32GB pd-balanced |
| Snapshotスケジュールポリシー | `dev-waiwai-tky-snap-office-001` | 東京 / 毎日UTC17時開始枠・保持7日 |
| 認証読取用サービスアカウント | `dev-waiwai-tky-sa-id-001` | project内 / ユーザー1件の読取と配布バケット内の限定読取、鍵は作らない |
| 認証読取カスタムロール | `dev_waiwai_tky_role_id_001` | project内 / `firebaseauth.users.get`のみ。区切り文字はAPI制約による例外 |
| 配布用GCSバケット | `dev-waiwai-tky-gcs-release-001-{hash8}` | 非公開・公開禁止、配布物は7日後削除・soft delete 7日。stateとは別 |
| Terraform state用GCSバケット | `dev-waiwai-tky-gcs-tfstate-001-{hash8}` | 保存場所は東京 / 非公開・版管理・soft delete |

VPC・FirewallはGlobalのリソースです。名前の`tky`は、このdev構成の利用地域を表します。GCSのhashは実project ID等から計算し、planで確定します。個々のSnapshotではなくスケジュール用ポリシーをTerraformで命名しています。

## Terraformで管理する設定・紐付け等：18件

| 管理エントリー | 件数 | 対象・内容 |
|---|---:|---|
| `google_project_service.storage` | 1 | `storage.googleapis.com`の有効化状態 |
| bootstrapの`google_project_service.resource_manager`・`service_usage` | 2 | dev Providerのquota projectを明示する前に、`cloudresourcemanager.googleapis.com`・`serviceusage.googleapis.com`を有効化 |
| devの`google_project_service.required` | 5 | `compute.googleapis.com`・`oslogin.googleapis.com`・`identitytoolkit.googleapis.com`・`securetoken.googleapis.com`・`iam.googleapis.com` |
| bootstrap-dnsの`google_project_service.required` | 2 | `dns.googleapis.com`・`domains.googleapis.com`の有効化状態 |
| `google_storage_bucket_iam_member.operators` | 1 | state運用者へ当該バケットの`roles/storage.objectAdmin` |
| `google_compute_instance_iam_member.operators` | 1 | 人間の運用者へ当該VMの`roles/compute.osAdminLogin` |
| `google_compute_disk_resource_policy_attachment.backup` | 2 | OS/dataの各ディスクへ同じSnapshotポリシーを紐付け |
| `google_identity_platform_config.office` | 1 | project singleton / 招待制、メール・パスワード、TOTP、削除保護 |
| `google_storage_bucket_iam_member.release_reader` | 1 | VMへ配布バケットの`releases/`オブジェクトだけ読取を許可。書込・state読取は許可しない |
| `google_project_iam_member.identity_reader` | 1 | 専用サービスアカウントへのユーザー読取カスタムロール付与 |
| `terraform_data.bootstrap_revision` | 1 | cloud-init変更検知用。GCPリソースを作成しないTerraform内部管理 |

合計はbootstrapが5件、bootstrap-dnsが3件、devが27件で35件です。devのDNSゾーンdata sourceは読み取りなのでこの数に含めません。IAMは各運用者1人の場合で、入力に複数人・グループを指定すると件数が増えます。既に有効なAPIも、初回planでは新しいTerraform管理エントリーとして表示され得ます。35個の新しい課金サービスを起動する意味ではありません。

## Cloud Domainsの登録：Terraform外で1件

Cloud Domainsのドメイン登録リソース1件をCLIで登録済みです。登録IDは実ドメインで、登録者情報はローカルの権限制限ファイルから渡します。年額は実照会で確認し、会社名・住所・電話をTerraform stateへ保存しません。Terraformの35件には含めません。[取得手順](domain-registration.md)を参照してください。

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
| DNSのNS/SOA・DNSSEC鍵 | 公開ゾーン作成時にCloud DNSが生成 | DNSサービス側の識別子。devのAレコードとは別 |
| Google管理のサービスエージェント等 | 既存project・各サービスの管理領域 | このIaCで独自名を付けたり、既存の権限を整理したりしない |

自動生成物の数は変動するため、35件に加えた固定の「全リソース数」は定義しません。[VPCルートの仕様](https://docs.cloud.google.com/vpc/docs/routes)、[Snapshotの命名・保持仕様](https://docs.cloud.google.com/compute/docs/disks/about-snapshot-schedules)、[GCS backendの保存・ロック](https://developer.hashicorp.com/terraform/language/backend/gcs)を参照してください。

## VM内に置くサービス・データ

これらは独立したGCPサービスではなく、上記VM・ディスク内の構成です。[cloud-init](../infra-gcp/modules/office-vm/templates/cloud-init.yaml.tftpl)と[配備契約](operations.md)で管理します。

| 要素 | 配置・状態 |
|---|---|
| HTTPS / WebSocket入口 | Caddy。cloud-initでインストール・設定し、会社IP制限を適用 |
| HTTPS証明書 | CaddyのACMEで取得済みで、公開URLのTLS検証も成功。更新はCaddyで管理。Certificate Managerの証明書リソースは作らない |
| 音声中継 | coturn / `waiwai-turn.service`。共有鍵・設定・証明書を投入して起動済み。TLSと無認証の中継拒否を確認 |
| TURN TLS証明書同期 | `waiwai-turn-cert.service`・`.timer`。Caddyの証明書を同期 |
| アプリ実行基盤 | Node.js・`waiwai.service`・実行ユーザー`waiwai`。本体と環境ファイルを配置し起動済み |
| アプリ本体 | `/opt/waiwai/releases/<release>`・`current`。GCP用の配備スクリプトと外部HTTPS確認後の切替・自動rollbackを実装 |
| チャット・ユーザー個人データ等 | SQLite・JSONを`/var/lib/waiwai`へ保存。各チームの`spaces/<ID>/`も同じディスク内 |
| ログ | systemd journal / journaldのローカル保持設定。WaiwaiのアプリログをCloud Loggingへ送る設定は未実装 |
| アプリ認証Secret・TURN共有鍵 | `/etc/waiwai/app.env`・`/etc/waiwai-turn/turnserver.conf`等の権限制限ファイルに配備済み。Terraformの入力・metadata・stateに保存しない |

## 公開・運用のために別途整備する対象

| 対象 | 現在の状態・残作業 |
|---|---|
| ドメイン取得 | Cloud Domainsで.comを年12 USDで取得済み。登録者メール確認・DNSSEC・自動更新も確認済み。CLIで別管理 |
| DNSゾーン・Aレコード | Cloud DNSのzoneをbootstrap-dns、Aレコードをdevへ定義済み。zoneとdomainの一致を検証する。zone・Aレコードとも作成済みで、公開DNSとDNSSEC DSを確認済み |
| 許可IP | ユーザー指定のdigda dev Web許可CIDR 21件を実入力へ反映。SSHはCodeKBで参照した管理端末の1件。参照元・時点はGit対象外で記録。実際のGCS backendで再planした内容をapply済み |
| 利用者のSSO・MFA・招待 | GCP用Identity Platformのメール・パスワード/TOTP、招待スクリプト、取消・失効・旧ID紐付けを実装済み。Identity Platformの設定と読取専用IAMはapply・実設定照合済み。管理者1名を招待し、固定UIDをアプリへ反映済み。実ユーザーでのメール配送・MFA・入室の受入は未実施。[認証手順](identity-platform.md)参照 |
| アプリ・音声設定の配備 | GCP専用経路で本体・認証設定・TURN共有鍵を配備済み。既存ローカル/Azureデータの停止移行は未実施。Azureの配備スクリプトは実行しない |
| アプリ監視・ログ集約 | プロセス停止、疎通、メモリ、filesystem容量、バックアップ失敗等の検知と通知は未実装。Ops Agent等の収集方法・認証権限も未定義 |
| 通知先 | `acme_email`入力は証明書の連絡先。監視のメール通知チャネルを作るものではない。運用メールへの監視通知設定は別途必要 |
| 予算・費用通知 | 予算額・通知ルール・請求スコープの権限を確認し、別途設定。現IaCにはBilling Budgetを含めない |
| 公開前の受入 | GCP実機での150接続・30人音声、会社回線のTURN/TLS、認証・権限制御、Snapshot/SQLite復元を確認 |

監視の収集対象・送信先・保持期間はまだ実装していません。[Ops Agent](https://docs.cloud.google.com/monitoring/agent/ops-agent)等を採用する場合は、認証読取専用のVMサービスアカウントに必要最小限の監視送信権限を追加する設計と、費用も含めて更新します。運用メールが決まっただけで監視・通知が完成したとは扱いません。

## 現在追加しないマネージドサービス

単一VMのdev構成では、Caddy・coturn・アプリ・SQLiteを同居させます。このためLB、MIG、GKE、Cloud Run、Cloud SQL、Memorystore、Cloud NAT/Cloud Router、Artifact Registry、Secret Manager、Certificate Manager、Cloud Armor、GCP IAP、独自KMS鍵は定義していません。会社ネットワークとのCloud VPN/Interconnectも作りません。

これはそれらを構築済み・自動生成とみなすという意味ではなく、現構成で採用しないという設計判断です。例えば利用者認証はIdentity Platform、秘密設定はVM内の権限制限ファイル、データベースはデータディスク内のSQLiteを使います。冗長化・秘密管理・運用監視の要件が変われば対象を見直します。

既存のGCPプロジェクト、課金アカウント、default VPC、既存IAM/Google Workspace/Entraテナントは新規作成対象ではありません。会社で既に使うNew Relic等への監視連携も、部屋にダッシュボードURLを置く機能とは別の作業です。
