import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import { sendEmail } from "../lib/mailer";
import { TEMPLATE_UPDATED_AT, TEMPLATE_CHANGELOG } from "../lib/tokushoTemplate";

/**
 * 法令／テンプレート更新時に、対象の Pro プラン店舗へメール通知する（公開ルート・CRON_SECRET 保護）。
 * Cloud Scheduler 等から毎日呼ぶ想定。重複送信は lawAlertNotifiedAt で防止する。
 *
 * 対象: Proプラン / 公開中 / オプトアウトしていない / 現テンプレ更新日より前に公開 /
 *       まだこのバージョンで未通知。
 * Resend Free（100通/日）に収めるため1回あたり DAILY_CAP 件まで。超過分は次回に送る。
 */
const DAILY_CAP = 90;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("token") || request.headers.get("x-cron-secret") || "";
  if (provided !== secret) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  const updatedAt = new Date(TEMPLATE_UPDATED_AT);
  const note = TEMPLATE_CHANGELOG[0]?.note ?? "";

  const where = {
    plan: "PRO" as const,
    isPublished: true,
    lawAlertOptOut: false,
    lastPublishedAt: { lt: updatedAt },
    OR: [
      { lawAlertNotifiedAt: null },
      { lawAlertNotifiedAt: { lt: updatedAt } },
    ],
  };

  const candidates = await prisma.shopConfig.findMany({ where, take: DAILY_CAP });

  let sent = 0;
  const now = new Date();
  for (const c of candidates) {
    if (!c.email) continue;
    const shopHandle = c.shop.replace(/\.myshopify\.com$/, "");
    const ok = await sendEmail({
      to: c.email,
      subject: "【Tokusho】特定商取引法ページの更新のお願い",
      text:
        `${c.sellerName} 御中\n\n` +
        `特定商取引法に基づく表記ページのテンプレートに更新がありました（${note}）。\n` +
        `お手数ですが、Tokushoアプリの「プレビュー・公開」から「ページを更新して公開する」を押して再公開してください。\n\n` +
        `アプリを開く: https://admin.shopify.com/store/${shopHandle}/apps/tokusho\n\n` +
        `※ 本メールはProプランの法令アップデート通知です。\n` +
        `※ 配信を停止するには、アプリの「事業者情報」で「法令アップデートのメール通知を受け取る」のチェックを外してください。\n` +
        `※ 本メールは一般的なご案内であり、法的助言ではありません。最終的な表示内容はご自身でご確認ください。`,
    });
    if (ok) {
      await prisma.shopConfig.update({
        where: { shop: c.shop },
        data: { lawAlertNotifiedAt: now },
      });
      sent++;
    }
  }

  // 残件（今回のキャップ超過分。送信済みは lawAlertNotifiedAt 更新で除外される）
  const remaining = await prisma.shopConfig.count({ where });

  return json({ ok: true, sent, remaining, templateDate: TEMPLATE_UPDATED_AT });
};
