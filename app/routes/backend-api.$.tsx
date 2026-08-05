import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { proxyToBackend } from "../services/backendProxy.server";

/**
 * Same-origin API bridge for the embedded React UI.
 * Browser calls:  /backend-api/health  →  BACKEND_URL/health
 *                 /backend-api/api/... →  BACKEND_URL/api/...
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  return proxyToBackend(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return proxyToBackend(request);
};
