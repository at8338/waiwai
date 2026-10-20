# office-vm

単一VM、独立したOS/dataディスク、日次Snapshot、VM単位のOS Admin Login IAM、cloud-initを管理します。OS Loginと2FAを有効化し、dev rootから指定する認証読取専用のGoogleサービスアカウントをADC用に付与します。ユーザー管理権限や鍵ファイルは与えません。VM・ディスク・バックアップポリシーは削除を保護します。

`compute_instance.tf`・`compute_disk.tf`・`compute_resource_policy.tf`などリソース種別で分割しています。`bootstrap.tf`は初期化テンプレートを生成し、変更時に既存VMへの未適用を見逃さないよう置換を検知します。削除保護を自動解除する処理はありません。アプリ本体・認証Secret・TURN共有鍵はこのモジュールで配備しません。

[VM・永続化設計](../../../doc-gcp/design.md)、[公開前の別工程と復旧](../../../doc-gcp/operations.md)、[検証](../../../doc-gcp/terraform.md)を参照してください。
