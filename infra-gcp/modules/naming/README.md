# naming

dev固定のリソース名、GCS state prefix、共通ラベルを返します。Google APIやstateは使用しません。プロジェクト名・東京region・連番を検証し、予約ラベルを保持します。

命名は`locals.tf`、入力は`variables.tf`、戻り値は`outputs.tf`に置きます。[命名規則](../../../doc-gcp/naming.md)と[モジュール検証](../../../doc-gcp/terraform.md)を参照してください。
