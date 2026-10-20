# Waiwai Azure Terraform

アプリと同じモノレポで管理します。今回の対象は **devのみ**。設計・実装・認証不要の検証までを完了範囲とし、Azureリソースの作成やアプリのデプロイは実施しません。

```text
infra-azure/
├── bootstrap/               # dev用state保管先。独立したローカルstate
├── environments/dev/        # devの組み立て・provider・backend・入出力
├── modules/
│   ├── naming/              # 命名・共通タグ（Azure APIを使わない）
│   ├── network/             # VNet/Subnet/NSG/ルール/NIC/固定IP
│   ├── office-vm/           # Linux VM、独立ディスク、Backup、cloud-init
│   └── terraform-state/     # state専用RG/Storage/Container/RBAC
├── tests/mocks/             # AzureRM共通モック
└── azure/                   # 旧構成の実行を止める移行案内
```

各モジュール内は `virtual_network.tf`、`subnet.tf`、`public_ip.tf` のようにリソース種別ごとに分割します。`variables.tf`・`outputs.tf`・`versions.tf`を揃えます。環境のルートはモジュールを接続するだけとし、デプロイ時の秘密値はTerraformに渡しません。

| 読むもの | 内容 |
|---|---|
| [設計書](../doc-azure/design.md) | 構成図、リソース一覧、通信・容量・state・運用設計 |
| [命名規則](../doc-azure/naming.md) | 参考AWS規則をAzure向けに適用したルールと例外 |
| [Terraform開発規約](../doc-azure/terraform.md) | 分割方針、責務、検証、変更時の注意 |
| [Azure利用手順](../doc-azure/deployment.md) | 将来のログイン、plan、承認後の構築・公開手順 |
| [dev](environments/dev/README.md) | 変数・出力の契約とstateの分離 |
| [旧構成からの移行](azure/README.md) | 旧production用stateをdevに流用しないための扱い |

## ローカル検証

必要ツールはNode.js 22.18以降、Terraform 1.10以上2.0未満（検証バージョン1.15.8）。AzureRMは4.81系をlockfileで固定します。

```bash
npm run infra:fmt
npm run infra:azure:check
```

`infra:azure:check` はformat確認、デプロイ設定のNodeテスト、一時コピー内で6対象のinit（backend無効）・validate・モックテストを実行します。Azure認証は不要で、実際のbackend・stateに触れません。初回はProvider取得にネットワークが必要です。既存Providerミラーがあれば `npm run infra:azure:check -- --plugin-dir /absolute/path/to/provider-mirror` で指定できます。

GitHub Actionsも同じ検証だけを実行します。Azure認証情報は使わず、`plan`・`apply`・アプリのデプロイは行いません。モックテスト内の `command = apply` は仮想Providerへの適用であり、Azureへの適用ではありません。
