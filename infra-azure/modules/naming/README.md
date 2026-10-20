# naming

命名とタグを一元管理します。Azure ProviderやAPIは使いません。

入力はproject_name/environment/location/subscription_id/instance_number/tags。出力はnames/tags/region_code。

リソース種別ごとにファイルを分割し、認証不要のテストを`tests/`に置きます。[構成設計](../../../doc-azure/design.md)と[開発規約](../../../doc-azure/terraform.md)を参照してください。
