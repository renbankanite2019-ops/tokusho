# Privacy Policy — Tokusho (特定商取引法ページ自動生成アプリ)

> **DRAFT — requires review before publishing.** This draft is AI-assisted. Have it reviewed by a person (and, for the Japanese market, ideally a 専門家) before you host it and submit it as your App Store privacy policy URL. Verify every statement matches what the app actually does at launch.

**Last updated:** <!-- fill in date when you publish -->
**App:** Tokusho
**Provider:** <!-- your legal/business name -->
**Contact:** <!-- your support email -->

---

## 1. Overview

Tokusho ("the App") helps Shopify merchants create and publish a Japanese
"特定商取引法に基づく表記" (Specified Commercial Transactions Act disclosure)
page on their own storefront. This policy explains what data the App processes,
why, and how it is protected.

## 2. Data we collect

The App collects only the data needed to generate and publish the disclosure page:

**a) Shopify store information**
- Store domain (`*.myshopify.com`)
- Shopify session and OAuth access token (used to call the Shopify Admin API on your behalf)

**b) Business information you enter into the App**
- Business type (individual / corporation)
- Seller / corporation name, representative name, person responsible for mail-order sales
- Postal code, address, building name
- Phone number, email address, website URL
- Sales, payment, delivery, return/refund, and other commercial-transaction terms you type in

This information is, by design, **published publicly** on your storefront's
disclosure page — that is the purpose of the App and a legal requirement for
online sellers in Japan.

## 3. Data we do NOT collect

- The App does **not** access, store, or process your customers' personal data.
- The App does **not** read orders, customer records, or payment data.
- It requests `write_content` and `read_content` (to create/update the disclosure Page)
  and `read_products`. `read_products` is used only to detect whether the store sells
  digital goods or subscriptions, so the App can suggest the right disclosure fields;
  product information is read at that moment only and is **not stored**.

## 4. How we use data

- To generate the disclosure-page HTML from the information you enter.
- To create and update that page on your Shopify storefront via the Shopify Admin API.
- To remember your settings so you can edit and re-publish later.

We do **not** sell your data or use it for advertising.

## 5. Storage and security

- Data is stored in a PostgreSQL database (Neon).
- The Shopify access token is stored server-side and is not exposed to the browser.
- All communication uses HTTPS. Webhooks are verified with Shopify HMAC signatures.

## 6. Third parties

The App relies on these service providers to operate:
- **Shopify** — platform, authentication, and the Admin API.
- **Supabase** — database hosting (PostgreSQL, Tokyo / ap-northeast-1 region).
- **Google Cloud Run** — application hosting (Tokyo / asia-northeast1 region).
- **e-Gov 法令API (Digital Agency, Japan)** — queried to detect changes to monitored laws (no personal data is sent).
- **Resend** — transactional email delivery for operator notifications (only if configured).

Each processes data only to provide their service. Review their respective
privacy policies for details.

## 7. Data retention and deletion

- When you uninstall the App, your Shopify session is deleted.
- When Shopify sends a `shop/redact` request (about 48 hours after uninstall),
  your stored business configuration is deleted.
- You can request deletion of your data at any time by contacting us.
- The disclosure page already published to your storefront is your store content;
  manage or delete it from your Shopify admin.

## 8. GDPR / APPI compliance

The App implements Shopify's mandatory compliance webhooks
(`customers/data_request`, `customers/redact`, `shop/redact`). Because the App
does not store end-customer personal data, customer data requests and redactions
have no customer data to return or delete; shop redaction deletes your stored
configuration as described above.

## 9. Your responsibilities

The App assists with drafting the disclosure page from the information you provide.
**You are responsible for the legal accuracy and completeness of your page.**
Consult a qualified professional (専門家) if you need to confirm compliance.

## 10. Changes to this policy

We may update this policy. Material changes will be reflected by the "Last updated"
date above.

## 11. Contact

Questions about this policy: <!-- your support email -->
