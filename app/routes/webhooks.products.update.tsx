import type { ActionFunctionArgs } from "react-router";
import { createHmac } from "node:crypto";
import { authenticate } from "../shopify.server";
import { getAbsoluteBackendUrl } from "../services/backendUrl.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, webhookId } = await authenticate.webhook(request);

  const backendUrl = getAbsoluteBackendUrl();
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  if (!backendUrl || !secret) {
    console.error(
      "products/update forward skipped: absolute BACKEND_URL or INTERNAL_HANDOFF_SECRET missing",
    );
    return new Response();
  }

  const body = JSON.stringify({
    shop,
    topic,
    webhookId: webhookId ?? request.headers.get("x-shopify-webhook-id"),
    payload,
  });
  // Backend verify_internal_signature expects Unix seconds (not Date.now() ms).
  const ts = String(Math.floor(Date.now() / 1000));
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
