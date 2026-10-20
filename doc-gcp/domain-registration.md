# Cloud Domainsでの取得とCloud DNS

ドメインの取得・請求とDNSをGCPへまとめます。2026-10-20に`bootstrap-dns`だけをapplyし、`waiwailand-agentoffice.com`を年12 USDで登録しました。登録状態は`ACTIVE`、連絡先プライバシーは`REDACTED_CONTACT_DATA`、DNSSEC・自動更新・移管ロックは有効です。登録者メールの確認は本人の操作待ちです。VM・state用GCS・アプリ公開用Aレコードはまだ作成していません。

登録時には実行先project、CLI/ADC本人、紐づく課金先を照合しました。DNS bootstrapのlocal stateとバックアップ、登録操作の記録はGit対象外で保全しています。再実行時は登録済みドメインへ購入コマンドを送らず、まず既存登録を照会します。

| 対象 | 管理場所 |
|---|---|
| Cloud Domains / Cloud DNS API・DNSSEC付き公開ゾーン | `infra-gcp/bootstrap-dns` / 独立したlocal state |
| ドメインの購入・登録・登録者情報 | Cloud Domains CLI / 手元の権限制限ファイル |
| 固定IPを向けるAレコード | `infra-gcp/environments/dev` / GCS state |
| state用GCS | `infra-gcp/bootstrap` / 別のlocal state |

DNSをVMから独立させ、正式CIDRやVM構築を待たずに取得できます。登録者の会社名・住所・電話をTerraform stateへ残さないため、購入はTerraformで行いません。登録IDは実ドメイン、ゾーン名は`dev-waiwai-tky-dns-office-001`、Aレコード名は実ドメインに末尾`.`を付けたFQDNです。

## 可否・料金と登録者情報

```bash
gcloud domains registrations get-register-parameters YOUR_DOMAIN \
  --project=YOUR_PROJECT_ID --configuration=waiwai-dev --format=json
```

`availability=AVAILABLE`・`yearlyPrice`・`supportedPrivacy`を確認し、選択済みの価格と違う場合や利用不可なら購入しません。今回の.comは年12 USD、`REDACTED_CONTACT_DATA`利用可能と照会できています。通常の少数Cloud DNSゾーンは1ゾーン月0.20 USDと問い合わせ料が別にかかります。ドメイン年12 USD + ゾーン年2.40 USDに、問い合わせ料・請求通貨/税等の条件が加わります。

本人がGit対象外の`.local/gcp/dev/domain-contacts.yaml`に会社名・担当者名・会社住所・国際形式の電話番号を入力します。ファイルは0600で保管し、Git・Terraform変数・チャットへコピーしません。形式は以下です。空欄や架空の情報で登録しません。

```yaml
allContacts:
  email: ops@example.com
  phoneNumber: ''
  postalAddress:
    regionCode: JP
    postalCode: ''
    administrativeArea: ''
    locality: ''
    addressLines: ['']
    organization: ''
    recipients: ['']
```

## DNSの初期設定

`.local/gcp/dev/dns-bootstrap.tfvars.json`に、devと同じproject/name/region/連番/domainをJSONで指定します。HCLの`.example`をそのままJSON拡張子へコピーしません。

```bash
terraform -chdir=infra-gcp/bootstrap-dns init -lockfile=readonly
terraform -chdir=infra-gcp/bootstrap-dns plan \
  -var-file=../../.local/gcp/dev/dns-bootstrap.tfvars.json -out=dns.tfplan
# 作成対象とDNS料金を確認した実行用planだけを使用
terraform -chdir=infra-gcp/bootstrap-dns apply dns.tfplan
terraform -chdir=infra-gcp/bootstrap-dns output
```

API管理2件と署名付きpublic zone1件で、GCSやVMは作りません。NS/SOA・DNSSEC鍵はCloud DNSの生成物です。local stateを安全にバックアップし、複数端末の別stateから同じゾーンを管理しません。CLIで先に有効化したAPIも、同じprojectの有効状態をTerraformで管理します。

## 登録の検証・購入・確認

DNSゾーン作成済み、登録者情報入力済み、実年額が選択済み価格と同じことを確認します。個人情報が出る可能性のあるログはローカルで保護し、チャットへ転載しません。

```bash
waiwai_domain=$(terraform -chdir=infra-gcp/bootstrap-dns output -raw domain)
waiwai_dns_zone=$(terraform -chdir=infra-gcp/bootstrap-dns output -raw zone_name)
gcloud domains registrations register "$waiwai_domain" \
  --project=YOUR_PROJECT_ID --configuration=waiwai-dev \
  --contact-data-from-file=.local/gcp/dev/domain-contacts.yaml \
  --contact-privacy=redacted-contact-data --yearly-price="12.00 USD" \
  --cloud-dns-zone="$waiwai_dns_zone" --validate-only --quiet
```

これは購入しない検証です。成功後、実登録の段階でのみ同じ引数から`--validate-only`を除いて実行します。`public-contact-data`や公開同意フラグには切り替えません。`--cloud-dns-zone`は署名済みゾーンの場合DNSSECも既定で設定します。

失敗・タイムアウトで登録を連打せず、`gcloud domains registrations describe`と操作状況で元の要求を確認します。`ACTIVE`、NSの委任先一致、DNSSEC、連絡先の確認メールと自動更新の設定を確認します。認証コードやメールのパスワードをチャットへ貼りません。Terraformのdestroyで購入済み登録や請求も取り消せる前提にはしません。

## VMとの接続

dev rootは既存ゾーンをdata sourceで読み、`dns_name`がdomain入力と一致するか検証してから、予約した外部IPv4をAレコードへ設定します。ゾーン未作成では実dev planが成功しないため、DNS初期設定が先です。

`.ai`から`.com`への変更前のplanとcallbackを使いません。DNS・正式CIDR・GCS backendを揃えてdevをplanし直し、公開後のAレコード・Caddy証明書・Microsoft/Slackのcallbackを確認します。

## 公式資料

- [Cloud Domains登録手順](https://docs.cloud.google.com/domains/docs/register-domain)
- [登録CLI・連絡先・DNSSEC・validate-only](https://docs.cloud.google.com/sdk/gcloud/reference/domains/registrations/register)
- [Cloud Domains料金](https://cloud.google.com/domains/pricing)
- [Cloud DNS料金](https://cloud.google.com/dns/pricing)
