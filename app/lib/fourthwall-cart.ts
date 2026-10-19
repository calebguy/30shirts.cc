import type { Cart, StorefrontConfig } from "./fourthwall";
import { parseCart } from "./fourthwall";

const FOURTHWALL_API_BASE = "https://storefront-api.fourthwall.com/v1";

interface CartItemRequest {
  variantId: string;
  quantity: number;
}

interface CartMutationRequest {
  config: StorefrontConfig;
  cartId: string;
  item: CartItemRequest;
}

export class FourthwallCartError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FourthwallCartError";
  }
}

export async function createCart(
  config: StorefrontConfig,
  item: CartItemRequest,
): Promise<Cart> {
  return requestCart(config, "/carts", {
    method: "POST",
    body: JSON.stringify({ items: [item] }),
  });
}

export async function getCart(
  config: StorefrontConfig,
  cartId: string,
): Promise<Cart> {
  return requestCart(config, `/carts/${encodeURIComponent(cartId)}`);
}

export async function addCartItem(
  request: CartMutationRequest,
): Promise<Cart> {
  return requestCart(
    request.config,
    `/carts/${encodeURIComponent(request.cartId)}/add`,
    {
      method: "POST",
      body: JSON.stringify({ items: [request.item] }),
    },
  );
}

export async function changeCartItemQuantity(
  request: CartMutationRequest,
): Promise<Cart> {
  return requestCart(
    request.config,
    `/carts/${encodeURIComponent(request.cartId)}/change`,
    {
      method: "POST",
      body: JSON.stringify({ items: [request.item] }),
    },
  );
}

export function createCheckoutUrl(
  config: StorefrontConfig,
  cartId: string,
): string {
  const domain = config.checkoutDomain.trim().replace(/^https?:\/\//, "");
  const url = new URL(`https://${domain}/checkout/`);
  url.searchParams.set("cartCurrency", config.currency);
  url.searchParams.set("cartId", cartId);
  return url.toString();
}

async function requestCart(
  config: StorefrontConfig,
  path: string,
  init?: RequestInit,
): Promise<Cart> {
  const url = new URL(`${FOURTHWALL_API_BASE}${path}`);
  url.searchParams.set("storefront_token", config.token);
  url.searchParams.set("currency", config.currency);

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new FourthwallCartError(
      `Fourthwall cart request failed with status ${response.status}.`,
      response.status,
    );
  }

  return parseCart(await response.json());
}
