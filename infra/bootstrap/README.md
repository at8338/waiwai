# dev Terraform backend bootstrap

新規dev専用のstate Storageを用意する独立rootです。ローカルstateを使い、アプリrootのdestroyに巻き込まれません。今回applyは実施しません。

入力: `subscription_id`必須、`location=japaneast`、`project_name=waiwai`、`instance_number=1`、任意`tags`。実行者のEntra object IDは`azurerm_client_config`から解決します。アプリrootと同じ命名入力を使用してください。

出力`backend`はdevの非機密backend設定です。Blob Data Contributorをstateアカウントのみに割り当てるため、対象資源作成とRBAC割当の権限が必要です。既存bootstrap stateがある場合は、先に[移行案内](../azure/README.md)を確認してください。

作成後はこのrootのローカルstateを安全な会社保管先へバックアップします。RG/Storage/Containerは`prevent_destroy`で保護されます。
