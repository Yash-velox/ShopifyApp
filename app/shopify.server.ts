import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import type { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-session-storage";
import { createHmac } from "node:crypto";
import prisma from "./db.server";
import { getAbsoluteBackendUrl } from "./services/backendUrl.server";

async function forwardInstallHandoff(session: {
  shop: string;
  accessToken: string;
  scope?: string | null;
  isOnline: boolean;
  refreshToken?: string | null;
  refreshTokenExpires?: Date | null;
  expires?: Date | null;
}) {
  if (session.isOnline) return;

  const backendUrl = getAbsoluteBackendUrl();
  const secret = process.env.INTERNAL_HANDOFF_SECRET;
  if (!backendUrl || !secret) {
    console.error(
      "Install handoff skipped: absolute BACKEND_URL or INTERNAL_HANDOFF_SECRET missing",
    );
    return;
  }

  const body = JSON.stringify({
    shop: session.shop,
    accessToken: session.accessToken,
    scope: session.scope ?? null,
    refreshToken: session.refreshToken ?? null,
    refreshTokenExpires: session.refreshTokenExpires?.toISOString() ?? null,
    // Access-token expiry (~24h). Must not send refresh-token expiry here.
    accessTokenExpires: session.expires?.toISOString() ?? null,
  });
  const ts = String(Date.now());
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

  const res = await fetch(`${backendUrl.replace(/\/$/, "")}/internal/shops/install`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Timestamp": ts,
      "X-Signature": sig,
    },
    body,
  });

  if (!res.ok) {
    console.error(`Install handoff failed: ${res.status} ${await res.text()}`);
  }
}

/**
 * Whenever Shopify persists an offline session (install or token refresh),
 * push the latest Admin API token into Backend shops so workers never use env.
 */
class BackendHandoffSessionStorage implements SessionStorage {
  constructor(private readonly inner: SessionStorage) {}

  async storeSession(session: Session): Promise<boolean> {
    const ok = await this.inner.storeSession(session);
    if (ok && !session.isOnline && session.accessToken) {
      try {
        await forwardInstallHandoff({
          shop: session.shop,
          accessToken: session.accessToken,
          scope: session.scope,
          isOnline: session.isOnline,
          refreshToken: session.refreshToken,
          refreshTokenExpires: session.refreshTokenExpires,
          expires: session.expires,
        });
      } catch (error) {
        console.error("Install handoff after storeSession failed", error);
      }
    }
    return ok;
  }

  loadSession(id: string) {
    return this.inner.loadSession(id);
  }

  deleteSession(id: string) {
    return this.inner.deleteSession(id);
  }

  deleteSessions(ids: string[]) {
    return this.inner.deleteSessions(ids);
  }

  findSessionsByShop(shop: string) {
    return this.inner.findSessionsByShop(shop);
  }
}

const sessionStorage = new BackendHandoffSessionStorage(new PrismaSessionStorage(prisma));

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.July26,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ session }) => {
      if (!session.accessToken) {
        console.error("Install handoff skipped: offline session missing accessToken");
        return;
      }
      await forwardInstallHandoff({
        shop: session.shop,
        accessToken: session.accessToken,
        scope: session.scope,
        isOnline: session.isOnline,
        refreshToken: session.refreshToken,
        refreshTokenExpires: session.refreshTokenExpires,
        expires: session.expires,
      });
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export { sessionStorage };
