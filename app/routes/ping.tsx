import type { LoaderFunctionArgs } from "@remix-run/node";

/**
 * 公開ヘルスチェック用エンドポイント（/ping）。
 * - 認証なし・DBアクセスなしで即 200 を返す（リソースルート）。
 * - UptimeRobot 等から定期 ping して Cloud Run インスタンスを温め、
 *   コールドスタートを抑える用途。
 * - DB には触れない（Neon/Supabase の課金/接続を消費しないため）。
 *
 * 注: /healthz は Cloud Run/Knative がヘルスチェック用に予約しており
 *     外部リクエストがコンテナに届かない（GFE が 404 を返す）ため /ping を使う。
 */
export const loader = async (_args: LoaderFunctionArgs) => {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain", "cache-control": "no-store" },
  });
};
