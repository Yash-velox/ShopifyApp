import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import { authenticate } from "../../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();

  const fromShopify =
    url.searchParams.has("shop") ||
    url.searchParams.has("host") ||
    url.searchParams.get("embedded") === "1";

  if (fromShopify) {
    throw redirect(qs ? `/app?${qs}` : "/app");
  }

  // Re-clicking "Image-Enhancement" in Admin reloads `/` without query params
  // but the embedded session cookie is still valid — send them to the app.
  try {
    await authenticate.admin(request);
    throw redirect("/app");
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
  }

  throw redirect("/auth/login");
};

export default function IndexRedirect() {
  return null;
}
