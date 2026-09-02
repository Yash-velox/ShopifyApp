import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const qs = url.searchParams.toString();

  // Shopify Admin / OAuth launches include shop, host, or embedded=1.
  const fromShopify =
    url.searchParams.has("shop") ||
    url.searchParams.has("host") ||
    url.searchParams.get("embedded") === "1";

  throw redirect(fromShopify ? (qs ? `/app?${qs}` : "/app") : "/auth/login");
};

export default function IndexRedirect() {
  return null;
}
