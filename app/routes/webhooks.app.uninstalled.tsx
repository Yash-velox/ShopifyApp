import type { ActionFunctionArgs } from "react-router";
import { createHmac } from "node:crypto";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getAbsoluteBackendUrl } from "../services/backendUrl.server";

async function forwardUninstall(shop: string) {
  const backendUrl = getAbsoluteBackendUrl();
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  if (!backendUrl || !secret) {
    console.error(
      "Uninstall handoff skipped: absolute BACKEND_URL or INTERNAL_HANDOFF_SECRET missing",
    );
    return;
  }
  const body = JSON.stringify({ shop });
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/internal/shops/uninstall`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Signature": sig,
    },
    body,
  });
  if (!res.ok) {
    console.error(`Uninstall handoff failed: ${res.status}`);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  await forwardUninstall(shop);

  return new Response();
};
