import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";

/**
 * 監視対象の法令（e-Gov LawId）。
 * lawId は e-Gov 法令検索（laws.e-gov.go.jp）で確認できる。
 * 追加する場合は必ず正しい lawId を確認してから追記すること（誤った id は取得失敗としてスキップされる）。
 */
export const WATCHED_LAWS: { lawId: string; name: string }[] = [
  { lawId: "351AC0000000057", name: "特定商取引に関する法律" }, // 確認済み
  // 例（要lawId確認のうえ有効化）:
  // { lawId: "415AC0000000057", name: "個人情報の保護に関する法律" },
];

const EGOV_BASE = "https://laws.e-gov.go.jp/api/1/lawdata/";

/**
 * 指定法令の現在のフィンガープリント（SHA-256）を取得する。
 * e-Gov v1 の lawdata レスポンスにはリクエスト毎に変わる値が無いため、
 * 本文が変わらない限りハッシュは安定する（＝改正時のみ変化する）。
 */
export async function fetchLawFingerprint(
  lawId: string
): Promise<{ ok: boolean; fingerprint?: string; error?: string }> {
  try {
    const res = await fetch(`${EGOV_BASE}${lawId}`, {
      headers: { Accept: "application/xml" },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const text = await res.text();
    // 取得失敗（Code が 0 以外）はスキップ
    const codeMatch = text.match(/<Code>(\d+)<\/Code>/);
    if (codeMatch && codeMatch[1] !== "0") {
      return { ok: false, error: `e-Gov Code ${codeMatch[1]}` };
    }
    if (text.length < 1000) {
      return { ok: false, error: "unexpectedly small response" };
    }
    const fingerprint = createHash("sha256").update(text).digest("hex");
    return { ok: true, fingerprint };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type LawCheckResult = {
  lawId: string;
  name: string;
  status: "unchanged" | "changed" | "first-seen" | "error";
  detail?: string;
};

/**
 * 全監視法令をチェックし、前回のフィンガープリントと比較する。
 * 変化を検知したら DB に changed=true を立て、Webhook（設定時）と log で通知する。
 */
export async function runLawCheck(
  prisma: PrismaClient
): Promise<LawCheckResult[]> {
  const now = new Date();
  const results: LawCheckResult[] = [];

  for (const law of WATCHED_LAWS) {
    const fp = await fetchLawFingerprint(law.lawId);
    const existing = await prisma.lawWatch.findUnique({
      where: { lawId: law.lawId },
    });

    if (!fp.ok) {
      // 取得失敗：最終確認日時だけ更新し、状態は変えない
      if (existing) {
        await prisma.lawWatch.update({
          where: { lawId: law.lawId },
          data: { lastCheckedAt: now },
        });
      }
      results.push({ lawId: law.lawId, name: law.name, status: "error", detail: fp.error });
      continue;
    }

    if (!existing) {
      await prisma.lawWatch.create({
        data: {
          lawId: law.lawId,
          lawName: law.name,
          fingerprint: fp.fingerprint,
          lastCheckedAt: now,
        },
      });
      results.push({ lawId: law.lawId, name: law.name, status: "first-seen" });
      continue;
    }

    if (existing.fingerprint && existing.fingerprint !== fp.fingerprint) {
      await prisma.lawWatch.update({
        where: { lawId: law.lawId },
        data: { fingerprint: fp.fingerprint, lastCheckedAt: now, lastChangedAt: now, changed: true },
      });
      results.push({ lawId: law.lawId, name: law.name, status: "changed" });
      await notifyChange(law.name, law.lawId);
    } else {
      await prisma.lawWatch.update({
        where: { lawId: law.lawId },
        data: { fingerprint: fp.fingerprint, lastCheckedAt: now },
      });
      results.push({ lawId: law.lawId, name: law.name, status: "unchanged" });
    }
  }

  return results;
}

/**
 * 変更検知時の通知。LAW_ALERT_WEBHOOK_URL が設定されていれば POST する
 * （Slack/Discord/汎用の incoming webhook を想定）。常に console にも出力する。
 */
async function notifyChange(lawName: string, lawId: string): Promise<void> {
  const msg = `【法令変更の可能性】${lawName}（${lawId}）の法令データに差分を検知しました。e-Gov で内容を確認し、必要ならテンプレートを更新して TEMPLATE_UPDATED_AT を更新してください。 https://laws.e-gov.go.jp/law/${lawId}`;
  console.warn("[lawCheck]", msg);
  const url = process.env.LAW_ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Slack/Discord は { text } / { content } を解釈。両方入れて汎用化。
      body: JSON.stringify({ text: msg, content: msg }),
    });
  } catch (e) {
    console.error("[lawCheck] webhook notify failed:", e);
  }
}
