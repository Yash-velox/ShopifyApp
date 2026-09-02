import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

interface LoginErrorMessage {
  shop?: string;
}

export function loginErrorMessage(loginErrors: LoginError): LoginErrorMessage {
  if (loginErrors?.shop === LoginErrorType.MissingShop) {
    return { shop: "Enter your store domain (e.g. your-store.myshopify.com)" };
  } else if (loginErrors?.shop === LoginErrorType.InvalidShop) {
    return { shop: "Enter a valid Shopify store domain ending in .myshopify.com" };
  }

  return {};
}
