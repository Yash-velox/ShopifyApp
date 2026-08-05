/**
 * Absolute Backend base URL for server-side handoffs and /backend-api proxy.
 * Must be an absolute http(s) URL — never fall back to relative VITE_API_BASE_URL
 * (e.g. `/backend-api`), which is for the browser only.
 */

export function getAbsoluteBackendUrl(): string | null {
  const raw = (process.env.BACKEND_URL || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) {
    console.error(
      `BACKEND_URL must be an absolute http(s) URL (got ${JSON.stringify(raw)}). ` +
        "Do not use relative paths like /backend-api here — that is for VITE_API_BASE_URL only.",
    );
    return null;
  }
  return raw.replace(/\/$/, "");
}
