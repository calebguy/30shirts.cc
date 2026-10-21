import { useRef, useState } from "react";
import { useSearchParams } from "react-router";

import { useCart } from "../components/cart";
import {
  formatMoney,
  type Product,
  type ProductVariant,
} from "../lib/fourthwall";
import {
  getStorefrontConfig,
  listProducts,
} from "../lib/fourthwall.server";
import type { Route } from "./+types/home";

interface ReadyStorefront {
  state: "ready";
  products: Product[];
}

interface UnconfiguredStorefront {
  state: "unconfigured";
}

type LoaderData = ReadyStorefront | UnconfiguredStorefront;

const DISPLAYED_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
const DEFAULT_SIZE = "L";

type ProductView = "front" | "back";

export function meta() {
  return [
    { title: "30shirts.cc" },
    { name: "description", content: "One shirt for every day of November." },
  ];
}

export async function loader({ request }: Route.LoaderArgs): Promise<LoaderData> {
  const storefront = getStorefrontConfig();
  if (!storefront) {
    return { state: "unconfigured" };
  }

  const products = await listProducts({
    token: storefront.token,
    currency: storefront.currency,
    signal: request.signal,
  });

  return { state: "ready", products };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  if (loaderData.state === "unconfigured") {
    return <StorefrontSetup />;
  }

  if (loaderData.products.length === 0) {
    return (
      <main className="empty-catalog">
        <p>No shirts available.</p>
      </main>
    );
  }

  return <Storefront products={loaderData.products} />;
}

