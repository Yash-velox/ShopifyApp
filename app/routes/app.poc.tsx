import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Navigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

/** POC UI removed - keep route so old bookmarks do not 404. */
export default function Poc() {
  return <Navigate to="/app" replace />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
