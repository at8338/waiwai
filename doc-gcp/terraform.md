# GCP Terraform開発規約

`infra-gcp/environments/dev`をアプリroot、`infra-gcp/bootstrap`をstate保管先rootとし、別のstateで管理します。Azureの`infra-azure/`を参照するmoduleや`terraform_remote_state`は設けません。環境のworkspace切り替えも行いません。

- `modules/naming`：命名・共通ラベル。Google APIを呼ばない。
- `modules/network`：VPC、Subnet、Firewall、固定外部IP。
- `modules/office-vm`：VM、ディスク、Snapshot、インスタンスIAM、初期化。
- `modules/terraform-state`：GCSと運用者のobject IAM。

module内部は`compute_instance.tf`・`compute_disk.tf`のようにリソース種別単位で分割します。同種のFirewall等はfor_eachでまとめ、1リソースごとの入れ子moduleは増やしません。provider・backendはrootだけ、入力・出力・versionは専用ファイルに置きます。

Terraformは1.10以上2.0未満、検証版は1.15.8。Google Providerはrootで`~> 8.7.0`、子moduleで`>= 8.7.0, < 9.0`とし、公式RegistryでMac arm64とLinux amd64を検証したlockfileを両rootへコミットします。Azureのlockfileは流用しません。認証はADCを使い、サービスアカウント鍵JSON・アクセストークン・アプリSecretをtfvars/backend/metadataへ記載しません。

実入力は`.local/gcp/dev/*.tfvars`（JSON形式なら`*.tfvars.json`）、手元のbackend設定は`infra-gcp/environments/dev/backend.hcl`。いずれも既存`.gitignore`で除外し、共有するのは`.example`だけです。bootstrapのstateも秘密情報相当として会社の安全な場所に保管します。

```bash
npm run infra:gcp:check
```

検証は実backendや実入力を除いた一時コピーで実施します。format・6対象のinit（backend無効）/validate/GoogleモックテストとMacセットアップの構文を確認します。Google認証は不要です。Provider取得にネットワークが必要ですが、`--plugin-dir <mirror>`で既存ミラーを指定することもできます。CIは同じ検証だけで、GCPへのplan/applyやデプロイを行いません。モック内の`command = apply`は仮想Providerと破棄するローカルstateだけに適用します。

命名、予約ラベル、公開ポート、CIDR制限、VM保護、OS Login+2FA、サービスアカウントなし、バックアップ、cloud-initのYAML、独立データディスク、devの出力契約を確認します。これは実GCPの課金・Policy・DNS/証明書・性能・復元の確認の代わりにはなりません。

Azureディレクトリの改名はmodule内のTerraformアドレスを変更しないため、新たなmoved/importは不要です。AzureのstateをGCSへmigrateしたり、GCPのstateへAzure資源をimportしたりしません。プロバイダー更新・クラウド切り替え・既存データ移行はそれぞれ分けてレビューします。
