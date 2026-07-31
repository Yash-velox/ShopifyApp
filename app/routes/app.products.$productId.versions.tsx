import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import ProductVersionsPage from "../../../../ReactFrontend/src/screens/ProductVersionsPage";
import "../../../../ReactFrontend/src/styles/shopify.css";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { productId: params.productId ?? "" };
};

export default function ProductVersions() {
  const { productId } = useLoaderData<typeof loader>();
  return <ProductVersionsPage productId={productId} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
