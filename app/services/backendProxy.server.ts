/**
 * Proxies browser requests from /backend-api/* to the local FastAPI Backend.
 * Used on AWS UAT so the embedded UI can call same-origin `/backend-api/...`
 * while Node forwards to BACKEND_URL (typically http://127.0.0.1:8080).
 *
 * Never forwards browser traffic to FastAPI /internal/* routes.
 */

import { getAbsoluteBackendUrl } from "./backendUrl.server";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

/** Client must never set these on the upstream request. */
const BLOCKED_REQUEST_HEADERS = new Set([
  "x-internal-secret",
  "x-forwarded-host",
  "x-original-host",
]);

const CONNECT_MS = Number(process.env.BACKEND_PROXY_CONNECT_TIMEOUT_MS || 10_000);
const DEFAULT_MS = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 60_000);
const FILE_MS = Number(process.env.BACKEND_PROXY_FILE_TIMEOUT_MS || 120_000);

function isFileLikePath(pathname: string): boolean {
  return (
    pathname.includes("/output") ||
    pathname.includes("/download") ||
    pathname.includes("/image") ||
    pathname.includes("/steps/")
  );
}

function backendTargetPath(requestUrl: URL): { ok: true; path: string } | { ok: false; reason: string } {
  let pathname = requestUrl.pathname;
  if (pathname === "/backend-api" || pathname === "/backend-api/") {
    pathname = "/";
  } else if (pathname.startsWith("/backend-api/")) {
    pathname = pathname.slice("/backend-api".length) || "/";
  }

  // Normalize and reject path tricks
  if (pathname.includes("..")) {
    return { ok: false, reason: "Invalid path" };
  }

  // Internal handoff/webhook routes are server-to-server only
  if (pathname === "/internal" || pathname.startsWith("/internal/")) {
    return { ok: false, reason: "Internal routes are not available through this proxy" };
  }

  return { ok: true, path: `${pathname}${requestUrl.search}` };
}

function jsonError(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    {
      success: false,
      code,
      message,
      error: { message, code },
    },
    { status },
  );
}

export async function proxyToBackend(request: Request): Promise<Response> {
  const backendBase = getAbsoluteBackendUrl();
  if (!backendBase) {
    return jsonError(
      502,
      "BACKEND_URL_MISSING",
      "The processing backend is not configured.",
    );
  }

  const incoming = new URL(request.url);
  const mapped = backendTargetPath(incoming);
  if (!mapped.ok) {
    return jsonError(403, "BACKEND_PROXY_FORBIDDEN", mapped.reason);
  }

  const target = `${backendBase}${mapped.path}`;
  const timeoutMs = isFileLikePath(mapped.path) ? FILE_MS : DEFAULT_MS;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || BLOCKED_REQUEST_HEADERS.has(lower)) return;
    headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(Math.max(CONNECT_MS, timeoutMs)),
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const msg = err instanceof Error ? err.message : String(err);
    console.error("backend-api proxy upstream error", {
      path: mapped.path,
      name,
      message: msg,
    });

    if (name === "TimeoutError" || name === "AbortError" || /aborted|timeout/i.test(msg)) {
      return jsonError(
        504,
        "BACKEND_TIMEOUT",
        "The processing backend did not respond in time.",
      );
    }

    return jsonError(
      503,
      "BACKEND_TUNNEL_UNAVAILABLE",
      "The processing backend is temporarily unavailable.",
    );
  }

  const outHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    outHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: outHeaders,
  });
}
