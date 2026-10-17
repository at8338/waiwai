# Azure dev Terraform実装検証（2026-10-17）

対象はdevのみ。Azure認証、実アカウントでのplan/apply、SSH接続、アプリのデプロイは実施していません。

- Terraform 1.15.8 / AzureRM 4.81.0 / macOS arm64。
- `terraform fmt -check -recursive infra` 成功。
- naming/network/office-vm/terraform-state/bootstrap/environments/dev の6対象でvalidate成功。
- ProviderモックによるTerraform test: 計19 run成功（7 + 5 + 4 + 1 + 1 + 1）。
- デプロイ出力・TURN設定のNodeテスト: 3件成功。
- shell/Nodeスクリプト構文と設計書の内部リンクを確認。
- GitHub ActionsのYAML構文を確認。CIでの実行結果はPR上で別途確認する。

再現コマンドは `npm run infra:check`。今回のローカル実行は既存の公式Providerキャッシュを `--plugin-dir` で指定し、一時コピー内でbackend無効のinit/validate/testを実施しました。モックのapplyは実Azureへの適用ではありません。

モックではAzure SKU/クォータ/Policy、実DNSの空き、回線疎通、150接続や音声メディアの実機性能は確認できません。それらは配置先情報受領後の受入対象です。
