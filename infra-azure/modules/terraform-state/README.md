# terraform-state

devのTerraform state用RG・Storage・Container・RBACを管理します。providerはrootから継承します。

入力はnames/location/tags/operator_object_id。出力はresource_group_name/storage_account_name/container_name。

リソース種別ごとにファイルを分割し、認証不要のテストを`tests/`に置きます。[構成設計](../../../doc-azure/design.md)と[開発規約](../../../doc-azure/terraform.md)を参照してください。
