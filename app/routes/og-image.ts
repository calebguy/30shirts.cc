import { env } from "cloudflare:workers";

import { getProduct, getStorefrontConfig } from "../lib/fourthwall.server";
import type { Route } from "./+types/og-image";

const TEMPLATE_PATH = "/og-template.png";
const FALLBACK_PATH = "/og-fallback.png";
const FONT_URL = "https://30shirts.cc/fonts/texgyreheros-regular.otf";
const PRODUCT_IMAGE_SIZE = 500;
const PRODUCT_IMAGE_LEFT = 640;
const PRODUCT_IMAGE_TOP = 55;
const DATE_FONT_SIZE = 180;
const DATE_LEFT = 120;
const DATE_TOP = 180;
const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
const FALLBACK_CACHE = "public, max-age=300, stale-while-revalidate=86400";

export async function loader({ params, request }: Route.LoaderArgs) {
  const storefront = getStorefrontConfig();
  if (!storefront) {
    return serveFallbackImage(request);
  }

  try {
    const product = await getProduct({
      slug: params.slug,
      token: storefront.token,
      currency: storefront.currency,
      signal: request.signal,
    });
    const productImage =
      product.images[0] ?? product.variants[0]?.images[0];

    if (!productImage) {
      throw new Error("Fourthwall returned a product without an OG image.");
    }

    return await renderOgImage(request, product.name, productImage.url);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "og_image_generation_failed",
        slug: params.slug,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return serveFallbackImage(request);
  }
}

function fetchStaticAsset(path: string, request: Request): Promise<Response> {
  return env.ASSETS.fetch(
    new Request(new URL(path, request.url), {
      method: "GET",
      signal: request.signal,
    }),
  );
}

async function renderOgImage(
  request: Request,
  productName: string,
  productImageUrl: string,
): Promise<Response> {
  const [templateResponse, productImageResponse] = await Promise.all([
    fetchStaticAsset(TEMPLATE_PATH, request),
    fetch(productImageUrl, {
      headers: { Accept: "image/*" },
      signal: request.signal,
    }),
  ]);

  if (!templateResponse.ok || !templateResponse.body) {
    throw new Error(
      `The OG image template could not be loaded (${templateResponse.status}).`,
    );
  }
  if (!productImageResponse.ok || !productImageResponse.body) {
    throw new Error("The Fourthwall product image could not be loaded.");
  }

  const [dateOverlay, productOverlay] = await Promise.all([
    env.IMAGES.text(productName, {
      font: { url: FONT_URL },
      color: "#171715",
      size: DATE_FONT_SIZE,
    }).output({ format: "image/png" }),
    env.IMAGES.input(productImageResponse.body)
      .transform({
        width: PRODUCT_IMAGE_SIZE,
        height: PRODUCT_IMAGE_SIZE,
        fit: "contain",
      })
      .output({ format: "image/png" }),
  ]);
  const result = await env.IMAGES.input(templateResponse.body)
    .draw(dateOverlay.image(), { left: DATE_LEFT, top: DATE_TOP })
    .draw(productOverlay.image(), {
      left: PRODUCT_IMAGE_LEFT,
      top: PRODUCT_IMAGE_TOP,
    })
    .output({ format: "image/png" });
  const filename = productName.replace(/[^a-zA-Z0-9_-]+/g, "-");

  return result.response({
    headers: {
      "Cache-Control": IMMUTABLE_CACHE,
      "Content-Disposition": `inline; filename="${filename}.png"`,
      "X-Robots-Tag": "noindex",
    },
  });
}

async function serveFallbackImage(request: Request): Promise<Response> {
  const response = await fetchStaticAsset(FALLBACK_PATH, request);
  if (!response.ok || !response.body) {
    return new Response("OG image unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers(response.headers);
  headers.set("Cache-Control", FALLBACK_CACHE);
  headers.set("Content-Type", "image/png");
  headers.set("X-Robots-Tag", "noindex");
  return new Response(response.body, { headers });
}

