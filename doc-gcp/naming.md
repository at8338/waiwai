# GCPリソース命名・ラベル規則

AWS/Azure側の「環境・システム・リージョン・種別・用途・連番」を引き継ぎます。唯一の定義は`infra-gcp/modules/naming`です。環境は`dev`固定、東京の短縮名は`tky`、連番は`001`〜`999`。プロジェクト名は小文字英数字3〜12文字で、先頭は英字です。

```text
{environment}-{project_name}-{region_code}-{resource_type}-{purpose}-{NNN}
dev-waiwai-tky-vm-office-001
```

| 対象 | 名前例 |
|---|---|
| VPC | dev-waiwai-tky-vpc-office-001 |
| Subnet | dev-waiwai-tky-snet-office-001 |
| 固定外部IP | dev-waiwai-tky-ip-office-001 |
| VM | dev-waiwai-tky-vm-office-001 |
| OS/dataディスク | dev-waiwai-tky-disk-os-001 / dev-waiwai-tky-disk-data-001 |
| Snapshot Policy | dev-waiwai-tky-snap-office-001 |
| Firewall（SSH） | dev-waiwai-tky-fw-office-ssh-001 |
| Firewall（Web） | dev-waiwai-tky-fw-office-web-001 |
| Firewall（TURN TCP / UDP） | dev-waiwai-tky-fw-office-turn-tcp-001 / dev-waiwai-tky-fw-office-turn-udp-001 |
| Firewall用network tag | dev-waiwai-tky-office-001 |
| stateバケット | dev-waiwai-tky-gcs-tfstate-001-{hash8} |
| GCS backend prefix | waiwai/gcp/dev/001 |

`hash8`はGCP project ID、環境・完全なプロジェクト名・region・連番を含むSHA-256の先頭8文字です。バケットのグローバル名競合を減らすもので、一意性は実APIで確認します。VM内のdata device名だけはマウント契約として`waiwai-data`固定です。ドメインはユーザーが所有する公開DNS名を別入力で与えます。

Firewallの用途は`office-ssh`・`office-web`・`office-turn-tcp`・`office-turn-udp`とし、すべて連番で終えます。完全な名前はnamingモジュールの`names.firewall_rules`で定義し、networkモジュールで接尾辞を追加しません。旧`...-office-001-ssh`形式の保存済みplanは作り直します。現在は未applyなので既存Firewallの置換はありません。適用済み環境にこの変更を持ち込む場合は、名前変更による置換を別途確認します。

network tagは名前付きインフラリソースではなくVMの属性なので`dev-waiwai-tky-office-001`、state prefixはGCS内の保存パスなので`waiwai/gcp/dev/001`を使います。IAM付与・ディスクへのポリシー紐付け・APIのサービス名にも独自の命名文字列を付けません。日々生成されるSnapshotやVPCのシステム生成ルート等はGoogle側の識別子です。これらを含む[リソースと公開作業の全体一覧](resource-inventory.md)で管理範囲を確認します。

ラベルは`application=waiwai`、`environment=dev`、`region=tky`、`managed_by=terraform`を固定し、`owner`・`cost_center`などを追加できます。予約4キーは上書きしません。GCPの英小文字・数字・`_`・`-`、63文字以内の制限に合わせ、ラベル非対応リソースへは付けません。プロジェクトの既存ラベルや他のアプリ資源は変更しません。

クラウドが異なれば名前もstateも別です。Azureのリソース名やURLをGCPにコピーしません。命名要素の変更で置換が必要な場合は、既存資源を削除して整えるのではなく移行としてレビューします。
