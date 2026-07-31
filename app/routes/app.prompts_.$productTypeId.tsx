import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import PromptConfigurationPage from "../../../../ReactFrontend/src/screens/PromptConfigurationPage";
import "../../../../ReactFrontend/src/styles/shopify.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function PromptConfiguration() {
  const { productTypeId } = useParams();
  return <PromptConfigurationPage productTypeId={productTypeId} />;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
