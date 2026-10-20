# Identity Platformのログイン・招待・MFA

GCP公開時はIdentity Platformのメールアドレス・パスワードとTOTP（認証アプリの6桁コード）を使用します。利用者のGoogle/Microsoftアカウントは不要です。Slack/Entraの既存コードは他環境向けに残しますが、Identity Platformを選択したサーバーでは迂回入室できません。実装・ローカル検証までが今回の範囲で、API有効化・Terraform apply・実ユーザー作成・招待メール送信は行いません。

## 基盤と権限

dev rootの`identity_platform_config.tf`でメール・パスワード認証を有効化し、自己登録・自己削除・匿名・電話認証を無効にします。許可ドメインはWaiwaiの公開ドメインだけです。MFAのTOTPプロバイダーを有効にし、隣接時間窓は1に設定します。初回のMFA登録を可能にするためGCP設定のstateは`ENABLED`とし、**Waiwaiの入室判定は常にTOTP必須**にします。MFA未登録の一次認証ではオフィスのセッションを発行しません。

`identitytoolkit.googleapis.com`・`securetoken.googleapis.com`・`iam.googleapis.com`を追加します。VMには専用サービスアカウントを付け、カスタムロールで`firebaseauth.users.get`だけを許可します。ユーザー作成・招待許可・MFA解除・メール送信の権限はアプリに与えません。JSON鍵を作らず、VMのADCを使います。VM以外からのローカル検証はモックで行い、公開用の設定でAuthentication Emulatorを使うことは禁止します。

Identity Platformのconfigは**プロジェクトに1つ**の設定です。既に利用中なら無断で新規作成・上書きせず、現状を照会してimportと差分・他アプリへの影響を確認します。共有プロジェクトの自己登録等を変更できない場合は、専用プロジェクトまたは認証tenantの分離を設計し直してからapplyします。`prevent_destroy`を有効にしています。

## 配備設定

権限制限した`/etc/waiwai/app.env`に以下を設定します。Terraform出力の`identity_project_id`・`identity_origin`・`identity_api_key`を対応させます。公開Web SDKのAPI keyは利用者へ返される設定値で、アカウントのパスワードやサービスアカウント秘密鍵ではありません。ただしstateには含まれるためstateのアクセス制限を維持します。

```dotenv
REQUIRE_IDENTITY_PLATFORM_LOGIN=true
GCIP_PROJECT_ID=your-project-id
GCIP_API_KEY=your-identity-platform-web-api-key
GCIP_ORIGIN=https://waiwai-dev.example.com
REQUIRE_ENTRA_LOGIN=false
REQUIRE_SLACK_LOGIN=false
WAIWAI_ADMIN_ACCOUNT_ID=gcip:your-project-id:ADMIN_UID
# 旧アカウントのデータを引き継ぐ場合だけ指定
GCIP_ACCOUNT_LINKS_FILE=/etc/waiwai/identity-account-links.json
```

全ての必須値が揃わない場合や必須プロバイダーが競合した場合は起動を拒否します。管理者IDは招待時に得る固定UIDから設定します。メール一致で管理者にする処理はありません。管理者自身もメール確認とTOTPが必要です。新規ユーザーはログイン後、既存の「サーバーと所属を管理」で参加サーバーを割り当てます。招待許可だけで全チームのサーバーが見える設計にはしません。

## 管理者による招待

アプリVMではなく、管理者のMac/管理端末でADCを使います。操作者は選択先projectを確認し、ユーザー管理に必要な権限を持つアカウントで実行します。これはクラウドのユーザーを作成する操作なので、**今回の準備作業では実行していません**。

`identity-invite.json.example`をGit対象外へコピーして招待先を入力します。初回は`action=invite`とし、既存メールのユーザーを自動で採用しません。結果は新規の0600ファイルに保存します。

```bash
node scripts/gcp/invite.ts \
  --project YOUR_PROJECT_ID \
  --origin https://YOUR_DOMAIN \
  --input .local/gcp/dev/invite.json \
  --output .local/gcp/dev/invitation.json
```

