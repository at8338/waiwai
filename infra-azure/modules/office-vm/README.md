# office-vm

Caddy・Node.js・coturnを動かすUbuntu VMを管理します。OSディスクはVMブロック内、データディスク・接続・Vault・バックアップはリソースごとに分割します。アプリデータは独立ディスクへマウントし、日次バックアップと削除防止を設定します。Webアクセスにはweb_allowed_cidrsが必須。public_slack_eventsは既定falseです。

入力はnames/resource_group_name/location/tags/network_interface_id/domain/vm_size/ssh_public_key/acme_email。出力はvm_name/vm_size/ssh_target。

リソース種別ごとにファイルを分割し、認証不要のテストを`tests/`に置きます。[構成設計](../../../doc-azure/design.md)と[開発規約](../../../doc-azure/terraform.md)を参照してください。
