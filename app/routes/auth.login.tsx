import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { login } from "../shopify.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (shop) {
    return login(request);
  }
  return { errors: {} };
}

export async function action({ request }: ActionFunctionArgs) {
  return login(request);
}

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const errors =
    (actionData as any)?.errors || (loaderData as any)?.errors || {};

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1>Tokusho にログイン</h1>
      <Form method="post">
        <label>
          ストアのURL:
          <input
            type="text"
            name="shop"
            placeholder="your-store.myshopify.com"
            style={{ display: "block", marginTop: "8px", padding: "8px", width: "300px" }}
          />
        </label>
        {errors.shop && <p style={{ color: "red" }}>{errors.shop}</p>}
        <button
          type="submit"
          style={{ marginTop: "16px", padding: "8px 24px", cursor: "pointer" }}
        >
          ログイン
        </button>
      </Form>
    </div>
  );
}
