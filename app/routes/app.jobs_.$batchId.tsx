import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import BatchDetailPage from "../../../../ReactFrontend/src/screens/BatchDetailPage";
import "../../../../ReactFrontend/src/styles/shopify.css";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { batchId: params.batchId ?? "" };
};

export default function BatchDetail() {
  const { batchId } = useLoaderData<typeof loader>();
  return <BatchDetailPage batchId={batchId} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
