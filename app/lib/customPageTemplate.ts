import type { ShopConfig } from "@prisma/client";
import { escapeHtml } from "./tokushoTemplate";

export const PAGE_TYPES = {
  about: { title: "会社概要", handle: "about" },
  contact: { title: "お問い合わせ", handle: "contact" },
  returns: { title: "返品・交換ポリシー", handle: "returns" },
} as const;

export type PageType = keyof typeof PAGE_TYPES;

export const PAGE_TYPE_LIST: PageType[] = ["about", "contact", "returns"];

export function isPageType(v: string | undefined): v is PageType {
  return v === "about" || v === "contact" || v === "returns";
}

const RETURN_SHIPPING: Record<string, string> = {
  CUSTOMER: "お客様ご負担",
  SELLER: "当店負担",
  DEPENDS: "初期不良・当店都合は当店負担、お客様都合はお客様ご負担",
};

/** 各ページの初期本文（ShopConfig から雛形を生成。利用者が編集して公開する） */
export function defaultBody(type: PageType, c: ShopConfig | null): string {
  const name = c?.sellerName || "";
  const rep = c?.representativeName || "";
  const addr = c
    ? [c.postalCode ? `〒${c.postalCode}` : "", c.prefecture || "", c.address || "", c.buildingName || ""]
        .filter(Boolean)
        .join(" ")
    : "";
  const phone = c?.phone || "";
  const email = c?.email || "";

  const responsible = rep || c?.responsibleName || "";

  if (type === "about") {
    return [
      `販売業者：${name}`,
      responsible ? `代表者：${responsible}` : "代表者：（記入してください）",
      `所在地：${addr}`,
      `電話番号：${phone}`,
      `メールアドレス：${email}`,
      `設立：（記入してください）`,
      `事業内容：（記入してください）`,
    ].join("\n");
  }
  if (type === "contact") {
    return [
      `お問い合わせは下記までご連絡ください。`,
      ``,
      `メールアドレス：${email}`,
      `電話番号：${phone}`,
      `受付時間：（例：平日 10:00〜17:00）`,
      ``,
      `お問い合わせ内容には、数営業日以内に返信いたします。`,
    ].join("\n");
  }
  // returns — 特商法本表の返品設定（returnPolicy）と内容を一致させる（単一ソース）
  if (c?.returnPolicy === "NO_RETURN") {
    return [
      `【返品・交換について】`,
      ``,
      c?.sellsDigital
        ? `本商品はデジタルコンテンツ（ダウンロード／オンライン提供）のため、ダウンロードまたは利用開始後の返品・返金はお受けできません（返品特約）。通信販売には法定のクーリング・オフは適用されません。`
        : `当店の返品特約として、商品の性質上、原則として返品・交換はお受けしておりません。`,
      c?.returnNote ? c.returnNote : "",
      ``,
      `商品の破損・汚損・誤送等、当店の不備による場合や、提供データに不具合がある場合は、商品到着後8日以内に ${email} までご連絡ください。`,
    ]
      .filter((l) => l !== "")
      .join("\n");
  }
  return [
    `【返品・交換について】`,
    ``,
    `返品期限：${c?.returnDeadline || "商品到着後8日以内"}`,
    `返品条件：${c?.returnCondition || "未使用・未開封のもの"}`,
    `返品送料：${RETURN_SHIPPING[c?.returnShipping || "CUSTOMER"] || ""}`,
    c?.contractLiability ? `契約不適合責任：${c.contractLiability}` : "",
    c?.returnNote ? `補足：${c.returnNote}` : "",
    ``,
    `返品をご希望の場合は、まず ${email} までご連絡ください。`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * ページ本文（プレーンテキスト）を安全な HTML にして公開用に整形する。
 * 見出し（タイトル）は Shopify のテーマがページタイトルとして表示するため、
 * 本文側には出力しない（重複防止）。title はシグネチャ互換のため残す。
 */
export function renderCustomPageHtml(_title: string, body: string): string {
  const safeBody = escapeHtml(body).replace(/\n/g, "<br>");
  return `
<div class="custom-page">
  <div class="custom-page-body">${safeBody}</div>
</div>
<style>
.custom-page { max-width: 800px; margin: 0 auto; padding: 20px; font-family: sans-serif; line-height: 1.9; }
</style>
`.trim();
}
