# Tokusho — App Store 提出前チェックリスト

> 凡例: ✅ 済 / ⚠️ 要対応（人間） / ❓ 要確認（やったか未確認）
> 提出ブロッカー（必須）は **[BLOCKER]** で示す。

## A. デプロイ / インフラ
- ✅ Cloud Run (asia-northeast1) + Supabase (Tokyo) で稼働、継続デプロイ（GitHub main）
- ⚠️ **[BLOCKER] 最新マイグレーションを適用**: `npx prisma migrate deploy`
  （未適用だと事業者情報の保存でエラー。最新 = `20260622000000_add_law_alert_optout`）
- ❓ Cloud Run 環境変数の確認: `SHOPIFY_API_KEY / SHOPIFY_API_SECRET / DATABASE_URL / DIRECT_URL / SCOPES / SESSION_SECRET / SHOPIFY_APP_URL / NODE_ENV=production`
- 任意（高速化）: Cloud Run min-instances=1 + Startup CPU boost

## B. 課金（Shopify Managed Pricing）
- ⚠️ **[BLOCKER] Partner Dashboard で本番プランを作成**: Free / Pro
  - Pro: アプリ内表示と一致させる（**$49.99/年 ＋ $4.99/月**）。価格を変える場合は `app.billing.tsx` も合わせる
  - **Pro プラン名に "Pro" を含める**（`/pro/i` ゲート用）／各プラン **Display name** を入力／**Redirect URL = `/app`**
  - 現状はテスト用 private プランのみ → 本番 public プランが必要
- ⚠️ **[BLOCKER] `SHOPIFY_BILLING_TEST` を `false`（または削除）** にする（本番で実課金が計上されるように）

## C. スコープ / 権限
- ⚠️ **read_products の扱いを決定**:
  - 残す場合 → Cloud Run `SCOPES` に `read_products` を追加 + `shopify app deploy` + 再インストール（審査で用途を聞かれる：デジタル/サブスク判定のみ・非保存）
  - 使わない場合 → toml から `read_products` を外す（販売形態の自動判定機能は無効化）
- ✅ 顧客個人データ非取得（Protected Customer Data 審査を回避）

## D. App listing コンテンツ
- ⚠️ アプリ名 / タグライン / 説明文（`LISTING.md`、誇大・「保証」表現を避ける）最終確認
- ⚠️ アプリアイコン 1024×1024（`app-icon-1024.png`）
- ✅ Feature media 1600×900（`feature-media-1600x900.png`）
- ⚠️ **スクリーンショット 3枚以上（1600×900）** — 実機キャプチャ（DevТools DPR=1）
- ⚠️ FAQ（`FAQ.md`）/ カテゴリ / 言語（日本語・英語）
- ✅ Support email: ren.ban.kan.ite2019@gmail.com
- ✅ **Privacy policy URL**: `https://tokusho-1067783089991.asia-northeast1.run.app/legal/privacy`（ホスト不要）
- 任意: 利用規約 URL `…/legal/terms`

## E. 審査情報（App testing information）
- ⚠️ 「My app doesn't require an account to use it」にチェック（空の Login 枠は Delete）
- ⚠️ Testing instructions に **`REVIEW-INSTRUCTIONS.md`（1,679字・上限2,800）** を貼り付け
- ⚠️ Pro 機能の確認方法を記載済み（Pro プラン選択＝テスト課金）

## F. コンプライアンス / Webhook
- ✅ 必須 Webhook（customers/data_request, customers/redact, shop/redact, app/uninstalled）を `/webhooks` で実装＋toml の `privacy_compliance` で宣言
- ✅ アプリのプライバシーポリシー（`/legal/privacy`・日本語）／利用規約（`/legal/terms`）に提供者情報を記入済み（レーンバンカン）

## G. 法務（最重要・要専門家）
- ⚠️ **[要弁護士] テンプレート（特商法・privacy・返品等）＋ 利用規約 ＋ アプリのprivacy ＋ 非弁(弁護士法72条) ＋ 広告表現** をレビュー（`LAWYER-REVIEW-REQUEST.md`）。全て DRAFT
- ⚠️ **提供者自身の特商法表記**（個人事業主レーンバンカンとして有料アプリを販売 → 通信販売の表示義務。氏名・住所・電話が必要）— 未作成
- ❓ `利用規約` の賠償上限（金3,000円）・管轄（東京地方裁判所）を最終確認

## H. セキュリティ
- ❓ **[要確認] 漏えいした秘密情報のローテーション**: `SHOPIFY_API_SECRET` / DB パスワード / `SESSION_SECRET`（平文露出していた）。実施済みか未確認

## I. 表示の最終化（任意だが推奨）
- ⚠️ dev store のページを **再公開**（タイトル重複解消・返品表・ラベル高さ等の最新テンプレを反映）→ スクショ撮影に使う
- ⚠️ dev store のテストデータ（テスト商店 等）を実データに（「事業者情報から再取込」→保存）

## J. 任意（運用・将来）
- 法令監視メール（自分宛）: `RESEND_API_KEY` + `LAW_ALERT_EMAIL_TO`(=Resend登録メール) + Cloud Scheduler `/cron/check-law`（ドメイン不要）
- merchant 向けメール: ドメイン取得後に `MAIL_FROM` 設定（現在は休止・banner で代替）

---

### 提出までの最短ルート（ブロッカーのみ）
1. `prisma migrate deploy`（A）
2. 本番 Free/Pro プラン作成（B）＋ `SHOPIFY_BILLING_TEST=false`（B）
3. read_products を残すか決定（C）
4. スクショ3枚＋アイコン（D）／審査情報入力（E）
5. **弁護士レビュー（G）＋ 提供者自身の特商法表記（G）** ← 商用前に必須
6. 秘密情報ローテーション確認（H）
