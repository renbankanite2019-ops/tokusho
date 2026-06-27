import type { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "../db.server";

/**
 * DB キープアライブ用エンドポイント（/ping-db）。
 * - 軽量な `SELECT 1` を1回だけ実行して DB に「活動」を発生させる。
 * - Supabase 無料プランは一定期間（約7日）アクセスが無いと
 *   プロジェクトが一時停止（pause）されるため、定期 ping で停止を防ぐ用途。
 * - 認証なしの公開ルートだが、クエリは `SELECT 1` のみで負荷は無視できる。
 *
 * 使い方: UptimeRobot か Cloud Scheduler から定期的に GET する。
 *   GET /ping-db
 *
 * 注: コールドスタート対策の温め目的なら DB に触れない /ping を使うこと。
 *     こちらは DB を起こし続けるための別用途。
 */
export const loader = async (_args: LoaderFunctionArgs) => {
  const headers = { "content-type": "text/plain", "cache-control": "no-store" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    return new Response("db-ok", { status: 200, headers });
  } catch {
    return new Response("db-error", { status: 500, headers });
  }
};
