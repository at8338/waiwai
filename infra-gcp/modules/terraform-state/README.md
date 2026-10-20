# terraform-state

GCS backendのバケットと、承認済み運用者のobject IAMを管理します。公開禁止、均一IAM、版管理、30日のsoft deleteを有効化し、削除保護を設定します。バケットの作成はdevとは別のbootstrap rootから実行します。

リソースは`storage_bucket.tf`と`storage_bucket_iam_member.tf`、backend用の出力は`outputs.tf`です。Azure Blobのstateを流用しません。[state運用](../../../doc-gcp/terraform.md)と[bootstrap手順](../../../doc-gcp/setup.md)を参照してください。
