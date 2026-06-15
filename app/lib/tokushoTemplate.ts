import type { ShopConfig } from "@prisma/client";

/** HTMLの特殊文字をエスケープしてインジェクションを防ぐ */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 支払方法の日本語ラベル
const PAYMENT_LABELS: Record<string, string> = {
  credit_card: "クレジットカード（VISA・Mastercard・JCB・AMEX）",
  convenience: "コンビニ払い",
  bank_transfer: "銀行振込",
  cash_on_delivery: "代金引換",
  paypay: "PayPay",
  line_pay: "LINE Pay",
  amazon_pay: "Amazon Pay",
  shopify_payments: "Shopify Payments",
};

// 返品送料負担の日本語
const SHIPPING_BURDEN_LABELS: Record<string, string> = {
  CUSTOMER: "お客様ご負担",
  SELLER: "当店負担",
  DEPENDS: "初期不良・当店都合による場合は当店負担、お客様都合による場合はお客様ご負担",
};

/**
 * 特定商取引法に基づく表記ページのHTMLを生成する
 * 消費者庁ガイドライン 法第11条 広告の表示事項に基づく
 * 出典: https://www.no-trouble.caa.go.jp/what/mailorder/
 */
export function generateTokushoHtml(
  config: ShopConfig,
  opts: { hideWatermark?: boolean } = {}
): string {
  const {
    businessType,
    sellerName,
    representativeName,
    responsibleName,
    postalCode,
    prefecture,
    address,
    buildingName,
    phone,
    email,
    websiteUrl,
    salesPrice,
    shippingFee,
    paymentMethods,
    paymentTiming,
    deliveryTiming,
    returnPolicy,
    returnDeadline,
    returnCondition,
    returnShipping,
    returnNote,
    otherCosts,
    softwareRequirements,
    subscriptionTerms,
    specialConditions,
    contactNote,
    applicationPeriod,
    contractLiability,
  } = config;

  // 住所の組み立て
  const fullAddress = [
    postalCode ? `〒${postalCode}` : "",
    prefecture || "",
    address,
    buildingName || "",
  ]
    .filter(Boolean)
    .join(" ");

  // 支払方法リスト
  const paymentList =
    paymentMethods.length > 0
      ? paymentMethods
          .map((m) => PAYMENT_LABELS[m] || m)
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("\n")
      : "<li>クレジットカード</li>";

  // 返品ポリシー
  let returnPolicyText = "";
  if (returnPolicy === "NO_RETURN") {
    returnPolicyText = `
      <p>商品の性質上、原則として返品・交換はお受けしておりません。<br>
      ただし、商品の破損・汚損・誤送等、当店の不備による場合は、商品到着後8日以内にご連絡ください。<br>
      返送料は当店が負担いたします。</p>
    `;
  } else {
    returnPolicyText = `
      <table>
        <tr><th>返品期限</th><td>${escapeHtml(returnDeadline)}</td></tr>
        <tr><th>返品条件</th><td>${escapeHtml(returnCondition)}</td></tr>
        <tr><th>返品送料</th><td>${escapeHtml(SHIPPING_BURDEN_LABELS[returnShipping] || returnShipping)}</td></tr>
        ${returnNote ? `<tr><th>備考</th><td>${escapeHtml(returnNote)}</td></tr>` : ""}
      </table>
    `;
  }

  // エスケープ済みの値を用意
  const safeSellerName = escapeHtml(sellerName);
  const safeRepName = escapeHtml(representativeName);
  const safeRespName = escapeHtml(responsibleName);
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  // http(s) スキームのURLのみ許可（javascript: 等のスキームによるXSSを防ぐ）
  const safeWebsite =
    websiteUrl && /^https?:\/\//i.test(websiteUrl) ? escapeHtml(websiteUrl) : "";
  const safeSalesPrice = escapeHtml(salesPrice);
  const safeShippingFee = escapeHtml(shippingFee);
  const safeOtherCosts = escapeHtml(otherCosts);
  const safePaymentTiming = escapeHtml(paymentTiming);
  const safeDeliveryTiming = escapeHtml(deliveryTiming);
  const safeSoftware = escapeHtml(softwareRequirements);
  const safeSubscription = escapeHtml(subscriptionTerms);
  const safeSpecial = escapeHtml(specialConditions);
  const safeContact = escapeHtml(contactNote);
  const safeApplicationPeriod = escapeHtml(applicationPeriod);
  const safeContractLiability = escapeHtml(contractLiability);

  // 事業者情報の行を組み立てる
  // 法人: 法人名 + 代表者名、個人: 販売業者名。通信販売責任者は種別に関わらず入力があれば表示。
  const businessRows =
    businessType === "CORPORATION"
      ? `<tr><th>販売業者（法人名）</th><td>${safeSellerName}</td></tr>
      ${safeRepName ? `<tr><th>代表者名</th><td>${safeRepName}</td></tr>` : ""}`
      : `<tr><th>販売業者</th><td>${safeSellerName}</td></tr>`;
  const businessInfo = `${businessRows}
      ${safeRespName ? `<tr><th>通信販売責任者</th><td>${safeRespName}</td></tr>` : ""}`;

  // 最終更新日は実際の公開/更新日時を表示する（プレビューのたびに変わらないようにする）
  const updatedSource = config.lastPublishedAt ?? config.updatedAt ?? null;
  const now = (updatedSource ? new Date(updatedSource) : new Date()).toLocaleDateString(
    "ja-JP",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return `
<div class="tokusho-container">
  <h1>特定商取引法に基づく表記</h1>
  <p class="tokusho-updated">最終更新日：${now}</p>

  <table class="tokusho-table">
    ${businessInfo}
    <tr><th>所在地</th><td>${escapeHtml(fullAddress)}</td></tr>
    <tr><th>電話番号</th><td>${safePhone}</td></tr>
    <tr>
      <th>メールアドレス</th>
      <td><a href="mailto:${safeEmail}">${safeEmail}</a></td>
    </tr>
    ${safeWebsite ? `<tr><th>ウェブサイト</th><td><a href="${safeWebsite}">${safeWebsite}</a></td></tr>` : ""}

    <tr><th>販売価格</th><td>${safeSalesPrice}${/税/.test(salesPrice) ? "" : "（税込）"}</td></tr>
    <tr><th>送料</th><td>${safeShippingFee}</td></tr>
    ${safeOtherCosts ? `<tr><th>商品代金以外の費用</th><td>${safeOtherCosts}</td></tr>` : ""}

    <tr>
      <th>お支払い方法</th>
      <td><ul>${paymentList}</ul></td>
    </tr>
    <tr><th>お支払い時期</th><td>${safePaymentTiming}</td></tr>
    <tr><th>商品のお届け</th><td>${safeDeliveryTiming}</td></tr>
    ${safeApplicationPeriod ? `<tr><th>申込みの有効期限</th><td>${safeApplicationPeriod}</td></tr>` : ""}

    <tr>
      <th>返品・交換について</th>
      <td>${returnPolicyText}</td>
    </tr>
    ${safeContractLiability ? `<tr><th>契約不適合責任</th><td>${safeContractLiability}</td></tr>` : ""}

    ${safeSoftware ? `<tr><th>動作環境</th><td>${safeSoftware}</td></tr>` : ""}
    ${safeSubscription ? `<tr><th>継続契約について</th><td>${safeSubscription}</td></tr>` : ""}
    ${safeSpecial ? `<tr><th>特別な販売条件</th><td>${safeSpecial}</td></tr>` : ""}

    <tr>
      <th>お問い合わせ</th>
      <td>
        ${safeContact || "ご不明な点は下記までお気軽にお問い合わせください。"}<br>
        <strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a><br>
        <strong>TEL:</strong> ${safePhone}
      </td>
    </tr>
  </table>

  <p class="tokusho-note">
    ※ 本表記は特定商取引法（法第11条）に基づき作成しています。
  </p>
  ${opts.hideWatermark ? "" : `<p class="tokusho-powered">Powered by <strong>Tokusho</strong></p>`}
</div>

<style>
.tokusho-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
  line-height: 1.8;
}
.tokusho-updated {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 24px;
}
.tokusho-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}
.tokusho-table th,
.tokusho-table td {
  border: 1px solid #ddd;
  padding: 12px 16px;
  text-align: left;
  vertical-align: top;
}
.tokusho-table th {
  background: #f5f5f5;
  white-space: nowrap;
  width: 200px;
  font-weight: bold;
}
.tokusho-table ul {
  margin: 0;
  padding-left: 20px;
}
.tokusho-note {
  color: #666;
  font-size: 0.85em;
}
.tokusho-powered {
  margin-top: 16px;
  text-align: center;
  color: #999;
  font-size: 0.8em;
}
@media (max-width: 600px) {
  .tokusho-table th {
    width: auto;
    display: block;
    border-bottom: none;
  }
  .tokusho-table td {
    display: block;
  }
}
</style>
`.trim();
}

/**
 * 特商法ページに必要な情報が揃っているかバリデーション
 * 返り値: エラーメッセージの配列（空なら問題なし）
 */
export function validateConfig(config: Partial<ShopConfig>): string[] {
  const errors: string[] = [];

  if (!config.sellerName?.trim()) errors.push("販売業者名は必須です");
  if (!config.address?.trim()) errors.push("所在地は必須です");
  if (!config.phone?.trim()) errors.push("電話番号は必須です");
  if (!config.email?.trim()) errors.push("メールアドレスは必須です");
  if (
    config.businessType === "CORPORATION" &&
    !config.representativeName?.trim()
  ) {
    errors.push("法人の場合は代表者名が必須です");
  }
  if (!config.paymentMethods || config.paymentMethods.length === 0) {
    errors.push("お支払い方法を1つ以上選択してください");
  }

  // 電話番号の簡易フォーマットチェック（日本の電話番号）
  if (config.phone) {
    const phone = config.phone.trim();
    if (!/^[\d\-\+\(\)\s]+$/.test(phone) || !/\d{2,}/.test(phone)) {
      errors.push("電話番号の形式が正しくありません");
    }
  }

  // メールアドレスの簡易チェック
  if (config.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)) {
    errors.push("メールアドレスの形式が正しくありません");
  }

  // デジタル商品・継続課金を販売する場合は、対応する条件の記載を必須にする
  if (config.sellsDigital && !config.softwareRequirements?.trim()) {
    errors.push("デジタル商品を販売する場合は、動作環境（ソフトウェア要件）の記載が必要です");
  }
  if (config.sellsSubscription && !config.subscriptionTerms?.trim()) {
    errors.push("継続課金・定期購入を販売する場合は、継続契約条件の記載が必要です");
  }

  return errors;
}
