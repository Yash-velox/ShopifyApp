import type { ActionFunctionArgs } from "react-router";
import { createHmac } from "node:crypto";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);

  const backendUrl = process.env.BACKEND_URL || process.env.VITE_API_BASE_URL;
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  if (!backendUrl || !secret) {
    console.error("products/update forward skipped: missing BACKEND_URL or INTERNAL_HANDOFF_SECRET");
    return new Response();
  }

  const body = JSON.stringify({
    shop,
    topic,
    webhookId: webhookId ?? request.headers.get("x-shopify-webhook-id"),
    payload,
  });
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  try {
    const res = await fetch(
      `${backendUrl.replace(/\/$/, "")}/internal/webhooks/products-update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Timestamp": ts,
          "X-Signature": sig,
          "X-Shopify-Webhook-Id": request.headers.get("x-shopify-webhook-id") ?? "",
          "X-Shopify-Shop-Domain": shop,
          "X-Shopify-Topic": topic,
        },
        body,
      },
    );
    if (!res.ok) {
      console.error(`products/update forward failed: ${res.status}`);
    }
  } catch (err) {
    console.error("products/update forward error", err);
  }

  return new Response();
};
