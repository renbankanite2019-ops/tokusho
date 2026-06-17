import type { PrivacyConfig, ShopConfig } from "@prisma/client";
import { escapeHtml } from "./tokushoTemplate";

// 利用目的の日本語ラベル
export const PURPOSE_LABELS: Record<string, string> = {
  order_fulfillment: "商品の発送・代金の請求・ご本人確認のため",
  customer_support: "お問い合わせ・アフターサービス対応のため",
  marketing: "新商品・キャンペーン等のご案内（メールマガジン等）のため",
  improvement: "サービス・商品の改善および統計的分析のため",
  legal: "法令に基づく対応のため",
};

// 取得する個人情報の日本語ラベル
export const COLLECTED_LABELS: Record<string, string> = {
  name: "氏名",
  email: "メールアドレス",
  address: "住所",
  phone: "電話番号",
  payment: "決済に関する情報（クレジットカード情報等）",
  order_history: "購入・取引履歴",
  cookie: "Cookie・端末情報・アクセスログ",
};

/**
 * プライバシーポリシー（個人情報保護方針）のHTMLを生成する。
 * 個人情報保護法（APPI）を参考にした雛形。法的正確性は専門家の確認が必要。
 */
export function generatePrivacyHtml(
  privacy: PrivacyConfig,
  shopConfig: ShopConfig | null,
  opts: { hideWatermark?: boolean } = {}
): string {
  const operator = escapeHtml(privacy.operatorName);
  const email = escapeHtml(privacy.contactEmail);

  // 事業者の住所は特商法設定（ShopConfig）から再利用する
  const fullAddress = shopConfig
    ? [
        shopConfig.postalCode ? `〒${shopConfig.postalCode}` : "",
        shopConfig.prefecture || "",
        shopConfig.address || "",
        shopConfig.buildingName || "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const safeAddress = escapeHtml(fullAddress);

  const purposeItems =
    privacy.purposes.length > 0
      ? privacy.purposes
          .map((p) => PURPOSE_LABELS[p] || p)
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("\n")
      : "<li>商品の発送・代金の請求のため</li>";

  const collectedItems =
    privacy.collectedItems.length > 0
      ? privacy.collectedItems
          .map((c) => COLLECTED_LABELS[c] || c)
          .map((label) => `<li>${escapeHtml(label)}</li>`)
          .join("\n")
      : "<li>氏名・メールアドレス</li>";

  const thirdParty = privacy.sharesThirdParty
    ? `<p>当店は、以下の場合に個人情報を第三者へ提供することがあります。</p>
       <p>${escapeHtml(privacy.thirdPartyNote) || "（提供先・提供する情報の内容を記載してください）"}</p>
       <p>上記のほか、法令に基づく場合を除き、ご本人の同意なく第三者に個人情報を提供することはありません。</p>`
    : `<p>当店は、次に掲げる場合を除き、あらかじめご本人の同意を得ることなく、個人情報を第三者に提供することはありません。</p>
       <ul>
         <li>法令に基づく場合</li>
         <li>人の生命・身体・財産の保護のために必要があり、本人の同意を得ることが困難な場合</li>
         <li>業務委託先に、利用目的の達成に必要な範囲で取り扱いを委託する場合</li>
       </ul>`;

  const cookieSection =
    privacy.usesCookies || privacy.usesAnalytics
      ? `<p>当サイトでは、利便性向上やアクセス状況の把握のためにCookieを使用することがあります。${
          privacy.usesAnalytics
            ? `また、アクセス解析のために ${
                escapeHtml(privacy.analyticsNote) || "アクセス解析ツール"
              } を利用しています。これらのツールはCookie等を利用して情報を収集しますが、個人を特定する情報は含まれません。`
            : ""
        }ブラウザの設定によりCookieを無効にすることができますが、一部の機能がご利用いただけない場合があります。</p>`
      : `<p>当サイトでは、個人を特定する目的でのCookieの使用は行っておりません。</p>`;

  const disclosureContact = escapeHtml(privacy.disclosureContact) || email;
  const extra = escapeHtml(privacy.extraNote);
  const safeRepName = escapeHtml(shopConfig?.representativeName);
  // 海外SaaS（決済・アクセス解析等）利用時の外国にある第三者への提供に関する記載
  const foreignTransfer =
    privacy.usesAnalytics || privacy.sharesThirdParty
      ? `<p>アクセス解析や決済等のために、外国にある第三者が運営するサービスを利用することがあります。
         この場合、当該国における個人情報の保護に関する制度や、当該第三者が講じる個人情報保護のための措置に関する情報は、
         下記お問い合わせ窓口にてご提供します。</p>`
      : "";

  const updatedSource = privacy.lastPublishedAt ?? privacy.updatedAt ?? null;
  const now = (updatedSource ? new Date(updatedSource) : new Date()).toLocaleDateString(
    "ja-JP",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return `
<div class="pp-container">
  <h1>プライバシーポリシー（個人情報保護方針）</h1>
  <p class="pp-updated">最終更新日：${now}</p>

  <p>${operator}（以下「当店」といいます）は、お客様の個人情報の重要性を認識し、
  個人情報の保護に関する法律（個人情報保護法）その他関係法令を遵守し、
  以下のとおり個人情報を適切に取り扱います。</p>

  <h2>1. 事業者情報</h2>
  <table class="pp-table">
    <tr><th>事業者名</th><td>${operator}</td></tr>
    ${safeRepName ? `<tr><th>代表者名</th><td>${safeRepName}</td></tr>` : ""}
    ${safeAddress ? `<tr><th>所在地</th><td>${safeAddress}</td></tr>` : ""}
    <tr><th>連絡先</th><td><a href="mailto:${email}">${email}</a></td></tr>
  </table>

  <h2>2. 取得する個人情報</h2>
  <p>当店は、サービスの提供にあたり、以下の個人情報を取得します。</p>
  <ul>${collectedItems}</ul>

  <h2>3. 個人情報の利用目的</h2>
  <p>取得した個人情報は、以下の目的の範囲内で利用します。</p>
  <ul>${purposeItems}</ul>

  <h2>4. 個人情報の安全管理</h2>
  <p>当店は、個人情報の漏えい・滅失・毀損を防止するため、必要かつ適切な安全管理措置を講じ、
  従業者および委託先に対して必要な監督を行います。</p>
  <p>万一、個人情報の漏えい等が発生した場合は、法令に従い、必要な調査を行うとともに、
  ご本人への通知および個人情報保護委員会への報告等、適切な対応を行います。</p>

  <h2>5. 第三者への提供</h2>
  ${thirdParty}
  ${foreignTransfer}

  <h2>6. Cookie・アクセス解析について</h2>
  ${cookieSection}
  <p>当サイトのご利用を継続された場合、Cookieの利用に同意いただいたものとみなします。
  同意いただけない場合は、ブラウザの設定によりCookieを無効化・削除いただけます。</p>

  <h2>7. 個人情報の開示・訂正・利用停止等</h2>
  <p>ご本人からの個人情報（保有個人データ）の開示・訂正・追加・削除・利用停止・第三者提供の停止等の
  ご請求があった場合は、ご本人であることを確認のうえ、法令に従い速やかに対応します。</p>
  <p>請求の窓口：${disclosureContact}</p>
  <p>手数料：開示等のご請求に対する手数料はいただいておりません。</p>

  <h2>8. お問い合わせ窓口</h2>
  <p>本ポリシーに関するお問い合わせは、下記までご連絡ください。</p>
  <p><strong>${operator}</strong><br>
  Email: <a href="mailto:${email}">${email}</a></p>

  <h2>9. 本ポリシーの改定</h2>
  <p>当店は、法令の変更等に応じて本ポリシーを改定することがあります。
  改定後の内容は本ページに掲載した時点から効力を生じます。</p>

  ${extra ? `<h2>10. その他</h2><p>${extra}</p>` : ""}

  ${opts.hideWatermark ? "" : `<p class="pp-powered">Powered by <strong>Tokusho</strong></p>`}
</div>

<style>
.pp-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: sans-serif;
  line-height: 1.8;
}
.pp-updated {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 24px;
}
.pp-container h2 {
  font-size: 1.1em;
  margin-top: 28px;
  border-left: 4px solid #008060;
  padding-left: 10px;
}
.pp-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
}
.pp-table th,
.pp-table td {
  border: 1px solid #ddd;
  padding: 10px 14px;
  text-align: left;
  vertical-align: top;
}
.pp-table th {
  background: #f5f5f5;
  white-space: nowrap;
  width: 160px;
}
.pp-container ul {
  padding-left: 22px;
}
.pp-powered {
  margin-top: 16px;
  text-align: center;
  color: #999;
  font-size: 0.8em;
}
</style>
`.trim();
}

/** プライバシーポリシー設定のバリデーション。返り値はエラーメッセージの配列。 */
export function validatePrivacyConfig(config: Partial<PrivacyConfig>): string[] {
  const errors: string[] = [];
  if (!config.operatorName?.trim()) errors.push("事業者名は必須です");
  if (!config.contactEmail?.trim()) {
    errors.push("連絡先メールアドレスは必須です");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.contactEmail)) {
    errors.push("連絡先メールアドレスの形式が正しくありません");
  }
  if (!config.purposes || config.purposes.length === 0) {
    errors.push("利用目的を1つ以上選択してください");
  }
  if (!config.collectedItems || config.collectedItems.length === 0) {
    errors.push("取得する個人情報を1つ以上選択してください");
  }
  return errors;
}
