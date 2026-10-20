# Waiwai GCP Terraform

設計は[`doc-gcp/`](../doc-gcp/README.md)。devのみを実装し、Azureの`infra-azure/`とは独立したProvider・backend・lockfile・CIを使います。

[リソースと公開作業の全体一覧](../doc-gcp/resource-inventory.md)には、Terraform管理の20件に加え、自動生成物・VM内サービス・未整備のDNS/認証/配備/監視を記載しています。Terraformの件数を公開環境全体のリソース数とは扱いません。

```text
infra-gcp/
├── bootstrap/              # GCS stateバケット / 独立したローカルstate
├── environments/dev/       # provider・backend・入出力・組み立て
├── modules/
│   ├── naming/             # 命名と共通ラベル
│   ├── network/            # VPC・Subnet・Firewall・固定外部IP
│   ├── office-vm/          # VM・ディスク・Snapshot・OS Login IAM・初期化
│   └── terraform-state/    # 非公開・版管理・soft deleteのGCS
└── tests/mocks/            # 実GCPを呼ばないGoogleモック
```

module内部はリソース種別ごとのファイルに分けます。Terraform 1.15.8 / Google Provider 8.7.0で検証し、両rootにMac arm64・Linux amd64の公式lockfileを保存します。Provider取得にネットワークは必要ですが、検証にGoogleのログインは不要です。

```bash
npm run infra:gcp:check
# キャッシュ済みProviderミラーがある場合
npm run infra:gcp:check -- --plugin-dir /absolute/path/to/provider-mirror
```

スクリプトは一時コピーでbackendを無効化してinit・validate・モックテストを行います。実backend、tfvars、plan、stateを使わず、クラウドへplan/applyしません。モックテスト内のapplyは仮想Providerだけです。MacのCLI設定は`bash scripts/gcp/setup-mac.sh`、将来の構築は[手順書](../doc-gcp/setup.md)を参照してください。
