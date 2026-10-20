# Terraform開発規約

## 配置・責務

アプリは従来の`src/`・`server/`、IaCは`infra-azure/`、操作スクリプトは`scripts/azure/`、設計書は`doc-azure/`に置きます。別リポジトリへ分離しません。

- `environments/dev`は環境のroot。provider/backend/変数/出力とモジュールの接続を記述する。`environment = "dev"`は固定し、tfvarsで本番へ変更できるようにしない。
- `modules`はライフサイクルや責務ごとに分ける。現在は`naming`・`network`・`office-vm`・`terraform-state`。1リソースのためだけの入れ子モジュールは増やさない。
- モジュール内部はリソース種別単位の`.tf`ファイル。同じ種類のまとまったNSGルールは1ファイルで`for_each`管理。NSGインラインルールと単独ruleリソースは混在させない。
- 子モジュールで認証/provider設定を定義しない。rootがAzureRM providerを構成する。バージョン制約は`versions.tf`へまとめる。
- 入力は`variables.tf`、外部へ渡す値は`outputs.tf`、命名計算は`naming`、補助式は`locals.tf`へ置く。root間でstateを共有せず、Terraform workspaceによる環境切替は使わない。

## バージョン・秘密値

Terraformは1.10以上2.0未満、開発検証は1.15.8。AzureRMはrootで`~> 4.81.0`、子で`>= 4.81.0, < 5.0`とし、rootのlockfileをコミットする。更新時は明示的な`init -upgrade`とplan差分をレビューする。

MacとLinux CIで同じlockfileを使うため、公式Registryで`terraform providers lock -platform=darwin_arm64 -platform=linux_amd64`を実行し、両platformのh1を保持する。署名確認後に両rootのlockfileへ反映する。zipのzhだけではreadonly init後の展開済みパッケージ検証に不足する場合があるため、チェックサム検証を無効にしたり、lockfileを削除して回避しない。

`.local/azure/dev`、state、plan、実tfvars、backend.hcl、秘密鍵はGit管理しない。共有可能な入力例は`.example`のみ。Terraformに渡すのはSSH公開鍵であり、Slack/TURNの秘密値は別のアプリ配備経路で扱う。

## 検証

`npm run infra:azure:check`は実stateを変更しない一時コピーで動作する。6対象のvalidateとモックテスト、Nodeのデプロイ設定テストを同じProvider lockfileで確認する。PRのGitHub Actionsはこの処理だけを実行し、Azureのplan/applyやデプロイを行わない。

テストでは、命名長・短縮時の区別、予約タグ、SSH範囲、公開ポート、Private IP、秘密値を含まない初期化、Secure Boot、state保護設定、dev出力契約を確認する。ProviderモックではAzureの実SKU・クォータ・Policy・通信性能は検証できない。実Azureのplanと負荷試験は別の受入工程とする。

## 変更・移行

リソースアドレスの移動には必要に応じて`moved`を使い、名前変更に伴うreplaceを隠さない。bootstrapの旧アドレスは`moved.tf`に記録したが、旧state用Storageの改名を自動で行うものではない。

今回のdev構成に旧production stateを流用しない。旧`infra-azure/azure`は実行停止用のTerraformバージョン制約を置く。既存資源があれば、旧ブランチの構成とstateを保全して別途移行計画を立てる。削除・再作成を前提にstateを消したり、無条件に`state rm`を行ったりしない。

## 公式資料

- [HashiCorp: 標準モジュール構造](https://developer.hashicorp.com/terraform/language/modules/develop/structure)
- [HashiCorp: Providerモック](https://developer.hashicorp.com/terraform/language/tests/mocking)
- [HashiCorp: Azure Blob backend](https://developer.hashicorp.com/terraform/language/backend/azurerm)
