# Domain/DNS bootstrap（dev）

Cloud Domains / Cloud DNS APIと、DNSSECを有効にした公開DNSゾーンを管理します。名前は`dev-waiwai-tky-dns-office-001`です。VMやstate用GCSを作らずにドメイン取得を進められるよう、独立したlocal backendを使います。このrootのstateも会社の安全な場所へ保全します。

Terraformはゾーンまでを作り、ドメイン自体の購入はCloud DomainsのCLIで別途行います。登録者の会社名・住所・電話番号をTerraform stateへ保存しないためです。登録料とCloud DNSの料金は別です。VMの固定IPを向けるAレコードは`environments/dev`で管理します。

手順・個人情報の入力方法・登録結果の検証は[ドメイン取得手順](../../doc-gcp/domain-registration.md)を参照してください。root間で`project_id`・`project_name`・`region`・`instance_number`・`domain`を揃えます。DNSゾーンはGlobalリソースで、名前の`tky`は利用地域を表します。
