# Azureリソース命名・タグ規則

参考AWS構成の「環境・システム・リージョン・サービス・用途・連番」の順序を引き継ぎ、Azure固有の長さと文字制限に合わせます。実装の唯一の定義は `infra/modules/naming` です。名前を各リソースファイルへ直書きしません。

## 通常リソース

```text
{environment}-{project_name}-{region_code}-{resource_type}-{purpose}-{NNN}
dev-waiwai-jpe-vm-office-001
```

| 要素 | 今回の値／規則 |
|---|---|
| environment | `dev`。今回stg/prdのrootは作成しない |
| project_name | `waiwai`。英小文字から始まる英小文字・数字3〜12文字 |
| region_code | `jpe` = `japaneast`。他リージョンはSKU・ゾーン・料金を確認してから追加 |
| purpose | `office`（アプリ）／`tfstate`（state管理） |
| NNN | `001`〜`999`。台数を意味せず、同じ用途の構成を識別する番号 |

| Azureリソース | 種別 | 名前例 |
|---|---|---|
| Resource Group | rg | dev-waiwai-jpe-rg-office-001 |
| Virtual Network | vnet | dev-waiwai-jpe-vnet-office-001 |
| Subnet | snet | dev-waiwai-jpe-snet-office-001 |
| Network Security Group | nsg | dev-waiwai-jpe-nsg-office-001 |
| Network Interface | nic | dev-waiwai-jpe-nic-office-001 |
| Public IP | pip | dev-waiwai-jpe-pip-office-001 |
| Linux Virtual Machine | vm | dev-waiwai-jpe-vm-office-001 |
| OS Managed Disk | osdisk | dev-waiwai-jpe-osdisk-office-001 |
| state用Resource Group | rg | dev-waiwai-jpe-rg-tfstate-001 |

VM本体の `office` はアプリ・HTTPS・TURN同居という責務を表します。台数を増やす前にアプリ状態の共有設計が必要です。

## Azure固有の例外

| 対象 | 規則 |
|---|---|
| 公開DNSラベル | `dev-waiwai-jpe-office-001-{hash8}`。Public IPのFQDN出力を使用し、DNS名は組み立て直さない |
| state Storage Account | `{env}{project先頭6文字}{region}sttf{hash8}`。例 `devwaiwaijpesttfxxxxxxxx`。英小文字・数字のみ、最大24文字 |
| Blob Container | Storage Accountの中で固定名 `tfstate` |
| state Blob key | `waiwai.dev.tfstate`（プロジェクト名を変えたら連動） |
| NIC IP configuration | NIC内で固定名 `primary` |
| NSGルール | NSG内の固定名 `allow-ssh-admin`、`allow-web-turn-tcp`、`allow-turn-udp` |
| RBAC割当 | AzureRMのGUID生成。人向け識別は対象スコープとロール名で行う |

`hash8` は小文字化したsubscription ID、環境・完全なプロジェクト名・リージョン・連番から作るSHA-256の先頭8文字です。乱数ではないので毎回同じ名前になります。短縮前のプロジェクト名全体を含めるため、先頭6文字が同じ場合も区別します。ハッシュの一意性は保証ではないので、実際の名前の空きはAzure側のplan/apply時に確認します。Public IPは`SubscriptionReuse`スコープも使用します。

## 共通タグ

| キー | 値 |
|---|---|
| application | waiwai |
| environment | dev |
| region | jpe |
| managed_by | terraform |
| owner / cost_center | 会社の値を`tags`で追加 |

共通4タグは上書きできません。タグをサポートするリソースへ付与し、Subnet、NSGルール、Container、RBAC割当などのタグ非対応リソースへは付けません。Terraform内の識別子は`snake_case`、通常リソースのローカル名は`office`、stateリソースは`state`です。

命名要素の変更はAzureのリソース再作成やURL変更を伴います。名前の整形だけを理由に稼働中リソースを置き換えず、移行としてレビューします。

## 公式資料

- [Microsoft: 命名方針](https://learn.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming)
- [Microsoft: リソース名の制約](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules)
