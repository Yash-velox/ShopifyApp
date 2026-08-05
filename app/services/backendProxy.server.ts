/**
 * Proxies browser requests from /backend-api/* to the local FastAPI Backend.
 * Used on AWS UAT so the embedded UI can call same-origin `/backend-api/...`
 * while Node forwards to BACKEND_URL (typically http://127.0.0.1:8080).
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

function backendTargetPath(requestUrl: URL): string {
  // /backend-api/health → /health ; /backend-api → /
  let pathname = requestUrl.pathname;
  if (pathname === "/backend-api" || pathname === "/backend-api/") {
    pathname = "/";
  } else if (pathname.startsWith("/backend-api/")) {
    pathname = pathname.slice("/backend-api".length) || "/";
  }
  return `${pathname}${requestUrl.search}`;
}

export async function proxyToBackend(request: Request): Promise<Response> {
  const backendBase = getAbsoluteBackendUrl();
  if (!backendBase) {
    return Response.json(
      {
        error: "BACKEND_URL is not configured as an absolute http(s) URL",
        code: "BACKEND_URL_MISSING",
      },
      { status: 502 },
    );
  }

  const incoming = new URL(request.url);
  const target = `${backendBase}${backendTargetPath(incoming)}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error("backend-api proxy upstream error", { target, err });
    return Response.json(
      {
        error: "Backend unreachable",
        code: "BACKEND_UNREACHABLE",
        target,
      },
      { status: 502 },
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
