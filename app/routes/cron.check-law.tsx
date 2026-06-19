import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import { runLawCheck } from "../lib/lawCheck";

/**
 * 法令変更の定期チェック用エンドポイント（Shopify認証なしの公開ルート）。
 * Cloud Scheduler 等から定期的に GET する。CRON_SECRET で保護する。
 *
 *   GET /cron/check-law?token=<CRON_SECRET>
 *   または ヘッダ X-Cron-Secret: <CRON_SECRET>
 *
 * 変更検知時は lib/lawCheck.ts が Webhook(LAW_ALERT_WEBHOOK_URL)/log で通知する。
 */
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

  const results = await runLawCheck(prisma);
  const changed = results.filter((r) => r.status === "changed");
  return json({
    ok: true,
    checkedAt: new Date().toISOString(),
    changedCount: changed.length,
    results,
  });
};
