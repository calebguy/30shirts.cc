export type Currency =
  | "USD"
  | "EUR"
  | "CAD"
  | "GBP"
  | "AUD"
  | "NZD"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "INR"
  | "JPY"
  | "MYR"
  | "SGD"
  | "MXN"
  | "BRL"
  | "CHF";

export interface Money {
  value: number;
  currency: string;
}

export interface ProductImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  price: Money;
  color?: string;
  size?: string;
  available: boolean;
  images: ProductImage[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  descriptionHtml: string;
  available: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  price: Money;
}

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  size?: string;
  quantity: number;
  price: Money;
  images: ProductImage[];
}

export interface Cart {
  id: string;
  items: CartItem[];
}

export interface StorefrontConfig {
  token: string;
  checkoutDomain: string;
  currency: Currency;
}

const CURRENCY_BY_CODE: Record<Currency, Currency> = {
  USD: "USD",
  EUR: "EUR",
  CAD: "CAD",
  GBP: "GBP",
  AUD: "AUD",
  NZD: "NZD",
  SEK: "SEK",
  NOK: "NOK",
  DKK: "DKK",
  PLN: "PLN",
  INR: "INR",
  JPY: "JPY",
  MYR: "MYR",
  SGD: "SGD",
  MXN: "MXN",
  BRL: "BRL",
  CHF: "CHF",
};

export function parseCurrency(value: string): Currency {
  return CURRENCY_BY_CODE[value as Currency] ?? "USD";
}

export function formatMoney(money: Money): string {
  const fractionDigits = Number.isInteger(money.value) ? 0 : 2;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: money.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2,
  }).format(money.value);
}

export function cartTotal(cart: Cart): Money {
  const currency = cart.items[0]?.price.currency ?? "USD";
  const value = cart.items.reduce(
    (total, item) => total + item.price.value * item.quantity,
    0,
  );

  return { value, currency };
}

export function parseProductPage(value: unknown): {
  products: Product[];
  hasNextPage: boolean;
} {
  const page = requireRecord(value, "product page");
  const results = requireArray(page.results, "product page results");
  const paging = requireRecord(page.paging, "product page paging");
  const products = results.flatMap((result) => {
    const record = requireRecord(result, "product");
    return Array.isArray(record.variants) ? [parseProduct(record)] : [];
  });

  return {
    products,
    hasNextPage: requireBoolean(paging.hasNextPage, "next page flag"),
  };
}

export function parseProduct(value: unknown): Product {
  const product = requireRecord(value, "product");
  const variants = requireArray(product.variants, "product variants").map(
    parseVariant,
  );

  if (variants.length === 0) {
    throw new Error("Fourthwall returned a product without variants.");
  }

  const descriptionHtml = requireString(
    product.description,
    "product description",
  );

  return {
    id: requireString(product.id, "product id"),
    slug: requireString(product.slug, "product slug"),
    name: requireString(product.name, "product name"),
    description: productDescriptionHtmlToText(descriptionHtml),
    descriptionHtml,
    available: readType(product.state) === "AVAILABLE",
    images: requireArray(product.images, "product images").map(parseImage),
    variants,
    price: variants.reduce((lowest, variant) =>
      variant.price.value < lowest.value ? variant.price : lowest,
    variants[0].price),
  };
}

export function parseCart(value: unknown): Cart {
  const cart = requireRecord(value, "cart");

  return {
    id: requireString(cart.id, "cart id"),
    items: requireArray(cart.items, "cart items").map(parseCartItem),
  };
}

function parseVariant(value: unknown): ProductVariant {
  const variant = requireRecord(value, "product variant");
  const attributes = requireRecord(variant.attributes, "variant attributes");
  const images = requireArray(variant.images, "variant images");
  const stock = requireRecord(variant.stock, "variant stock");
  const stockType = requireString(stock.type, "variant stock type");
  const inStock = stockType === "UNLIMITED" || readNumber(stock.inStock) > 0;

  return {
    id: requireString(variant.id, "variant id"),
    name: requireString(variant.name, "variant name"),
    price: parseMoney(variant.unitPrice),
    color: readAttributeName(attributes.color),
    size: readAttributeName(attributes.size),
    available: inStock,
    images: images.map(parseImage),
  };
}

function parseCartItem(value: unknown): CartItem {
  const item = requireRecord(value, "cart item");
  const variant = requireRecord(item.variant, "cart item variant");
  const attributes = requireRecord(
    variant.attributes,
    "cart item variant attributes",
  );
  const product = requireRecord(variant.product, "cart item product");
  const images = requireArray(variant.images, "cart item images");

  return {
    variantId: requireString(variant.id, "cart variant id"),
    productId: requireString(product.id, "cart product id"),
    productName: requireString(product.name, "cart product name"),
    variantName: requireString(variant.name, "cart variant name"),
    size: readAttributeName(attributes.size),
    quantity: requireNumber(item.quantity, "cart item quantity"),
    price: parseMoney(variant.unitPrice),
    images: images.map(parseImage),
  };
}

function parseMoney(value: unknown): Money {
  const money = requireRecord(value, "money");
  return {
    value: requireNumber(money.value, "money value"),
    currency: requireString(money.currency, "money currency"),
  };
}

function parseImage(value: unknown): ProductImage {
  const image = requireRecord(value, "image");
  return {
    id: requireString(image.id, "image id"),
    url: requireString(image.transformedUrl ?? image.url, "image URL"),
    width: requireNumber(image.width, "image width"),
    height: requireNumber(image.height, "image height"),
  };
}

export function productDescriptionHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:li|ol|p|ul)>\s*/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readAttributeName(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = value.name ?? value.value;
  return typeof name === "string" ? name : undefined;
}

function readType(value: unknown): string | undefined {
  return isRecord(value) && typeof value.type === "string"
    ? value.type
    : undefined;
}

function readNumber(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Fourthwall returned an invalid ${field}.`);
  }
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Fourthwall returned an invalid ${field}.`);
  }
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Fourthwall returned an invalid ${field}.`);
  }
  return value;
}

function requireRecord(
  value: unknown,
  field: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Fourthwall returned an invalid ${field}.`);
  }
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Fourthwall returned an invalid ${field}.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
