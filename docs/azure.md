# Azureへの公開

最小構成は日本東リージョンのLinux VM 1台です。アプリ、Caddy（自動HTTPS）、coturn（音声中継）を同居させます。固定IPとAzureのDNS名を使うので独自ドメインは必須ではありません。Terraform stateは別のAzure Storageに置き、Microsoft Entra IDでアクセスします。Kubernetes、ロードバランサー、NAT Gateway、DBは使いません。

- アバター150同時接続、音声参加30人。音声は1端末最大4接続、5人以内の小グループを想定。6人以上が密集すると一部の相手と接続せず、画面に案内を出します。30人全員による一斉会議にはSFUなど別構成が必要です。
- 本番はSlackログイン必須・指定ワークスペース限定。ゲストのWebSocket接続も拒否します。
- `Standard_B2als_v2`（2 vCPU / 4 GiB）は初期候補です。Macでの試験結果は下記。Azure上での長時間試験、CPUクレジット、会社回線からのTURN接続を確認してから全社展開します。
- 1台なのでVM停止・再デプロイ中は一時切断します。セッションもメモリ上のため再ログインが必要です。冗長構成や24時間無停止の保証は含みません。
- 前回見積の目安は月約17,600円（会社コミット適用前・税別、為替150円/USD）。移動通信は削減しましたが、TURN利用率・発話時間で変わります。state用Storageは少量課金されます。契約残高の消化対象かは会社の課金設定で確認してください。

## このMacの準備

Azure CLI 2.91.0をMicrosoft公式tarballからSHA-256照合してユーザー領域に導入しています。Python 3.14.8を既存miseに追加し、既存のPython設定は変えていません。`az` は `~/.local/bin/az`、Terraformは既存miseの1.15.8です。Homebrew、Docker、管理者パスワードは今回の構成には不要です。

再現用: `bash scripts/azure/setup-mac.sh`（Apple Silicon向け）。公式配布元・チェックサム・バージョンを固定しています。更新時は公式リリースとチェックサムを確認して更新してください。

```bash
az version
terraform version
az login --use-device-code
az account list --query '[].{name:name,id:id,state:state}' -o table
az account set --subscription <会社のサブスクリプションID>
```

個人用サブスクリプションと混同しないでください。会社テナントが表示されなければ `az login --tenant <tenant-id> --use-device-code`。MFAは本人が操作します。パスワードや認証コードをリポジトリへ保存しません。

## 1. 配置先を設定してplanを確認

会社のサブスクリプションID、SSHを許可する会社VPNまたは作業者の固定IPv4 CIDR（通常 `/32`）、運用メールアドレスを指定します。IPは本人・会社で確認し、外部のIP確認サービスに自動送信しません。

```bash
node scripts/azure/prepare.mjs <subscription-id> <operator-ip/32> <ops-email>
```

`.local/azure/` に専用SSH鍵と変数ファイルを生成します。このディレクトリはgit対象外です。秘密鍵にはパスフレーズがないので、ディレクトリを非共有のままにしてください。既存鍵は上書きしません。

利用するProviderを事前登録します（会社の権限で未登録の場合のみ）。Terraformによるサブスクリプション全体の自動登録は無効です。

```bash
az provider register --namespace Microsoft.Compute --wait
az provider register --namespace Microsoft.Network --wait
az provider register --namespace Microsoft.Storage --wait
az vm list-skus --location japaneast --size Standard_B2als_v2 --all -o table
```

VMのSKU制限・クォータ・会社ポリシーを確認します。`B2als_v2`が使えない場合は勝手に高価なサイズに変更せず、サイズと料金を確認します。

## 2. Terraform state保管場所を作る

会社の対象リソースグループを作成できる権限に加え、state用StorageへのRBACを割り当てられる権限（Ownerまたは対応するアクセス管理権限）が必要です。権限不足なら管理者に同じ構成を適用してもらいます。

```bash
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap plan -var-file=../../.local/azure/bootstrap.tfvars.json -out=bootstrap.tfplan
# planの対象サブスクリプション・作成物を確認して実行
terraform -chdir=infra/bootstrap apply bootstrap.tfplan
terraform -chdir=infra/bootstrap output -raw backend > infra/azure/backend.hcl
terraform -chdir=infra/azure init -backend-config=backend.hcl
```

StorageはLRS、HTTPS/TLS1.2以上、匿名公開なし、共有キー認証なし、Blob版管理・30日間の削除保護を設定します。RBAC反映に数分かかる場合は反映後に再実行します。bootstrapのstateはローカルのため、作成後は会社の安全な保管先へバックアップしてください。アプリのstateはAzure Blobでロックされます。Storageには `prevent_destroy` があり、アプリを廃止しても自動削除しません。

## 3. アプリ用リソースを作る

```bash
terraform -chdir=infra/azure plan -var-file=../../.local/azure/terraform.tfvars.json -out=production.tfplan
terraform -chdir=infra/azure apply production.tfplan
terraform -chdir=infra/azure output
```

作成物は専用リソースグループ、VNet/Subnet、NSG、NIC、固定IPv4、VM（32GiB Standard SSD）です。固定IPはInternetルーティングを使用。SSHは指定CIDRのみ、アプリの5173ポートは外部に公開しません。HTTPS用80/443、TURN用3478 TCP/UDP・5349 TCP・49160–49959 UDPを許可します。VNetアドレス `10.83.0.0/16` が既存ネットワークと衝突しないか、VNet接続前に確認してください。