function Storefront({ products }: { products: Product[] }) {
  const [searchParams] = useSearchParams();
  const requestedProductId = searchParams.get("product");
  const initialProduct =
    products.find((product) => product.id === requestedProductId) ?? products[0];
  const requestedSize = searchParams.get("size");
  const initialVariant =
    getDisplayedVariants(initialProduct).find(
      (variant) => variant.size === requestedSize,
    ) ?? getInitialVariant(initialProduct);
  const [selection, setSelection] = useState(() => ({
    productId: initialProduct.id,
    selectedSize: initialVariant.size ?? DEFAULT_SIZE,
  }));
  const [productView, setProductView] = useState<ProductView>("front");
  const focusRef = useRef<HTMLElement>(null);
  const { addItem, pending } = useCart();
  const selectedProduct =
    products.find((product) => product.id === selection.productId) ??
    initialProduct;
  const displayedVariants = getDisplayedVariants(selectedProduct);
  const selectedVariant =
    displayedVariants.find(
      (variant) => variant.size === selection.selectedSize,
    ) ?? getInitialVariant(selectedProduct);
  const selectedImage = selectedVariant.images[0] ?? selectedProduct.images[0];
  const selectedBackImage =
    selectedVariant.images[1] ?? selectedProduct.images[1];
  const selectedProductSoldOut = isSoldOut(selectedProduct);
  const productDescriptionHtml = selectedProduct.descriptionHtml.trim();
  const referenceImages = selectedProduct.images.slice(2, 6);
  const activeProductView =
    productView === "back" && selectedBackImage ? "back" : "front";
  const nextProductView =
    activeProductView === "front" && selectedBackImage ? "back" : "front";

  function selectProduct(product: Product) {
    if (product.id === selectedProduct.id) {
      return;
    }

    const nextVariant =
      getDisplayedVariants(product).find(
        (variant) => variant.size === selection.selectedSize,
      ) ?? getInitialVariant(product);
    const selectedSize = nextVariant.size ?? selection.selectedSize;

    setSelection({ productId: product.id, selectedSize });
    replaceGalleryUrl(product.id, selectedSize);
    setProductView("front");

    if (window.matchMedia("(max-width: 760px)").matches) {
      const behavior = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches
        ? "auto"
        : "smooth";
      requestAnimationFrame(() => {
        focusRef.current?.scrollIntoView({ behavior, block: "start" });
      });
    }
  }

  function selectSize(variant: ProductVariant) {
    const selectedSize = variant.size ?? selection.selectedSize;
    setSelection((current) => ({ ...current, selectedSize }));
    replaceGalleryUrl(selectedProduct.id, selectedSize);
  }

  return (
    <main className="storefront">
      <div className="storefront__featured">
        <section className="product-focus" ref={focusRef} tabIndex={-1}>
          <div className="product-focus__viewer">
            {referenceImages.length > 0 ? (
              <div className="product-focus__references" aria-hidden="true">
                {referenceImages.map((image) => (
                  <img
                    src={image.url}
                    width={image.width}
                    height={image.height}
                    alt=""
                    decoding="async"
                    key={image.id}
                  />
                ))}
              </div>
            ) : null}

            <button
              className="product-focus__artwork"
              type="button"
              aria-label={`Show ${nextProductView} of ${selectedProduct.name}`}
              data-side={activeProductView}
              data-size={selectedVariant.size}
              disabled={!selectedBackImage}
              onClick={() => setProductView(nextProductView)}
            >
              <span className="shirt-viewer__views">
                {selectedImage ? (
                  <span className="shirt-viewer__face shirt-viewer__face--front">
                    <img
                      src={selectedImage.url}
                      width={selectedImage.width}
                      height={selectedImage.height}
                      alt=""
                      fetchPriority="high"
                    />
                  </span>
                ) : null}
                {selectedBackImage ? (
                  <span className="shirt-viewer__face shirt-viewer__face--back">
                    <img
                      src={selectedBackImage.url}
                      width={selectedBackImage.width}
                      height={selectedBackImage.height}
                      alt=""
                    />
                  </span>
                ) : null}
              </span>

              {selectedProductSoldOut ? (
                <span className="sold-out-badge">sold out</span>
              ) : null}
            </button>
          </div>

          <div className="product-focus__details">
            <div className="product-focus__caption">
              <h1>{selectedProduct.name}</h1>
              <span>{formatMoney(selectedVariant.price)}</span>
            </div>
            {productDescriptionHtml ? (
              <div
                className="product-focus__description"
                dangerouslySetInnerHTML={{ __html: productDescriptionHtml }}
              />
            ) : null}
          </div>
        </section>

        <aside
          className="purchase-panel"
          aria-label={`Purchase ${selectedProduct.name}`}
        >
          <fieldset className="size-picker">
            <legend className="visually-hidden">Size</legend>
            <div>
              {displayedVariants.map((variant) => (
                <button
                  className={
                    variant.id === selectedVariant.id ? "is-selected" : undefined
                  }
                  type="button"
                  aria-pressed={variant.id === selectedVariant.id}
                  disabled={!variant.available}
                  key={variant.id}
                  onClick={() => selectSize(variant)}
                >
                  {variant.size ?? variant.name}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            className="quick-add"
            type="button"
            disabled={
              pending || selectedProductSoldOut || !selectedVariant.available
            }
            onClick={() => void addItem(selectedVariant.id)}
          >
            <span aria-hidden="true">{pending ? "…" : "+"}</span>
          </button>
        </aside>
      </div>

      <section className="archive" aria-label="Shirt archive">
        <h2 className="visually-hidden">Shirt archive</h2>
        <div className="archive__list">
          {products.map((product, index) => {
            const image = product.images[0];
            const isSelected = product.id === selectedProduct.id;
            const soldOut = isSoldOut(product);

            return (
              <button
                className={`archive-card${isSelected ? " is-selected" : ""}`}
                type="button"
                aria-label={`View ${product.name}${soldOut ? ", sold out" : ""}`}
                aria-pressed={isSelected}
                key={product.id}
                onClick={() => selectProduct(product)}
              >
                <span
                  className="archive-card__artwork"
                  data-size={selection.selectedSize}
                >
                  {image ? (
                    <img
                      src={image.url}
                      width={image.width}
                      height={image.height}
                      alt=""
                      loading={index < 2 ? "eager" : "lazy"}
                    />
                  ) : null}
                  {soldOut ? (
                    <span className="sold-out-badge">sold out</span>
                  ) : null}
                </span>
                <span className="archive-card__caption">
                  <strong>{product.name}</strong>
                  <span>{formatMoney(product.price)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <p className="visually-hidden" aria-live="polite">
        {selectedProduct.name} selected
      </p>
    </main>
  );
}



function replaceGalleryUrl(productId: string, size: string) {
  const search = new URLSearchParams({ product: productId, size });
  window.history.replaceState(window.history.state, "", `/?${search}`);
}

function getDisplayedVariants(product: Product): ProductVariant[] {
  return DISPLAYED_SIZES.flatMap((size) =>
    product.variants.filter((variant) => variant.size === size),
  );
}

function isSoldOut(product: Product): boolean {
  return (
    !product.available ||
    getDisplayedVariants(product).every((variant) => !variant.available)
  );
}

function getInitialVariant(product: Product): ProductVariant {
  const displayedVariants = getDisplayedVariants(product);
  const variant =
    displayedVariants.find(
      (candidate) => candidate.size === DEFAULT_SIZE && candidate.available,
    ) ??
    displayedVariants.find((candidate) => candidate.available) ??
    displayedVariants.find((candidate) => candidate.size === DEFAULT_SIZE) ??
    displayedVariants[0];

  if (!variant) {
    throw new Error(`Product ${product.id} has no supported size variants.`);
  }

  return variant;
}

function StorefrontSetup() {
  return (
    <main className="setup-page">
      <h1>Connect Fourthwall</h1>
      <div className="setup-values">
        <code>FOURTHWALL_STOREFRONT_TOKEN</code>
        <code>FOURTHWALL_CHECKOUT_DOMAIN</code>
      </div>
    </main>
  );
}
