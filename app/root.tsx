import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { CartButton, CartProvider } from "./components/cart";
import type { StorefrontConfig } from "./lib/fourthwall";
import { getStorefrontConfig } from "./lib/fourthwall.server";
import type { Route } from "./+types/root";
import "./app.css";

export function loader(): { storefront?: StorefrontConfig } {
  const storefront = getStorefrontConfig();
  return storefront ? { storefront } : {};
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <meta
          name="theme-color"
          content="#f4f3ee"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#11110f"
          media="(prefers-color-scheme: dark)"
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <CartProvider config={loaderData.storefront}>
      <CartButton />
      <Outlet />
    </CartProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "The storefront could not load this page.";

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Shirt not found" : "Storefront error";
    details =
      error.status === 404
        ? "This release may have moved or is no longer available."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }

  return (
    <main className="error-page">
      <p className="eyebrow">30SHIRTS.CC</p>
      <h1>{title}</h1>
      <p>{details}</p>
      <NavLink className="text-link" to="/">
        Return to the archive
      </NavLink>
    </main>
  );
}
