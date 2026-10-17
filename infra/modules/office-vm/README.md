# office-vm

Caddy・Node.js・coturnを動かすUbuntu VMを管理します。OSディスクはVMライフサイクルに属するためVMブロック内に定義します。

入力はnames/resource_group_name/location/tags/network_interface_id/domain/vm_size/ssh_public_key/acme_email。出力はvm_name/vm_size/ssh_target。

リソース種別ごとにファイルを分割し、認証不要のテストを`tests/`に置きます。[構成設計](../../../docs/infrastructure/azure-design.md)と[開発規約](../../../docs/infrastructure/terraform.md)を参照してください。
