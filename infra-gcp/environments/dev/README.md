# GCP dev root

東京のVM一台とネットワーク・ディスク・Snapshot・OS Login IAMを組み立てます。環境は`dev`固定。stateはGCS、実入力はリポジトリ直下の`.local/gcp/dev/`、backend設定はこのディレクトリの`backend.hcl`です。Azureのtfvars/backendを指定しません。

出力は`cloud`・`environment`・project/zone・VM名・固定IP/Private IP・ドメイン・認証callback・SSHコマンド・dataディスク・Snapshot Policyです。認証情報・TURN共有鍵は出力しません。新しいドメインのAレコードは既存のDNS管理者が登録します。

[基本設計](../../../doc-gcp/design.md)／[構築手順](../../../doc-gcp/setup.md)を参照してください。今回の実行範囲に実GCPのplan/applyは含めません。
