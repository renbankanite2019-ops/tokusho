/**
 * メール送信（Resend の HTTP API を利用）。
 * Cloud Run は SMTP ポートが制限されることがあるため、HTTP API 経由が確実。
 *
 * 必要な環境変数:
 *   RESEND_API_KEY     … Resend (https://resend.com) の API キー
 *   LAW_ALERT_EMAIL_TO … 既定の通知先メール（カンマ区切りで複数可）
 *   MAIL_FROM          … 差出人。Resend で認証済みドメインのアドレスを推奨。
 *                        未設定時は onboarding@resend.dev（テスト用・自分のアカウント宛のみ送信可）。
 *
 * 必要な設定が無ければ送信せず false を返す（呼び出し側は失敗を握りつぶしてよい）。
 */
export async function sendEmail(opts: {
  subject: string;
  text: string;
  to?: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = opts.to || process.env.LAW_ALERT_EMAIL_TO;
  const from = process.env.MAIL_FROM || "Tokusho <onboarding@resend.dev>";
  if (!apiKey || !to) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.split(",").map((s) => s.trim()).filter(Boolean),
        subject: opts.subject,
        text: opts.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[mailer] send failed:", res.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[mailer] send error:", e);
    return false;
  }
}
