import { useSyncExternalStore } from "react";

import type { Product, ProductVariant } from "./fourthwall";

export const DEFAULT_SIZE = "L";

const DISPLAYED_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
export type ColorScheme = "light" | "dark";

interface ThemeColors {
  light: string;
  dark: string;
}

const THEME_COLORS_BY_PRODUCT_SLUG: Partial<Record<string, ThemeColors>> = {
  "11-06": { light: "white", dark: "black" },
};

export function usePreferredColorScheme(): ColorScheme {
  return useSyncExternalStore(
    subscribeToColorScheme,
    getBrowserColorScheme,
    getServerColorScheme,
  );
}

export function getDisplayedVariants(
  product: Product,
  colorScheme: ColorScheme,
): ProductVariant[] {
  const variants = getColorSchemeVariants(product, colorScheme);
  const apparelVariants = DISPLAYED_SIZES.flatMap((size) =>
    variants.filter((variant) => variant.size === size),
  );

  return apparelVariants.length > 0 ? apparelVariants : variants;
}

export function isApparelSize(
  size: string | undefined,
): size is (typeof DISPLAYED_SIZES)[number] {
  return DISPLAYED_SIZES.some((apparelSize) => apparelSize === size);
}

export function getInitialVariant(
  product: Product,
  colorScheme: ColorScheme,
): ProductVariant {
  const displayedVariants = getDisplayedVariants(product, colorScheme);
  const variant =
    displayedVariants.find(
      (candidate) => candidate.size === DEFAULT_SIZE && candidate.available,
    ) ??
    displayedVariants.find((candidate) => candidate.available) ??
    displayedVariants.find((candidate) => candidate.size === DEFAULT_SIZE) ??
    displayedVariants[0];

  if (!variant) {
    throw new Error(`Product ${product.id} has no purchasable variants.`);
  }

  return variant;
}

export function isSoldOut(
  product: Product,
  colorScheme: ColorScheme,
): boolean {
  return (
    !product.available ||
    getDisplayedVariants(product, colorScheme).every(
      (variant) => !variant.available,
    )
  );
}

function getColorSchemeVariants(
  product: Product,
  colorScheme: ColorScheme,
): ProductVariant[] {
  const themeColors = THEME_COLORS_BY_PRODUCT_SLUG[product.slug];
  if (!themeColors) {
    return product.variants;
  }

  const preferredColor = themeColors[colorScheme];
  const preferredVariants = product.variants.filter(
    (variant) => variant.color?.toLowerCase() === preferredColor,
  );

  return preferredVariants.length > 0 ? preferredVariants : product.variants;
}

function subscribeToColorScheme(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const mediaQuery = window.matchMedia(COLOR_SCHEME_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getBrowserColorScheme(): ColorScheme {
  return typeof window !== "undefined" &&
    window.matchMedia(COLOR_SCHEME_QUERY).matches
    ? "dark"
    : "light";
}

function getServerColorScheme(): ColorScheme {
  return "light";
}
