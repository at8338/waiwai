# Azure dev root

このrootだけがWaiwai devのアプリ資源を組み立てます。`environment`は`dev`固定です。state保管先は`../../bootstrap`で独立管理します。今回applyは実施しません。

| 入力 | 既定値／扱い |
|---|---|
| subscription_id | 必須。会社のsubscription UUID |
| location | japaneastのみ |
| project_name / instance_number | waiwai / 1 |
| vm_size | Standard_B2als_v2。負荷試験不足時のB4als_v2も選択可 |
| vnet_cidr | 10.83.0.0/16。SubnetとNICのIPは連動生成 |
| admin_cidr | 必須。会社VPN/管理者IPv4 /24〜/32 |
| web_allowed_cidrs | 必須。Web利用者/配備端末の公開IPv4 /24〜/32リスト |
| public_slack_events | false。Slack署名付きPOST webhookだけ公開する場合true |
| ssh_public_key | 必須。秘密鍵不可 |
| acme_email | 必須。運用メール |
| tags | 任意。owner/cost_center等。予約タグは上書き不可 |

出力は`environment`・`url`・`slack_redirect_uri`・`public_ip`・`private_ip`・`domain`・`ssh_target`・`resource_group`・`vm_name`・`vm_size`。`deploy.mjs`はこの契約を検証します。

[全体設計](../../../docs/infrastructure/azure-design.md)／[操作手順](../../../docs/azure.md)を参照してください。既存productionのstate/backendを指定しないでください。
