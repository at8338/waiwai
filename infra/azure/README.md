# 旧Azure rootについて

以前のproduction想定の単一ファイル構成は廃止しました。新規dev用rootは`../environments/dev`、設計書は`../../docs/infrastructure/`です。`retired.tf`に成立しないTerraformバージョン制約を置き、キャッシュされた旧backendに対して空構成のdestroy planを出さないよう、旧パスでのinit/plan/applyを停止します。

今回の作業でAzureへのapply・destroy・state移行は実施しません。ローカルに既存stateファイルはありませんでしたが、Azure上の資源やremote stateの有無を確認したわけではありません。

既に旧構成を適用している場合は、旧構成とstateを会社の安全な保管先へ保全し、旧ブランチの専用checkoutで管理を継続してください。新規devには別のstate Storageと`waiwai.dev.tfstate`を使用し、`waiwai.production.tfstate`を流用しません。旧`.local/azure`の鍵・変数も自動では移しません。

bootstrapは同じパスですが、旧リソース名からdevの命名へ変わります。`moved.tf`はアドレス移動だけを記録し、Storage改名による再作成は`prevent_destroy`で止めます。既存bootstrapのstateがある場合はそのままapplyせず、別途移行手順を作成してください。state削除や保護設定解除で通過させないでください。
