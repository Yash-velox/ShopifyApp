import type { ActionFunctionArgs } from "react-router";
import { createHmac } from "node:crypto";
import { authenticate } from "../shopify.server";
import { getAbsoluteBackendUrl } from "../services/backendUrl.server";

function forwardProductsUpdate(args: {
  shop: string;
  topic: string;
  webhookId: string | null;
  payload: unknown;
  shopifyWebhookIdHeader: string;
}): void {
  const backendUrl = getAbsoluteBackendUrl();
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  if (!backendUrl || !secret) {
    console.error(
      "products/update forward skipped: absolute BACKEND_URL or INTERNAL_HANDOFF_SECRET missing",
    );
    return;
  }

  const body = JSON.stringify({
    shop: args.shop,
    topic: args.topic,
    webhookId: args.webhookId ?? args.shopifyWebhookIdHeader,
    payload: args.payload,
  });
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  void fetch(`${backendUrl.replace(/\/$/, "")}/internal/webhooks/products-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Signature": sig,
      "X-Shopify-Webhook-Id": args.shopifyWebhookIdHeader,
      "X-Shopify-Shop-Domain": args.shop,
      "X-Shopify-Topic": args.topic,
    },
    body,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`products/update forward failed: ${res.status}`);
      }
    })
    .catch((err) => {
      console.error("products/update forward error", err);
    });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);

  // Emergency shed: ack Shopify without hitting FastAPI.
  if (process.env.SKIP_PRODUCTS_UPDATE_BACKEND_FORWARD === "1") {
    console.warn(
      "products/update forward skipped: SKIP_PRODUCTS_UPDATE_BACKEND_FORWARD=1",
    );
    return new Response();
  }

  // ACK Shopify immediately. FastAPI enqueue + workers run off this request.
  forwardProductsUpdate({
    shop,
    topic,
    webhookId: webhookId ?? null,
    payload,
    shopifyWebhookIdHeader: request.headers.get("x-shopify-webhook-id") ?? "",
  });

  return new Response();
};
