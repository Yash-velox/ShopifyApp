import { createHmac } from "node:crypto";
import { getAbsoluteBackendUrl } from "./backendUrl.server";

/**
 * Fire-and-forget forward of products/create or products/update to FastAPI.
 * Shopify is ACKed by the route; GraphQL/catalog work runs in the Backend worker.
 */
export function forwardProductWebhook(args: {
  shop: string;
  topic: string;
  webhookId: string | null;
  payload: unknown;
  shopifyWebhookIdHeader: string;
}): void {
  const backendUrl = getAbsoluteBackendUrl();
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  const topicLabel = args.topic || "products/update";

  if (!backendUrl || !secret) {
    console.error(
      `${topicLabel} forward skipped: absolute BACKEND_URL or INTERNAL_HANDOFF_SECRET missing`,
    );
    return;
  }

  const body = JSON.stringify({
    shop: args.shop,
    topic: topicLabel,
    webhookId: args.webhookId ?? args.shopifyWebhookIdHeader,
    payload: args.payload,
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  // Same intake for create + update; topic is stored and used for dedupe/observability.
  void fetch(`${backendUrl.replace(/\/$/, "")}/internal/webhooks/products-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Signature": sig,
      "X-Shopify-Webhook-Id": args.shopifyWebhookIdHeader,
      "X-Shopify-Shop-Domain": args.shop,
      "X-Shopify-Topic": topicLabel,
    },
    body,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`${topicLabel} forward failed: ${res.status}`);
      }
    })
    .catch((err) => {
      console.error(`${topicLabel} forward error`, err);
    });
}

export function shouldSkipProductsWebhookForward(): boolean {
  return process.env.SKIP_PRODUCTS_UPDATE_BACKEND_FORWARD === "1";
}
