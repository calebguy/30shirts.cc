import { useState } from "react";
import { Link } from "react-router";

import { AddToCartButton } from "../components/cart";
import { formatMoney, type Product } from "../lib/fourthwall";
import {
  FourthwallApiError,
  getProduct,
  getStorefrontConfig,
} from "../lib/fourthwall.server";
import type { Route } from "./+types/product";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) {
    return [
      {
        title: "Shirt not found — 30shirts.cc",
      },
    ];
  }

  return [
    {
      title: `${loaderData.product.name} — 30shirts.cc`,
    },
    { name: "description", content: loaderData.product.description },
  ];
}

export async function loader({
  params,
  request,
}: Route.LoaderArgs): Promise<{ product: Product }> {
  const storefront = getStorefrontConfig();
  if (!storefront) {
    throw new Response("Fourthwall storefront is not configured.", {
      status: 503,
      statusText: "Storefront not configured",
    });
  }

  try {
    const product = await getProduct({
      slug: params.slug,
      token: storefront.token,
      currency: storefront.currency,
      signal: request.signal,
    });
    return { product };
  } catch (cause) {
    if (cause instanceof FourthwallApiError && cause.status === 404) {
      throw new Response("Product not found.", { status: 404 });
    }
    throw cause;
  }
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const initialVariant =
    product.variants.find((variant) => variant.available) ?? product.variants[0];
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariant.id);
  const selectedVariant =
    product.variants.find((variant) => variant.id === selectedVariantId) ??
    initialVariant;
  const image = selectedVariant.images[0] ?? product.images[0];

  return (
    <main className="product-page">
      <Link className="back-link" to="/">
        ← All products
      </Link>
      <div className="product-page__layout">
        <div className="product-page__image">
          {image ? (
            <img
              src={image.url}
              width={image.width}
              height={image.height}
              alt={product.name}
              fetchPriority="high"
            />
          ) : null}
        </div>

        <section className="product-page__details">
          <h1>{product.name}</h1>
          <p className="product-price">{formatMoney(selectedVariant.price)}</p>
          <div
            className="product-description"
            dangerouslySetInnerHTML={{ __html: product.descriptionHtml }}
          />

          <label className="variant-picker">
            <span>Options</span>
            <select
              value={selectedVariantId}
              onChange={(event) => setSelectedVariantId(event.target.value)}
            >
              {product.variants.map((variant) => (
                <option
                  value={variant.id}
                  disabled={!variant.available}
                  key={variant.id}
                >
                  {variant.name}
                  {variant.available ? "" : " — Sold out"}
                </option>
              ))}
            </select>
          </label>

          <AddToCartButton variantId={selectedVariant.id} />
        </section>
      </div>
    </main>
  );
}
