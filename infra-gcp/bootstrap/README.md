# GCP state bootstrap

アプリ環境から独立したGCS state保管先です。既存の課金有効projectと承認済みstate運用者を入力し、API・非公開バケット・object IAMを定義します。プロジェクトの作成・課金付け替え・Owner付与・鍵JSON生成はしません。

独立したローカルstateを保全し、構築後のbackend出力だけをdev rootへ渡します。[手順](../../doc-gcp/setup.md)と[設計](../../doc-gcp/design.md)を参照してください。今回applyは実行しません。
