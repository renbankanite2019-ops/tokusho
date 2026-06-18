/**
 * Shopify のページ（オンラインストアの固定ページ）を作成または更新して公開する共通処理。
 * - DB に pageId が無くても、同じ handle のページが既にあれば再利用する（「handle already in use」防止）。
 * - 認証切れ（Response）は呼び出し側で再認証できるよう、そのまま throw する。
 * - userErrors は Error に変換して throw する。
 */
export async function publishPage(
  admin: { graphql: (query: string, opts?: any) => Promise<Response> },
  shop: string,
  opts: { handle: string; title: string; html: string; pageId?: string | null }
): Promise<{ pageId: string; pageUrl: string }> {
  let pageId = opts.pageId ?? null;

  // 既存の同ハンドルページを探して再利用
  if (!pageId) {
    const lookup = await admin.graphql(
      `#graphql
      query { pages(first: 100) { nodes { id handle } } }`
    );
    const d = await lookup.json();
    const found = (d.data?.pages?.nodes ?? []).find(
      (n: any) => n.handle === opts.handle
    );
    if (found) pageId = found.id;
  }

  if (pageId) {
    const res = await admin.graphql(
      `#graphql
      mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { id handle }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          id: pageId,
          page: { title: opts.title, body: opts.html, isPublished: true },
        },
      }
    );
    const d = await res.json();
    const ue = d.data?.pageUpdate?.userErrors;
    if (ue?.length > 0) throw new Error(ue.map((e: any) => e.message).join(", "));
    const p = d.data?.pageUpdate?.page;
    return { pageId: p.id, pageUrl: `https://${shop}/pages/${p.handle}` };
  }

  const res = await admin.graphql(
    `#graphql
    mutation pageCreate($page: PageCreateInput!) {
      pageCreate(page: $page) {
        page { id handle }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        page: {
          title: opts.title,
          handle: opts.handle,
          body: opts.html,
          isPublished: true,
        },
      },
    }
  );
  const d = await res.json();
  const ue = d.data?.pageCreate?.userErrors;
  if (ue?.length > 0) throw new Error(ue.map((e: any) => e.message).join(", "));
  const p = d.data?.pageCreate?.page;
  return { pageId: p.id, pageUrl: `https://${shop}/pages/${p.handle}` };
}
