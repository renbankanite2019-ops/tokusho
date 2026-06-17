import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { privacyHtml, termsHtml } from "../lib/legalContent";

/**
 * 公開の法務ページ（認証不要）。
 * - /legal/privacy : アプリ提供者のプライバシーポリシー（リスティングの Privacy policy URL 用）
 * - /legal/terms   : マーチャント向け利用規約（BtoB）
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const page = params.page;
  const html =
    page === "privacy" ? privacyHtml() : page === "terms" ? termsHtml() : null;
  if (!html) {
    throw new Response("Not Found", { status: 404 });
  }
  return json({ html });
};

export default function LegalPage() {
  const { html } = useLoaderData<typeof loader>();
  return (
    <main
      style={{
        maxWidth: "820px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        lineHeight: 1.8,
        color: "#202223",
      }}
    >
      <style>{`
        main h1 { font-size: 1.6em; }
        main h2 { font-size: 1.1em; margin-top: 28px; border-left: 4px solid #008060; padding-left: 10px; }
        main .meta { color: #6d7175; font-size: 0.9em; margin-bottom: 24px; }
        main code { background: #f1f1f1; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
        main a { color: #008060; }
        main ul { padding-left: 22px; }
      `}</style>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
