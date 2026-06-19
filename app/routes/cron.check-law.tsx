import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";
import { runLawCheck } from "../lib/lawCheck";
import { sendEmail } from "../lib/mailer";

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

  // メール設定の動作確認用： ?test=1 でテストメールを1通送る（法令チェックは実行しない）。
  if (url.searchParams.get("test") === "1") {
    const emailConfigured = !!(
      process.env.RESEND_API_KEY && process.env.LAW_ALERT_EMAIL_TO
    );
    const sent = await sendEmail({
      subject: "【Tokusho】テストメール（法令監視）",
      text: "これは Tokusho の法令監視メール設定のテストです。\nこのメールが届いていれば、メール通知の設定は正常です。",
    });
    return json({
      ok: true,
      test: true,
      emailConfigured,
      emailSent: sent,
      hint: sent
        ? "送信しました。受信箱（迷惑メールフォルダも）をご確認ください。"
        : "送信できませんでした。RESEND_API_KEY と LAW_ALERT_EMAIL_TO（必要に応じて MAIL_FROM）を設定してください。",
    });
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
