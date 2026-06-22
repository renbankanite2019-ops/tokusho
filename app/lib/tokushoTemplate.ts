import type { ShopConfig } from "@prisma/client";

/**
 * テンプレート／法令対応の最終更新日（YYYY-MM-DD）。
 * 特商法の改正やテンプレートの重要な修正を反映したら、この日付を更新する。
 * これより前に公開されたページは「古い」と判定し、ダッシュボードで再公開を促す。
 * （注：法令変更の把握・文言の確定は人／専門家が行う。ここは配布の仕組みのみ。）
 */
export const TEMPLATE_UPDATED_AT = "2026-06-22";

/** 更新履歴（新しい順）。ダッシュボードに最新の1件を表示する。 */
export const TEMPLATE_CHANGELOG: { date: string; note: string }[] = [
  { date: "2026-06-22", note: "表示の改善（タイトル重複の解消、返品表の見やすさ向上）" },
  { date: "2026-06-19", note: "テンプレートの整備（初期バージョン）" },
];

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
  DEPENDS: "初期不良・当店都合による場合は当店負担、お客様都合による場合はお客様ご負担（不具合等は商品到着後8日以内にご連絡ください）",
};

/**
 * 特定商取引法に基づく表記ページのHTMLを生成する
 * 消費者庁ガイドライン 法第11条 広告の表示事項に基づく
 * 出典: https://www.no-trouble.caa.go.jp/what/mailorder/advertising.html
 */
