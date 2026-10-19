import { env } from "cloudflare:workers";
import sanitizeHtml from "sanitize-html";

import type { Currency, Product, StorefrontConfig } from "./fourthwall";
import {
  parseCurrency,
  parseProduct,
  parseProductPage,
  productDescriptionHtmlToText,
} from "./fourthwall";

const FOURTHWALL_API_BASE = "https://storefront-api.fourthwall.com/v1";
const CATALOG_PAGE_SIZE = "50";
const PRODUCT_DESCRIPTION_TAGS = [
  "a",
  "b",
  "br",
  "code",
  "em",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "u",
  "ul",
];

interface CatalogRequest {
  token: string;
  currency: Currency;
  signal: AbortSignal;
}

interface ProductRequest extends CatalogRequest {
  slug: string;
}

export class FourthwallApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "FourthwallApiError";
  }
}
export function getStorefrontConfig(): StorefrontConfig | undefined {
  const token = env.FOURTHWALL_STOREFRONT_TOKEN.trim();
  const checkoutDomain = env.FOURTHWALL_CHECKOUT_DOMAIN.trim();

  if (!token || !checkoutDomain) {
    return undefined;
  }

  return {
    token,
    checkoutDomain,
    currency: parseCurrency(env.FOURTHWALL_CURRENCY),
  };
}

export async function listProducts(
  request: CatalogRequest,
): Promise<Product[]> {
  const products: Product[] = [];
  let pageNumber = 0;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = createApiUrl("/collections/all/products", request);
    url.searchParams.set("size", CATALOG_PAGE_SIZE);
    url.searchParams.set("page", String(pageNumber));

    const page = parseProductPage(await getJson(url, request.signal));
    products.push(...page.products.map(sanitizeProductDescription));
    hasNextPage = page.hasNextPage;
    pageNumber += 1;
  }

  return products;
}

export async function getProduct(
  request: ProductRequest,
): Promise<Product> {
  const url = createApiUrl(
    `/products/${encodeURIComponent(request.slug)}`,
    request,
  );
  const value = await getJson(url, request.signal);
  return sanitizeProductDescription(parseProduct(value));
}

function sanitizeProductDescription(product: Product): Product {
  const descriptionHtml = sanitizeHtml(product.descriptionHtml, {
    allowedTags: PRODUCT_DESCRIPTION_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });

  return {
    ...product,
    description: productDescriptionHtmlToText(descriptionHtml),
    descriptionHtml,
  };
}

async function getJson(url: URL, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new FourthwallApiError(
      `Fourthwall request failed with status ${response.status}.`,
      response.status,
    );
  }

  return response.json();
}

function createApiUrl(
  path: string,
  request: Pick<CatalogRequest, "token" | "currency">,
): URL {
  const url = new URL(`${FOURTHWALL_API_BASE}${path}`);
  url.searchParams.set("storefront_token", request.token);
  url.searchParams.set("currency", request.currency);
  return url;
}
