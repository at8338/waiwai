# Waiwai Azure

Azureの設計書はこの`doc-azure/`、Terraformは[`infra-azure/`](../infra-azure/README.md)です。GCPとはroot・Provider lockfile・backend・実行スクリプトを分けます。アプリ共通の機能説明は`docs/`に残します。

- [基本設計](design.md)
- [命名・タグ規則](naming.md)
- [Terraform開発規約](terraform.md)
- [Mac設定・構築・公開手順](deployment.md)

旧`infra/`を`infra-azure/`へ移し、`docs/azure.md`と`docs/infrastructure/`のAzure資料をこのディレクトリへ集約しました。リソースアドレス・Azure上の名前・Blobのstateキー・サブスクリプション・`.local/azure/dev`は変更しません。ディレクトリ名の変更だけを理由とするリソースの置換やstate移行は不要です。移動後は新しいrootで通常の`terraform init`を行い、同じbackendを指すことを確認します。既存stateを削除したり、GCPのstateへ移したりしません。

今回は設計・実装・ローカル検証のみです。Azureへのapplyやデプロイは行いません。