NSGとアプリ認証がアクセス制御の境界です。社内ネットワークから外部UDPまたはTURN TLS 5349への通信を許可してください。443だけ許可される回線は追加構成が必要です。

初回cloud-initでUbuntuパッケージ、Caddy、coturn、SHA-256固定のNode.js 24.22.0を入れます。cloud-initには秘密情報を一切渡しません。完了まで数分かかります。

## 4. Slackとアプリを接続

1. `terraform output slack_redirect_uri` のURLをSlack Appの **OAuth & Permissions → Redirect URLs** に追加・保存します。一時URLを削除するのは本番ログイン検証後です。
2. このMacの `.env` にある `SLACK_CLIENT_ID` と `SLACK_CLIENT_SECRET` を利用します。チャットやTerraform変数へ貼りません。
3. `node scripts/azure/deploy.mjs` を実行します。既定の許可ワークスペースは `T1MK78MV4`。別ワークスペースにする場合は `SLACK_TEAM_ID` 環境変数で明示します。

デプロイはローカルでlockfileからビルドし、必要なコードとdistだけをSSH転送します。秘密値は引数やアーカイブに含めず、権限600の一時ファイルをSSH転送してVMの `/etc/waiwai/app.env` に権限640で保存し、一時ファイルを消します。初回SSHは専用known_hostsへのTOFUです。可能なら初回前にAzure管理経路でホスト鍵の指紋を照合してください。次回以降の鍵変更は拒否されます。

TURN共有鍵は初回にランダム生成してVM内へ保存し、通常のデプロイでは維持します。ブラウザーへ渡すのは30–60分有効なHMAC資格情報だけです。共有鍵はTerraform・ブラウザーへ渡しません。内部IP・loopbackへの中継を拒否し、ユーザーと全体の帯域・割当数を制限します。HTTPS証明書はCaddyで更新し、毎時タイマーでTURN TLSへ反映します。証明書がまだなければTURNは起動しません。

リリースは `/opt/waiwai/releases/` に配置し、ヘルスチェック後に稼働を確認します。アプリ起動失敗時は直前コード・設定へ戻します。最初の導入に戻り先はありません。通常は直近3世代を保持します。秘密値はrelease配下には置きません。

## 5. 公開前の確認

- 固定URLでSlackログイン。会社以外のアカウントと未ログインの `/office` が拒否されること。
- 会社回線と別回線の2端末で、近接音声、離れたときの消音、Slack DMを確認。
- TURNの資格情報で **relayのみ** の試験を行い、UDP・TCP・TLSと証明書更新を確認。ローカルP2P成功だけではここは確認できません。
- Azure VM上でも下記の負荷試験を実行。1時間以上、実際の会社クライアントを含む試験でCPU・メモリ・送信量・CPU Credits Remainingを確認。Bシリーズのクレジットが減り続けるならVMサイズを見直します。
- Azure MonitorのVMメトリクス・予算通知を会社運用へ設定。自動バックアップ・冗長化はこの最小構成には含めていません。`.env`、SSH鍵、stateの保管と復旧手順を会社の運用へ組み込んでください。
- 部屋に配置した小物はsystemdの `StateDirectory=waiwai` が作る `/var/lib/waiwai/office-objects.json` に保存します。アプリの再デプロイでは消えませんが、VM・ディスクの削除では失われます。このファイルも会社のバックアップ対象に含め、復元時はアプリを停止して有効なJSONを戻してください。破損したファイルは自動で上書きせず、起動を停止します。
- オフライン検索用のSlackメンバー名・IDは `/var/lib/waiwai/office-members.json` に保存します。このファイルも同じ手順でバックアップ・復元します。認証トークンやオンライン状態は保存せず、再起動後は実際の接続から状態を再構成します。

```bash
# 開発端末で再現。専用の子プロセスがloopbackに起動し、既存サーバーは使いません。
npm test
npm run check
npm run build
LOAD_SECONDS=60 npm run test:load
terraform -chdir=infra/azure test
```

`test:load` は150人が全員連続移動し、30人分の音声状態・シグナリングを送る負荷試験です。音声メディア自体は送信しません。メディアはViteの `/tests/voice-scale.html` にある30人の合成WebRTC検証で別途確認します。実マイク・スピーカー出力は使いません。テストページは本番distに含まれません。

## 運用と復旧

- 稼働確認: `/healthz`、`systemctl status waiwai waiwai-turn caddy`。ログは `journalctl -u waiwai -u waiwai-turn -u caddy`（閲覧権限のある管理者だけ）。ログは最大256MiB・7日を目安に抑えます。
- VM再作成: Terraform apply → Slack Redirect URL確認 → deploy。固定IPとDNSが維持されればURLは同じです。セッションは復元しません。
- VMを停止する場合は **deallocate** まで行わないとコンピュート料金が残ります。停止中もディスク・固定IP・Storageは課金されます。常時URLを利用する運用では停止しません。
- アプリ削除: `infra/azure` のdestroy planを確認してから削除。state Storageや会社の別リソースは削除しません。

## 公式資料

- [Microsoft: macOS Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-macos)
- [Microsoft公式CLIリリース](https://github.com/Azure/azure-cli/releases/tag/azure-cli-2.91.0)
- [Terraform: Azure CLI認証](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/guides/azure_cli)
- [Terraform: Azure Blob backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
- [coturn公式設定とREST認証](https://github.com/coturn/coturn/blob/master/README.turnserver)
