# MacセットアップとGCP dev構築手順

この手順には将来の構築用コマンドも含みます。ドメイン取得・登録者メール確認とDNS bootstrapのapplyは完了しています。VM・state用GCS・アプリ公開用Aレコードは未作成です。以後のapplyはユーザーの指示で保留しており、この手順の記載だけでは実行しません。

## Macのツール

Apple Silicon Macではリポジトリ直下で実行します。

```bash
bash scripts/gcp/setup-mac.sh
```

Google公式のアーカイブを公表SHA-256と内部VERSIONの両方で確認し、`~/.local/share/google-cloud-cli/589.0.0`へ展開します。`~/.local/bin/gcloud`は対応するPythonを指定するラッパーです。Homebrewやsudoは不要で、OS付属Pythonや既存Azure CLIを置き換えません。Pythonは既存miseの3.14.8を使用し、Terraformが未導入なら1.15.8を用意します。既存gcloudがある場合は上書きしません。匿名利用統計は無効です。[Google公式インストール手順](https://docs.cloud.google.com/sdk/docs/install-sdk)を参照してください。

このMacで確認した導入版はGoogle Cloud CLI 589.0.0、Terraform 1.15.8、Node.js 24.18.0です。Google CLIのアーカイブのURLにはlatest形式を使用していますが、固定ハッシュ・内部バージョンの一致前にインストールを実行しません。将来の更新ではバージョン・公表ハッシュを一緒に見直します。

```bash
gcloud version
terraform version
node --version
```

## CLIとTerraformの本人ログイン

ブラウザのConsoleログイン、CLI認証、Terraformが使うADCは別です。ブラウザにログインしただけではCLI/ADCの認証は済みません。

```bash
gcloud config configurations list
# waiwai-devがまだない場合だけ作成。普段のactive設定は変更しない。
gcloud config configurations create waiwai-dev --no-activate
gcloud auth login --configuration=waiwai-dev
gcloud config set project YOUR_PROJECT_ID --configuration=waiwai-dev
gcloud projects describe YOUR_PROJECT_ID --configuration=waiwai-dev
gcloud billing projects describe YOUR_PROJECT_ID --configuration=waiwai-dev
```

Terraform用に、既存ADCの有無と他アプリへの影響を確認してから本人認証します。認証コードをチャットやリポジトリへ貼らず、ブラウザのローカルコールバックで完了します。Googleの許可画面で必要なGoogle Cloudアクセス権を未承認にすると、CLI認証が成功していてもADCは失敗します。

```bash
gcloud auth application-default login --configuration=waiwai-dev \
  --scopes=openid,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/cloud-platform
gcloud auth application-default set-quota-project YOUR_PROJECT_ID --configuration=waiwai-dev
```

ADCはユーザーのローカル認証領域に保存し、Terraformのbackend.hclやtfvarsに鍵JSONを指定しません。CLIの専用設定とは違いADCは他アプリも参照し得るため、既存認証を不用意に上書きしません。今回は既存ADCがないことを確認してから設定しています。

## プロジェクトと権限

課金が有効な既存プロジェクトを会社で選びます。CLIの選択はローカル設定だけで、project作成やbilling付け替えは行いません。既存sandboxにも他のリソースがあり得るため、default networkやdefault service accountの権限を変更しない構成です。

実行者には、構築時にComputeネットワーク・VM・ディスク・Resource Policyを管理する権限、VMのIAM設定権限、APIを有効化するService Usage権限が必要です。bootstrapにはGCSバケットとそのIAMの管理権限も必要です。Ownerを新しく付与する処理は含めません。運用者のSSH権限は当該VMだけの`compute.osAdminLogin`で、OS Loginの2段階認証を事前に設定します。

## 入力の準備

必要なものはproject ID、所有する公開ドメイン、会社/VPNの公開IPv4/CIDR、SSH管理端末の公開IPv4/CIDR、OS Login用の会社Googleアカウント、運用メールです。SSH公開鍵をTerraformへ入れるAzure方式とは異なり、GCPではOS Loginで管理します。

```bash
mkdir -p .local/gcp/dev
cp infra-gcp/bootstrap/terraform.tfvars.example .local/gcp/dev/bootstrap.tfvars
cp infra-gcp/environments/dev/terraform.tfvars.example .local/gcp/dev/terraform.tfvars
```

コピー先を実際の値に編集します。`project_id`・`project_name`・`region`・`instance_number`は両rootで一致させます。CIDRやドメインのexample値はそのまま構築に使えません。運用者は`user:...`／`group:...`、state運用者は承認済みの`user:`／`group:`／`serviceAccount:`で指定します。アプリのClient Secret・TURN共有鍵は入力しません。

2026-10-20の指示により、実入力の`admin_cidrs`と`web_allowed_cidrs`はCodeKBの`infra/environments/dev/terraform.tfvars`にある`allowed_cidrs`と同じ集合に揃えました。参照時点では自宅回線の動的IPv4が1件で、会社全体のVPN範囲ではありません。実値と参照元・取得時点はGit対象外の`.local/gcp/dev/access-cidr-source.json`へ記録します。CodeKBの設定を将来変更してもWaiwaiへ自動同期する仕組みではありません。参照元のコードやAWS環境は変更しません。

## ドメイン取得とDNSの初期設定

GCPで取得する場合は[Cloud Domains手順](domain-registration.md)で先にbootstrap-dnsをplan・初期化します。登録者情報は`.local/gcp/dev/domain-contacts.yaml`に本人が入力し、Cloud Domains CLIから渡します。dev rootは初期化済みzoneを読み取るので、DNS側の完了前にdevの実planは作りません。

## 将来のbootstrapとdev構築

以下は入力とplanをレビューして、実際の構築を行う段階でのみ使用します。bootstrapは独立したローカルstateを使います。保管先を作る前に、その安全なバックアップ先も決めます。

```bash
terraform -chdir=infra-gcp/bootstrap init
terraform -chdir=infra-gcp/bootstrap plan -var-file=../../.local/gcp/dev/bootstrap.tfvars -out=bootstrap.tfplan
# 構築すると決め、planを確認した段階でのみ実行
terraform -chdir=infra-gcp/bootstrap apply bootstrap.tfplan
terraform -chdir=infra-gcp/bootstrap output -raw backend > infra-gcp/environments/dev/backend.hcl
terraform -chdir=infra-gcp/environments/dev init -backend-config=backend.hcl
terraform -chdir=infra-gcp/environments/dev plan -var-file=../../../.local/gcp/dev/terraform.tfvars -out=dev.tfplan
# 別途、devのplanを確認してから実行
terraform -chdir=infra-gcp/environments/dev apply dev.tfplan
terraform -chdir=infra-gcp/environments/dev output
```

Azure側のstate/backend/tfvarsはこの手順へ流用しません。Terraformが既存資源の置換・削除を示した場合は、そのまま適用せず所有範囲と既存stateを確認します。

backend未作成の段階では、bootstrapとbootstrap-dnsの実入力planを確認できます。DNS初期化後なら、GCS backendを外した隔離コピーによるdevの予備planも確認できます。devの予備planは実行用ではありません。正式な会社/VPN許可IP、ドメイン・DNS、bootstrapを確定した後、元のrootをGCS backendで初期化し直して実行用planを作成します。命名や入力の変更前に保存したplanは使いません。[全体一覧](resource-inventory.md)で、planに含まれない配備・認証・運用作業も確認します。

## 作成後の入口

`ssh_command`出力を、許可CIDR内の端末から実行します。追加のIAP/LBを暗黙には使用しません。cloud-init完了、OS/dataディスク、Caddy設定、サービスの待機状態を確認し、Terraformが固定IPを向けたCloud DNSのAレコードと、Cloud Domainsの委任・DNSSECを確認します。アプリ配備と利用者の認証・MFAは[運用手順](operations.md)の別工程です。