管理者が作成したユーザーには`waiwaiInvited=true`の署名付きカスタムclaimを付けます。初期パスワードはランダムで、本人にも管理者にも表示しません。結果ファイルにパスワード設定・メール確認の2つの一時URLとUIDを保存します。URLはWaiwaiの同じoriginにある専用処理へ向けます。リンクは認証用の機密情報として扱い、管理者が本人へ会社で認められた経路で渡します。スクリプトからのメール自動送信は行いません。

再発行は`action=reissue`、招待取消は`action=revoke`に変更し、初回結果にある正確な`uid`とメールを指定して、新しい出力ファイルへ実行します。取消はclaimを解除してrefresh tokenを失効させます。失敗時はユーザーの一部作成済みの可能性があるため、コンソールで状態を確認してから再試行します。停止・MFA紛失対応は本人確認した管理者がIdentity Platformで行い、メールだけを根拠にMFAを解除しません。

## 利用者の操作

1. 招待URLで12文字以上のパスワードを設定し、メール確認URLを開く。
2. 「メールアドレスでログイン」からメール・パスワードを入力する。
3. 初回はQRコードまたは手入力キーを認証アプリへ登録し、6桁コードで登録を確定する。同じスマホならアプリを開くリンクも利用できる。
4. 登録後に改めてパスワードと認証コードでログインし、入室する。2回目以降はコード認証だけでMFA登録をやり直さない。

メール未確認の場合は確認メールの送信と再ログインを案内します。パスワード再設定も可能です。Identity Platformの標準メール配信・テンプレート・送信元とリンク到達を実環境で確認します。コード・キー・トークンは画面を閉じると破棄し、Web SDKのpersistenceはメモリのみです。パスワードやrefresh tokenをlocalStorage/sessionStorageへ保存しません。

## セッション・失効・データ引継ぎ

クライアントから受け取るID tokenはFirebase Admin SDKで署名・issuer・audience・期限・失効を検証し、直近5分以内のパスワード＋TOTP認証、メール確認、招待claim、現在のユーザー状態を追加確認します。Origin・Host・一回限りのCSRF flowも検査します。成功時にランダムなHttpOnly/Secure/SameSite=Strict Cookieを発行し、サーバー内に最大8時間のセッションを保持します。ID tokenは保持しません。再起動時は再ログインになります。

招待取消・アカウント停止・refresh token失効・TOTP解除を定期確認し、通常30秒のチェックでセッションを失効させ、既存のリアルタイム接続にも通知します。最終確認から60秒経ったセッションは再検証未完了でも拒否します。認証APIが失敗した場合もゲスト扱いにしません。

新規IDは`gcip:<project-id>:<UID>`で、名前やメールを変えてもチャット・個人設定の保存先は変わりません。既存アカウントの引継ぎは、管理者が`identity-account-links.json.example`を元に**UID → 旧Slack/Entra固定ID**の対応を確認してファイルへ記載します。1対1以外は起動を拒否します。同じメールというだけで自動統合しません。

紐付けた場合は旧IDをそのまま返すため、アバター・バディ・図鑑・誕生日・DM履歴・サーバー所属・既存の固定管理者IDを引き続き参照できます。紐付けを変更するときはアプリを止め、データと設定をバックアップして再起動し、旧・新ログインの同時書き込みを避けます。ブラウザのみのデータは既存の個人データ取り込み機能を使います。

## 公開前の実機確認

Terraform・アプリのモック検証では、GCPの実メール配送、認証アプリでのTOTP、IAM許可、制限付き回線からGoogle認証APIへの通信は保証できません。applyと配備の許可後に、実ユーザーで登録→メール確認→MFA→入室→取消/切断→復旧、スマホ操作とデータ引継ぎを受け入れ試験します。招待先全員のGoogleアカウントやMicrosoftテナントを用意する工程はありません。

公式資料：[認証方式](https://docs.cloud.google.com/identity-platform/docs/concepts-authentication)、[TOTP MFA](https://docs.cloud.google.com/identity-platform/docs/admin/enabling-totp-mfa)、[ID token検証](https://firebase.google.com/docs/auth/admin/verify-id-tokens)、[メール操作リンク](https://firebase.google.com/docs/auth/admin/email-action-links)。
