// 提供者（アプリ運営者）向けの法務ページの内容。
// ↓ この3つを自社の情報に置き換えてください（置き換え後に再デプロイで反映）。
export const LEGAL = {
  companyName: "〈当社の正式名称〉",
  contactEmail: "〈support@example.com〉",
  effectiveDate: "〈YYYY年MM月DD日〉",
};

const C = LEGAL;

/** アプリ提供者のプライバシーポリシー（リスティングの Privacy policy URL 用） */
export function privacyHtml(): string {
  return `
  <h1>Privacy Policy — Tokusho</h1>
  <p class="meta">Provider: ${C.companyName} ・ Last updated: ${C.effectiveDate} ・ Contact: ${C.contactEmail}</p>

  <h2>1. Overview</h2>
  <p>Tokusho ("the App") helps Shopify merchants create and publish a Japanese
  "特定商取引法に基づく表記" (Specified Commercial Transactions Act disclosure) page,
  and (Pro plan) a Privacy Policy page, on their own storefront. This policy explains
  what data the App processes and how it is protected.</p>

  <h2>2. Data we collect</h2>
  <ul>
    <li>Shopify store domain and the OAuth access/session token (to call the Shopify Admin API on your behalf).</li>
    <li>Business information you enter into the App: business type, seller/representative name, address,
    phone, email, website, and your commercial-transaction policies. This information is, by design,
    published publicly on your storefront disclosure page.</li>
  </ul>

  <h2>3. Data we do NOT collect</h2>
  <p>The App does not access, store, or process your customers' personal data, orders, products, or payment data.
  It requests only the <code>write_content</code> and <code>read_content</code> scopes (to create/update a Page).</p>

  <h2>4. How we use data</h2>
  <p>To generate the disclosure-page content from your input, create/update that page on your storefront via the
  Shopify Admin API, and remember your settings so you can edit and re-publish. We do not sell your data or use it
  for advertising.</p>

  <h2>5. Storage and security</h2>
  <p>Data is stored in a managed PostgreSQL database. The Shopify access token is stored server-side and not exposed
  to the browser. All communication uses HTTPS; webhooks are verified with Shopify HMAC signatures.</p>

  <h2>6. Third-party processors</h2>
  <p>The App relies on Shopify (platform/authentication/Admin API), a database host, and an application host to
  operate. Each processes data only to provide their service.</p>

  <h2>7. Data retention and deletion</h2>
  <p>On uninstall, your Shopify session is deleted. On Shopify's <code>shop/redact</code> request (about 48 hours
  after uninstall), your stored configuration is deleted. You may request deletion at any time via the contact below.
  Any page already published to your storefront is your store content; manage or delete it from your Shopify admin.</p>

  <h2>8. GDPR / APPI compliance</h2>
  <p>The App implements Shopify's mandatory compliance webhooks (customers/data_request, customers/redact, shop/redact).
  Because the App stores no end-customer personal data, customer data requests/redactions have no customer data to return
  or delete; shop redaction deletes your stored configuration.</p>

  <h2>9. Your responsibilities</h2>
  <p>The App assists with drafting the disclosure page from the information you provide. You are responsible for the legal
  accuracy and completeness of your page. Consult a qualified professional if needed.</p>

  <h2>10. Changes</h2>
  <p>We may update this policy; material changes are reflected by the "Last updated" date above.</p>

  <h2>11. Contact</h2>
  <p>${C.contactEmail}</p>
  `;
}

/** アプリ利用規約（マーチャント＝事業者向け / BtoB） */
export function termsHtml(): string {
  return `
  <h1>アプリ利用規約（Tokusho）</h1>
  <p class="meta">提供者：${C.companyName} ・ 制定日：${C.effectiveDate} ・ お問い合わせ：${C.contactEmail}</p>
  <p>本規約は<strong>事業者（マーチャント）向け（BtoB）</strong>であり、エンドユーザー（消費者）向けの表記とは別です。</p>

  <h2>第1条（適用）</h2>
  <p>本規約は、当社が提供する Shopify アプリ「Tokusho」（以下「本アプリ」）の利用に関する一切に適用されます。利用者は本アプリをインストールした時点で本規約に同意したものとみなされます。</p>

  <h2>第2条（本アプリの内容）</h2>
  <p>本アプリは、利用者が入力する情報をもとに、特定商取引法に基づく表記ページ等のひな形の作成・公開を補助するツールです。生成物の法的な正確性・完全性・最新性、法令適合を保証しません。</p>

  <h2>第3条（料金）</h2>
  <p>料金は当社が定めるプラン（無料／有料）に従い Shopify の課金機能を通じて請求されます。支払済みの料金は法令上必要な場合を除き返金されません。</p>

  <h2>第4条（利用者の責任）</h2>
  <p>利用者は、入力情報の正確性を自己の責任で確保します。生成物の内容が実際の取引条件・事業形態および適用法令（特定商取引法・個人情報保護法・景品表示法等）に適合しているかの最終確認は利用者自身の責任で行い、必要に応じて専門家に相談するものとします。生成物の公開・使用に起因する結果は利用者が責任を負います。</p>

  <h2>第5条（免責・保証の否認）</h2>
  <p>本アプリおよび生成物は「現状有姿（AS IS）」で提供され、当社は商品性・特定目的適合性・正確性・完全性・継続性その他一切の保証を行いません。法改正への自動的な追随も保証しません。</p>

  <h2>第6条（責任の制限）</h2>
  <p>当社は、本アプリの利用に起因して利用者に生じた損害（行政指導・処分、第三者との紛争、逸失利益、データ消失を含む）について、当社の故意・重過失による場合を除き責任を負いません。当社が責任を負う場合でも、賠償額は損害発生時から遡って過去12か月間に利用者が支払った利用料金の総額（無料プランは金〈3,000〉円）を上限とし、間接・特別・結果的損害は対象外とします。本条は利用者が事業者であることを前提とした合意です。</p>

  <h2>第7条（知的財産権）</h2>
  <p>本アプリに関する知的財産権は当社または正当な権利者に帰属します。当社は、利用者が生成物を自己のストアの表示目的で使用することを許諾します。本アプリ自体の複製・改変・再配布は禁止します。</p>

  <h2>第8条（禁止事項）</h2>
  <p>法令・公序良俗違反、第三者の権利侵害、リバースエンジニアリング・不正アクセス、運営妨害、虚偽情報の入力等を禁止します。</p>

  <h2>第9条（変更・中断・終了）</h2>
  <p>当社は事前通知なく本アプリの内容変更・中断・終了ができます。これに起因する損害について当社は第6条の範囲で責任を負います。</p>

  <h2>第10条（個人情報の取扱い）</h2>
  <p>当社による情報の取扱いはプライバシーポリシーに従います。本アプリは表記ページ作成に必要な事業者の情報のみを扱い、利用者の顧客の個人情報にはアクセスしません。</p>

  <h2>第11条（反社会的勢力の排除）</h2>
  <p>利用者は反社会的勢力に該当せず関係を有しないことを表明・保証します。違反時は通知なく利用を停止できます。</p>

  <h2>第12条（本規約の変更）</h2>
  <p>当社は必要に応じ、通知または本アプリ上での掲示により本規約を変更できます。変更後の利用継続をもって同意とみなします。</p>

  <h2>第13条（準拠法・管轄）</h2>
  <p>本規約の準拠法は日本法とし、本アプリまたは本規約に関する紛争は<strong>〈東京地方裁判所〉</strong>を第一審の専属的合意管轄裁判所とします。</p>

  <h2>第14条（お問い合わせ）</h2>
  <p>${C.contactEmail}</p>
  `;
}
