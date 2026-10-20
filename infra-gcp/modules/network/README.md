# network

専用VPC、東京のIPv4 subnet、Standard tierの固定外部IPv4、VM専用タグを対象としたSSH/Web/TURNの4種類のFirewallを管理します。既存default networkは変更しません。

リソース種別ごとに`compute_network.tf`・`compute_subnetwork.tf`・`compute_address.tf`・`compute_firewall.tf`へ分割しています。SSHの接続元は明示したIPv4 CIDRのみです。Webの会社IP制限はVM内のCaddyが担当します。[通信設計](../../../doc-gcp/design.md)と[検証](../../../doc-gcp/terraform.md)を参照してください。
