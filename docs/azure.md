# Azure devの構築・公開手順

今回の範囲は **設計・実装・ローカル検証まで**。以下は将来、会社の配置先情報が揃い、構築を実施する際の手順です。今回Azureへのapplyやアプリのデプロイは行っていません。

[基本設計](infrastructure/azure-design.md)／[命名規則](infrastructure/naming.md)／[Terraform開発規約](infrastructure/terraform.md)／[IaC入口](../infra/README.md)。対象はdevのみです。

## Macの準備と認証

既存のセットアップスクリプトは`bash scripts/azure/setup-mac.sh`。このMacにはTerraform 1.15.8とAzure CLI 2.91.0が導入済みです。更新は公式リリース・チェックサムを確認して別途行います。DockerやKubernetesは不要です。

```bash
az version
terraform version
az login --use-device-code
az account list --query '[].{name:name,id:id,state:state}' -o table
az account set --subscription <会社のsubscription-id>
```

会社テナントが表示されなければ`az login --tenant <tenant-id> --use-device-code`を使います。MFAは本人が操作します。

## 入力の準備

会社のsubscription ID、SSH許可IPv4 CIDR（通常/32）、運用メールが必要です。課金契約、リソース作成権限、会社Policy、既存ネットワークとの重複も確認します。

```bash
node scripts/azure/prepare.mjs <subscription-id> <operator-ip/32> <ops-email>
```

`.local/azure/dev/`へdev専用SSH鍵、`terraform.tfvars.json`、`bootstrap.tfvars.json`を生成します。秘密鍵は既存ファイルを上書きしません。スクリプト再実行は変数ファイルを更新するので、編集済みのtags/network設定があれば退避してください。生成鍵にパスフレーズはないため非共有・バックアップ対象とします。秘密値をチャットやGitへ貼りません。

`project_name`・`location`・`instance_number`・会社タグはアプリとbootstrapの両方で揃えます。`vnet_cidr`は既定`10.83.0.0/16`。変更するとSubnetとTURN用IPも連動します。入力例は`infra/environments/dev/terraform.tfvars.example`です。

## 認証なしの実装検証

```bash
npm run infra:check
```

実stateを使わず、一時コピーでbackend無効のinit・validate・Providerモックテストを行います。Azureリソースを作成しません。実アカウントでのplanや性能試験の代わりにはなりません。

## 将来の構築時: ProviderとSKUの確認

未登録の場合のみ会社の権限で登録します。TerraformのProvider自動登録は無効です。

```bash
az provider register --namespace Microsoft.Compute --wait
az provider register --namespace Microsoft.Network --wait
az provider register --namespace Microsoft.Storage --wait
az vm list-skus --location japaneast --size Standard_B2als_v2 --all -o table
```

初期サイズは2 vCPU/4GiBのB2als_v2です。クォータ・会社制約・契約料金を確認します。負荷試験で不足した場合の増強候補のみB4als_v2です。

## 将来の構築時: dev backend

リソース作成に加えて、state StorageへのRBAC割当権限が必要です。旧bootstrap stateがあれば[移行案内](../infra/azure/README.md)を先に読み、そのまま適用しません。

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap plan -var-file=../../.local/azure/dev/bootstrap.tfvars.json -out=bootstrap.tfplan
# planのsubscription・dev資源・費用を確認し、構築を実施するときだけ実行
terraform -chdir=infra/bootstrap apply bootstrap.tfplan
terraform -chdir=infra/bootstrap output -raw backend > infra/environments/dev/backend.hcl
terraform -chdir=infra/environments/dev init -backend-config=backend.hcl
```

bootstrapのローカルstateは安全にバックアップします。アプリstateはEntra IDでBlobへ保存し、Blob leaseでロックします。共有キーやSASは使いません。RBAC反映が遅れる場合は反映後に再試行します。

## 将来の構築時: devアプリ資源

```bash
terraform -chdir=infra/environments/dev plan -var-file=../../../.local/azure/dev/terraform.tfvars.json -out=dev.tfplan
# 作成内容を確認し、構築を実施するときだけ実行
terraform -chdir=infra/environments/dev apply dev.tfplan
terraform -chdir=infra/environments/dev output
```

VMのcloud-init完了を待ちます。アプリ本体はまだ配備されません。`terraform output`のURLを使用し、Azure DNS名を手で組み立てません。

## 将来の公開時: Slackとアプリ配備

1. dev rootの`slack_redirect_uri`出力をSlack AppのOAuth & Permissions → Redirect URLsへ登録します。
2. ローカル`.env`に既存のSlack Client ID/Secretを設定します。Terraform変数に渡しません。
3. `node scripts/azure/deploy.mjs`を実行します。dev以外のTerraform出力は拒否します。

既定ワークスペースは`T1MK78MV4`。変更時は`SLACK_TEAM_ID`を明示します。鍵とknown_hostsは`.local/azure/dev`を使用し、初回SSHはTOFUです。可能なら会社の管理経路でホスト鍵指紋を照合します。以後の鍵変更は拒否します。

秘密値を引数・アーカイブに含めず、権限600の一時ファイルをSSH転送し、VMの`/etc/waiwai`・`/etc/waiwai-turn`へ権限制限して配置します。初回TURN共有鍵生成、通常配備での維持、リリース切替・失敗時の復旧はスクリプトが行います。家具・メンバー・リンク・館内放送は`/var/lib/waiwai`へ保存します。

## 利用開始前の受入

- Slack認証、許可ワークスペース限定、未認証WebSocket拒否。
- 会社回線と別回線の2端末で近接音声・消音・Slack DMを確認。
- UDP/TCP/TLSの強制TURNメディア試験、証明書更新を確認。
- Azure実機で150接続・音声30人を想定した持続負荷試験。CPUクレジット・メモリ・遅延・切断・転送量を確認。
- 会社のバックアップ/復元、アラート、予算通知の運用を設定。

既存`npm run test:load`は専用のローカル子サーバーに150人の移動と30人の音声シグナリングを送る試験で、メディアや外部VMを自動試験するものではありません。実Azureの試験方法は会社情報受領後に準備します。

## 運用・廃止

`/healthz`、`systemctl status waiwai waiwai-turn caddy`、`journalctl -u waiwai -u waiwai-turn -u caddy`で確認します。VM停止・配備中は切断し、再起動で再ログインが必要です。

JSONと秘密設定・SSH鍵・stateを会社の安全な保管先へバックアップします。復元時はアプリを止めて有効なデータを戻します。通常配備ではJSONを保持しますが、VM削除では失われます。自動VMバックアップは未実装です。

廃止時はdev rootのdestroy planを確認してから実行します。bootstrapの保護されたStorage/RG/Containerは別管理です。停止で費用を抑える場合はdeallocateが必要で、ディスク・固定IP・Storageの料金は残ります。

## 公式資料

- [Microsoft: Azure CLI for macOS](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-macos)
- [Microsoft: Basv2 VMシリーズ](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/basv2-series)
- [HashiCorp: Azure Blob backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
- [coturn: REST認証と設定](https://github.com/coturn/coturn/blob/master/README.turnserver)
