Tokusho generates the Japanese "特定商取引法に基づく表記" (legal disclosure) page from a form and publishes it to the merchant's storefront. No separate account is needed — it uses Shopify session auth only.

Scopes: write_content + read_content (create/update a Page) and read_products (only to detect digital/subscription products and suggest the right fields; not stored). No access to orders, customers, or payment data.

SETUP & PUBLISH
1. Open the app → 事業者情報 (Business info).
2. In かんたん設定 (Quick setup), pick a sales type, e.g. 物理商品（個人事業主）. Optionally click 「Shopify設定から取込む」 to auto-fill name/address from store settings.
3. Fill required fields, or use samples: 事業者名 = Test Shop / 〒150-0002 渋谷区渋谷1-1-1 / TEL 03-1234-5678 / email test@example.com. Click 保存 (Save).
4. Go to プレビュー・公開 (Preview/Publish) → review → click ストアに公開する (Publish).
5. Page is live at /pages/tokushoho (no watermark on any plan).

BILLING (Shopify Managed Pricing — the app does NOT call the Billing API). Two plans: Free and Pro.
6. Open プラン・お支払い → click 「プランを選択・変更する」 → you are redirected to Shopify's hosted plan page.
7. Select the Pro plan ($49.99/yr or $4.99/mo) and approve. On a development store this is a TEST charge — you are not billed — and it unlocks all Pro features (no account needed).
   - Pro adds: design customization, JA/EN bilingual labels, Privacy Policy generator, extra pages (会社概要 / お問い合わせ / 返品ポリシー), one-click "generate all 5 pages".
8. Verify: re-publish to see design/bilingual applied; the プライバシーポリシー and 追加ページ menus become usable (Free shows a Pro upsell screen).

COMPLIANCE
Webhooks at /webhooks: customers/data_request, customers/redact, shop/redact, app/uninstalled. The app stores no end-customer data.

Contact: ren.ban.kan.ite2019@gmail.com
