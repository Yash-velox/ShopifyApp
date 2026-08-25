import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  forwardProductWebhook,
  shouldSkipProductsWebhookForward,
} from "../services/forwardProductWebhook.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);

  // Emergency shed: ack Shopify without hitting FastAPI.
  if (shouldSkipProductsWebhookForward()) {
    console.warn(
      "products/create forward skipped: SKIP_PRODUCTS_UPDATE_BACKEND_FORWARD=1",
    );
    return new Response();
  }

  // ACK Shopify immediately. Same Backend intake as products/update (topic preserved).
  forwardProductWebhook({
    shop,
    topic: topic || "products/create",
    webhookId: webhookId ?? null,
    payload,
    shopifyWebhookIdHeader: request.headers.get("x-shopify-webhook-id") ?? "",
  });

  return new Response();
};
