import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * 公開ヘルスチェック用エンドポイント（/healthz）。
 * - 認証なし・DBアクセスなしで即 200 を返す（リソースルート）。
 * - UptimeRobot 等から定期 ping して Cloud Run インスタンスを温め、
 *   コールドスタートを抑える用途。
 * - DB には触れない（Neon free の compute 時間を消費しないため）。
 */
export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
};
