# Waiwai Google Cloud

GCPの設計書は`doc-gcp/`、Terraformは[`infra-gcp/`](../infra-gcp/README.md)です。対象は**devのみ**。設計・IaC実装・認証不要の検証と、このMacのCLI設定までを扱い、リソースの作成・Terraform apply・アプリ公開は行いません。

| 資料 | 内容 |
|---|---|
| [基本設計](design.md) | 東京の単一VM、HTTPS・音声・保存・認証・バックアップ |
| [命名・ラベル規則](naming.md) | AWS/Azureの規則をGCPの制約に合わせて適用 |
| [Terraform開発規約](terraform.md) | リソース単位の分割、state・Provider・検証の分離 |
| [Mac設定と構築手順](setup.md) | CLI、認証、既存プロジェクト、将来のplan/apply |
| [運用と受入](operations.md) | DNS・アプリ配備、負荷試験、停止・復元、費用の見方 |

同じリポジトリで問題ありません。アプリは共有し、クラウド固有のrootは独立させます。Azureを残したままGCPを検討できますが、GCPへ切り替えるだけでAzureのリソースが停止・削除されることはありません。両方を稼働させる場合はそれぞれの料金が発生します。

```text
src/・server/・docs/           アプリ共通
doc-azure/・infra-azure/      Azure専用
doc-gcp/・infra-gcp/          GCP専用
scripts/azure/・scripts/gcp/  クラウドごとの操作・検証
```

Waiwai内の「チーム別サーバー」はアプリの論理的な分離です。通常はGCPのこのVM一台で複数サーバーを扱い、追加のたびにVMを増やしません。別会社ごとの物理的な分離が必要な場合は、別プロジェクト・VM・データ領域として設計します。[アプリ側の所属管理](../docs/servers.md)を参照してください。
