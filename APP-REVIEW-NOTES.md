# App Review Notes — Tokusho

> Paste this into Partners Dashboard → App submission → "Instructions for reviewers" (or "App review instructions"). Fill in `<...>` first. English is primary; Japanese UI labels are included so the reviewer can navigate.

---

## What the app does
Tokusho generates the Japanese **「特定商取引法に基づく表記」** (Specified Commercial Transactions Act disclosure) page — a page **legally required for businesses selling online in Japan** — from a simple form, and publishes it to the merchant's storefront as a Shopify **Page** (at `/pages/tokushoho`). The **Pro** plan additionally generates a **Privacy Policy** page (`/pages/privacy-policy`).

The UI is in **Japanese** (target market: Japan).

## Access scopes / data usage
- Scopes requested: **`write_content`, `read_content` only** (to create/update a Shopify Page).
- The app does **NOT** access orders, customers, products, or any **protected customer data**.
- It stores only the merchant's own business/shop configuration (name, address, phone, email, policies), keyed by shop domain.

## How to test (core flow — Free plan)
1. **Install** the app on a development store (standard OAuth; no extra login).
2. You land on the dashboard (**ダッシュボード**) showing a required-fields checklist.
3. Open **事業者情報** (Business info / setup form). Enter business details — you can use sample values:
   - 事業者名: `Test Shop` / 代表者: `Taro Yamada` / 〒150-0002 渋谷区渋谷1-1-1 / TEL `03-1234-5678` / email `test@example.com`. Select payment/delivery/return options.
   - Click **保存してプレビューへ** (Save & preview).
4. On **プレビュー・公開** (Preview/Publish) you see the generated page. Click **ストアに公開する** (Publish to store).
5. Visit `https://<your-test-store>.myshopify.com/pages/tokushoho` — the disclosure page is live.
   - On the **Free** plan, the page shows a small **"Powered by Tokusho"** line in the footer.

## How to test billing
1. Open **プラン・お支払い** (Plans & Billing) — or `/app/billing`.
2. Plans:
   - **Basic ($3.99/mo)** — removes the "Powered by Tokusho" footer.
   - **Pro ($7.99/mo)** — unlocks the Privacy Policy generator.
3. Click **アップグレード** (Upgrade) → a Shopify subscription approval screen appears. **During review this is a test charge — you are not charged.** Approve it.
4. Verify:
   - After **Basic+**: re-publish the page (step 4 above) → the "Powered by Tokusho" footer is gone.
   - After **Pro**: open **プライバシーポリシー** (Privacy Policy) → the generator form is now accessible. Fill it and publish → page appears at `/pages/privacy-policy`. (On Free/Basic this menu shows a Pro upsell screen, by design.)

## Mandatory compliance (GDPR) webhooks
Implemented at `/webhooks`: `customers/data_request`, `customers/redact`, `shop/redact`, `app/uninstalled`.
- The app stores **no end-customer personal data**, so customer data-request/redact have no customer data to return or delete (they return `200`).
- `shop/redact` deletes the merchant's stored configuration.
- `app/uninstalled` removes the session.

## Notes
- The generated pages are **drafts based on the 消費者庁 (Consumer Affairs Agency) guideline**. The app shows an in-app disclaimer that **legal accuracy is the merchant's responsibility**; it does not claim to guarantee compliance.
- Embedded app (App Bridge, session-token auth). Hosted on Google Cloud Run.
- Privacy policy URL: `<hosted PRIVACY.md URL>`
- Support email: `<support email>`

## Test store (if you need one provided)
- `<provide a test/dev store + staff login if Shopify requests, otherwise reviewers use their own>`