export function generateTokushoHtml(
  config: ShopConfig,
  opts: { hideWatermark?: boolean; applyDesign?: boolean } = {}
): string {
  // デザインカスタマイズは Basic プラン以上（applyDesign=true）でのみ反映する
  const design = opts.applyDesign === true;
  // accentColor は有効な16進カラーのみ採用（<style>へのCSSインジェクション防止）
  const accent =
    design && /^#[0-9a-fA-F]{3,8}$/.test(config.accentColor || "")
      ? config.accentColor
      : "";
  const thBg = accent || "#f5f5f5";
  const thColor = accent ? "#ffffff" : "#202223";
  const minimal = design && config.templateStyle === "minimal";
  const cellBorder = minimal ? "none" : "1px solid #ddd";
  const rowBorder = minimal ? "1px solid #eee" : "1px solid #ddd";
  // 日英併記（Basicプラン以上 + bilingual=true のとき項目名に英語を併記）
  const bil = design && config.bilingual === true;
  // 英語の項目名は見出しセルの文字色を継承し、不透明度で控えめにする。
  // （色を固定すると、色付きヘッダー＝白文字の上でグレーが読みづらくなるため）
  const L = (ja: string, en: string) =>
    bil
      ? `${ja}<br><small style="display:inline-block;white-space:normal;font-weight:normal;opacity:0.72;font-size:0.78em;line-height:1.3;letter-spacing:0.02em;">${en}</small>`
      : ja;
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
    // デジタル/ダウンロード商品では物理商品前提の文言が成立しないため切り替える
    returnPolicyText = config.sellsDigital
      ? `
      <p>本商品はデジタルコンテンツ（ダウンロード／オンライン提供）です。通信販売には特定商取引法上のクーリング・オフ制度の適用はありません。<br>
      当店では、商品の性質上、ダウンロードまたは利用開始後の返品・返金はお受けできません（返品特約）。<br>
      ただし、提供されたデータに不具合がある場合は、商品到着後8日以内にご連絡いただければ、再提供または返金等の対応をいたします。</p>
      ${returnNote ? `<p>${escapeHtml(returnNote)}</p>` : ""}
    `
      : `
      <p>当店の返品特約として、商品の性質上、原則として返品・交換はお受けしておりません。<br>
      ただし、商品の破損・汚損・誤送等、当店の不備による場合は、商品到着後8日以内にご連絡ください。返送料は当店が負担いたします。</p>
      ${returnNote ? `<p>${escapeHtml(returnNote)}</p>` : ""}
    `;
  } else {
    returnPolicyText = `
      <table class="tokusho-subtable">
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
  // 申込みの有効期限は必須表示項目のため常に表示する。未入力時は既定文を出す。
  const applicationPeriodText =
    safeApplicationPeriod ||
    (config.sellsSubscription
      ? "契約は所定の周期で自動更新されます。解約は次回更新日の前日までにお手続きください。"
      : "特に定めはありません（在庫がある限り有効）。");

  // 事業者情報の行を組み立てる
  // 法人: 法人名 + 代表者名、個人: 販売業者名。通信販売責任者は種別に関わらず入力があれば表示。
  const businessRows =
    businessType === "CORPORATION"
      ? `<tr><th>${L("販売業者（法人名）", "Seller (Company)")}</th><td>${safeSellerName}</td></tr>
      ${safeRepName ? `<tr><th>${L("代表者名", "Representative")}</th><td>${safeRepName}</td></tr>` : ""}`
      : `<tr><th>${L("販売業者", "Seller")}</th><td>${safeSellerName}</td></tr>`;
  const businessInfo = `${businessRows}
      ${safeRespName ? `<tr><th>${L("通信販売責任者", "Person in charge")}</th><td>${safeRespName}</td></tr>` : ""}`;

  // 最終更新日は実際の公開/更新日時を表示する（プレビューのたびに変わらないようにする）
  const updatedSource = config.lastPublishedAt ?? config.updatedAt ?? null;
  const now = (updatedSource ? new Date(updatedSource) : new Date()).toLocaleDateString(
    "ja-JP",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return `
<div class="tokusho-container">
  <p class="tokusho-updated">最終更新日：${now}</p>

  <table class="tokusho-table">
    ${businessInfo}
    <tr><th>${L("所在地", "Address")}</th><td>${escapeHtml(fullAddress)}</td></tr>
    <tr><th>${L("電話番号", "Phone")}</th><td>${safePhone}</td></tr>
    <tr>
      <th>${L("メールアドレス", "Email")}</th>
      <td><a href="mailto:${safeEmail}">${safeEmail}</a></td>
    </tr>
    ${safeWebsite ? `<tr><th>${L("ウェブサイト", "Website")}</th><td><a href="${safeWebsite}">${safeWebsite}</a></td></tr>` : ""}

    <tr><th>${L("販売価格", "Price")}</th><td>${safeSalesPrice}</td></tr>
    <tr><th>${L("送料", "Shipping")}</th><td>${safeShippingFee}</td></tr>
    ${safeOtherCosts ? `<tr><th>${L("商品代金以外の費用", "Other fees")}</th><td>${safeOtherCosts}</td></tr>` : ""}

    <tr>
      <th>${L("お支払い方法", "Payment methods")}</th>
      <td><ul>${paymentList}</ul></td>
    </tr>
    <tr><th>${L("お支払い時期", "Payment timing")}</th><td>${safePaymentTiming}</td></tr>
    <tr><th>${L("商品のお届け", "Delivery")}</th><td>${safeDeliveryTiming}</td></tr>
    <tr><th>${L("申込みの有効期限", "Offer validity period")}</th><td>${applicationPeriodText}</td></tr>

    <tr>
      <th>${L("返品・交換について", "Returns & exchanges")}</th>
      <td>${returnPolicyText}</td>
    </tr>
    ${safeContractLiability ? `<tr><th>${L("契約不適合責任", "Liability for non-conformity")}</th><td>${safeContractLiability}</td></tr>` : ""}

    ${safeSoftware ? `<tr><th>${L("動作環境", "System requirements")}</th><td>${safeSoftware}</td></tr>` : ""}
    ${safeSubscription ? `<tr><th>${L("継続契約について", "Subscription terms")}</th><td>${safeSubscription}</td></tr>` : ""}
    ${safeSpecial ? `<tr><th>${L("特別な販売条件", "Special conditions")}</th><td>${safeSpecial}</td></tr>` : ""}

    <tr>
      <th>${L("お問い合わせ", "Contact")}</th>
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
.tokusho-container h1 {
  ${design && accent ? `border-bottom: 3px solid ${accent}; padding-bottom: 8px;` : ""}
}
.tokusho-updated {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 12px;
}
.tokusho-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}
.tokusho-table th,
.tokusho-table td {
  border: ${cellBorder};
  border-bottom: ${rowBorder};
  padding: 8px 16px;
  line-height: 1.5;
  text-align: left;
  vertical-align: top;
}
.tokusho-table th {
  background: ${thBg};
  color: ${thColor};
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
/* 返品セクション内のサブ表：ラベルを軽く・省スペースにする（メインの見出しと差をつける） */
.tokusho-table td .tokusho-subtable {
  width: 100%;
  border-collapse: collapse;
  margin: -4px 0;
}
.tokusho-table td .tokusho-subtable th,
.tokusho-table td .tokusho-subtable td {
  border: none;
  border-bottom: 1px solid #eee;
  padding: 7px 0;
  vertical-align: top;
}
.tokusho-table td .tokusho-subtable tr:last-child th,
.tokusho-table td .tokusho-subtable tr:last-child td {
  border-bottom: none;
}
.tokusho-table td .tokusho-subtable th {
  background: transparent;
  color: inherit;
  width: 96px;
  white-space: nowrap;
  font-weight: 600;
  padding-right: 14px;
}
@media (max-width: 600px) {
  /* 狭い画面ではラベルを大きな色帯にせず、コンパクトな見出し行にする */
  .tokusho-table th,
  .tokusho-table td {
    display: block;
    width: auto;
    border: none;
    white-space: normal;
  }
  .tokusho-table tr {
    border-bottom: 1px solid #e3e6e8;
  }
  .tokusho-table th {
    background: transparent;
    color: #202223;
    border-left: 4px solid ${accent || "#5f7d6e"};
    padding: 10px 0 2px 12px;
    font-size: 0.95em;
  }
  .tokusho-table td {
    padding: 0 0 12px 12px;
  }
  /* 返品サブ表は色帯を付けず、コンパクト表示のまま */
  .tokusho-table td .tokusho-subtable th {
    border-left: none;
    padding: 7px 0;
    font-size: 1em;
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

  // 送料は必須表示事項（デジタル商品で配送が無い場合を除く）
  if (!config.sellsDigital && !config.shippingFee?.trim()) {
    errors.push("送料（または送料に関する表示）は必須です");
  }

  // デジタル商品・継続課金を販売する場合は、対応する条件の記載を必須にする
  if (config.sellsDigital && !config.softwareRequirements?.trim()) {
    errors.push("デジタル商品を販売する場合は、動作環境（ソフトウェア要件）の記載が必要です");
  }
  if (config.sellsSubscription && !config.subscriptionTerms?.trim()) {
    errors.push("継続課金・定期購入を販売する場合は、継続契約条件の記載が必要です");
  }

  // 返品不可（NO_RETURN）を選んだ場合は、その理由の明記を必須にする（特商法の返品特約）
  if (config.returnPolicy === "NO_RETURN" && !config.returnNote?.trim()) {
    errors.push("返品不可とする場合は、その理由（返品に関する補足）の記載が必要です");
  }

  return errors;
}
