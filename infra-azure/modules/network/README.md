# network

VNet・Subnet・NSG・受信ルール・NIC・固定Public IPを管理します。

入力はnames/resource_group_name/location/tags/vnet_cidr/admin_cidr。出力はnetwork_interface_id/public_ip/private_ip/domain。

リソース種別ごとにファイルを分割し、認証不要のテストを`tests/`に置きます。[構成設計](../../../doc-azure/design.md)と[開発規約](../../../doc-azure/terraform.md)を参照してください。
