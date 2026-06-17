import { json, type LoaderFunctionArgs, type LinksFunction } from "@remix-run/node";
import { Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";

// Polaris CSS をアプリ自身のオリジンから配信する（unpkg CDN より速く確実）
export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <NavMenu>
        <a href="/app" rel="home">ダッシュボード</a>
        <a href="/app/setup">事業者情報</a>
        <a href="/app/preview">プレビュー・公開</a>
        <a href="/app/privacy">プライバシーポリシー</a>
        <a href="/app/pages">追加ページ</a>
        <a href="/app/billing">プラン・お支払い</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  // 詳細なエラー内容（スタックトレース等）はクライアントに出さない。
  // 開発時はサーバーログで確認する。
  const error = useRouteError();
  if (process.env.NODE_ENV !== "production") {
    console.error("[app ErrorBoundary]", error);
  }
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>エラーが発生しました</h1>
      <p>
        申し訳ございません。問題が発生しました。ページを再読み込みしても解決しない場合は、
        サポートまでお問い合わせください。
      </p>
    </div>
  );
}
