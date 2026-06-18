# Tokusho — 特定商取引法ページ自動生成アプリ

Shopify merchant向けに、法律で義務付けられた「特定商取引法に基づく表記」ページを自動生成・公開するアプリ。

## セットアップ

### 必要なもの
- Node.js 18以上
- PostgreSQL（またはNeon.tech無料プラン）
- Shopify Partner アカウント（無料）

### 1. インストール
```bash
cd tokusho
npm install
```

### 2. 環境変数の設定
```bash
cp .env.example .env
# .envを編集してShopify API KeyとDB URLを設定
```

### 3. データベースの初期化
```bash
npx prisma migrate dev --name init
```

### 4. 開発サーバー起動
```bash
npm run dev
# → shopify app dev が起動し、ngrokトンネルが自動作成される
```

## プロジェクト構成

```
tokusho/
├── app/
│   ├── routes/
│   │   ├── app.tsx              # AppProvider + NavMenu
│   │   ├── app._index.tsx       # ダッシュボード
│   │   ├── app.setup.tsx        # 事業者情報入力フォーム
│   │   ├── app.preview.tsx      # プレビュー・公開
│   │   └── webhooks.tsx         # Webhookハンドラー
│   ├── lib/
│   │   └── tokushoTemplate.ts   # 特商法HTMLジェネレーター ⭐ コアロジック
│   ├── shopify.server.ts        # Shopify認証設定
│   ├── db.server.ts             # Prismaクライアント
│   └── root.tsx                 # Remixルートレイアウト
├── prisma/
│   └── schema.prisma            # DBスキーマ
├── shopify.app.toml             # Shopifyアプリ設定
└── vite.config.ts
```

## 主要機能

1. **入力フォーム** (`app.setup.tsx`): 事業者情報・販売条件・返品ポリシーを入力
2. **HTMLジェネレーター** (`lib/tokushoTemplate.ts`): 特商法に準拠したHTMLを生成
3. **公開** (`app.preview.tsx`): Shopify Pages APIでストアにページを作成/更新
4. **Webhooks** (`webhooks.tsx`): GDPR必須webhook + アンインストール処理

## 注意事項

- このアプリが生成するページの法的正確性は利用者が確認してください
- 特商法の要件は変更される場合があります。消費者庁のガイドを定期的に確認してください
- 出典: https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html
