# 個人データ保存・Azure公開前修正の検証

2026-10-18 JST。Azureへのapply・実plan・配備・Entra設定変更は実施していない。

## 個人データ

- SQLiteの再起動復元、Slack/Entraのユーザー分離、アバター・バディ・両図鑑を検証。
- 同じ引き継ぎの再実行で重複しない。既存サーバー設定を優先し、発見記録は和集合/最初の日時を保持。不正入力は全体を保存しない。
- 古いタブの設定は409、別項目の保存によるrevisionのすり抜けも拒否。通信断は未保存表示と再試行。APIはCSRF・無認証・アップロード中の失効を拒否。
- 別タブでログイン先が変わった場合、古いアカウントの要求を新アカウントへ保存しない。要求本文のaccountIdは認可ではなく一致条件として扱う。
- 稼働中のSQLiteバックアップがWAL内の確定済み個人記録も含み、復元できることを確認。
- 127.0.0.1:5180の隔離QAサーバー・ダミーアカウント・一時DBで旧localStorage取り込みを実操作。青い服・ロボット・ポケモン1種類・事件発見を復元。
- オレンジの服へ変更→保存→再読み込みで復元。別ファイルから2種類のポケモン/2件の事件を取り込み、図鑑が増え、既存のオレンジの服/ロボットが維持されることを確認。元のブラウザデータは削除しない。
- ローカル証跡：`artifacts/account-data-migration.png`（Git対象外）。実ユーザーのデータは検証で変更していない。

## 公開前の4件

1. Caddyが直接接続元CIDRで全Web経路を拒否するテンプレートをTerraformモックで確認。TURNは分離。Slack例外は明示したPOST `/api/slack/events`だけ。
2. SlackだけのAzure配備を拒否。Graphから読むMFAポリシーについて、report-only・ユーザー除外・別アプリ・適用条件付き・MFA OR deviceを拒否する単体試験。
3. VM/独立Managed Disk/Vaultの削除防止、LUN 0マウント必須、日次バックアップ/7日保持を実装しモック検証。
4. 隔離したファイルシステムとコマンドスタブで配備スクリプトを実行。prepare後の外部検査失敗によるrollback、成功commit、初回起動失敗時の停止と設定除去、未マウント時の配備拒否を確認。未確定時の10分自動復旧タイマーも設定。

## コマンド

- `npm run build` / TypeScript検証。
- `npm test`。
- `node --test scripts/azure/deployment-config.test.mjs scripts/azure/activate-release.test.mjs`。
- `npm run infra:check -- --plugin-dir <既存のAzureRMミラー>`。一時コピー、backend無効、Providerモックのみ。
- `bash -n scripts/azure/activate-release.sh` / `node --check scripts/azure/deploy.mjs` / `git diff --check`。

## 残る実環境検証

実AzureでのCIDR拒否、Entra MFA/Graph権限、Azure Backup取得・復元、150接続/30音声の性能・TURNメディア、初回TLS取得は未検証。追加ディスク/Backupの費用も構築時に更新する。今回のテスト結果は実機性能や復元手順の完了を意味しない。
