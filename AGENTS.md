# 30shirts.cc project context

## Product

This is a minimal storefront that publishes one new shirt per day. Products are named by date, for example `09-27-2026`; the catalog becomes a chronological archive.

Keep the customer experience deliberately spare:

- The customer-facing name is `30shirts.cc`.
- The homepage is a master-detail storefront: focused shirt on the left, size and add controls in the center, and a scrollable archive on the right.
- Selecting an archive card updates the focused shirt without leaving the page.
- Archive cards show only the image, date/name, and price.
- Product pages show the image, date/name, price, options, and add-to-cart control.
- Keep transactional and accessibility copy, but do not add promotional prose, taglines, hero sections, release narratives, or decorative sections.
- Preserve the neutral black, white, and light-gray visual system.

The package and customer-facing identifiers use `30shirts.cc`. The Cloudflare Worker uses `30shirts-cc` because Wrangler permits only alphanumeric characters and dashes. The Fourthwall checkout domain remains externally managed and does not share the storefront name.

## Stack

- Bun is the package manager and command runner
- React 19
- React Router 8 in framework mode
- TypeScript
- Vite
- Cloudflare Workers via `@cloudflare/vite-plugin`
- Wrangler
- Fourthwall Storefront API for catalog, cart, and hosted checkout
- Plain CSS in `app/app.css`; there is no Tailwind dependency

## Important files

- `app/root.tsx`: document shell, floating cart trigger, cart provider, and error boundary
- `app/routes/home.tsx`: catalog loader and interactive master-detail storefront
- `app/routes/product.tsx`: product loader, variant selector, and add-to-cart surface
- `app/components/cart.tsx`: client-side cart state, drawer, persistence, and checkout redirect
- `app/lib/fourthwall.server.ts`: server-side catalog and product requests
- `app/lib/fourthwall.ts`: Fourthwall response parsing and shared commerce types
- `app/lib/fourthwall-cart.ts`: browser-side Fourthwall cart requests and checkout URL construction
- `app/app.css`: all storefront styling
- `workers/app.ts`: Cloudflare Worker entry point
- `wrangler.jsonc`: Worker configuration and deployed environment values
- `.dev.vars.example`: local environment template

## Fourthwall integration

Required bindings:

- `FOURTHWALL_STOREFRONT_TOKEN`
- `FOURTHWALL_CHECKOUT_DOMAIN`
- `FOURTHWALL_CURRENCY`

Do not copy credential values into documentation, logs, tests, or source examples. The Storefront token is a public browser-facing Fourthwall credential, but it should still be handled through configuration.

The current shop resolves through Fourthwall as:

- Fourthwall public/checkout domain: `30shirtscc-shop.fourthwall.com`
- Currency: `USD`

Do not replace the configured checkout domain with `30shirts.cc` unless that domain has first been configured for checkout in Fourthwall. The hosted checkout URL format is:

```text
https://<checkout-domain>/checkout/?cartCurrency=<currency>&cartId=<cart-id>
```

Fourthwall-specific behavior already accounted for:

- The homepage requests `/v1/collections/all/products` and follows `paging.hasNextPage` until every page is loaded.
- The live collection response does not reliably include the documented `type` or `createdAt` fields. Catalog entries are recognized by their `variants` array, and API order is preserved.
- Product details come from `/v1/products/<slug>`.
- Fourthwall's collection response and image CDN can briefly lag behind product-detail updates. The application does not implement an image cache.
- The cart ID is persisted under `30shirts.cc-cart`.
- Checkout is hosted by Fourthwall. Update its visible shop name in the Fourthwall dashboard; that text is not controlled by this repository.

## Application behavior

- If required Fourthwall configuration is absent, the homepage renders a minimal configuration screen.
- The catalog contains all regular Fourthwall products returned with variants.
- On desktop, the focused shirt and purchase controls remain fixed while the archive column scrolls.
- On mobile, the focused shirt and controls stack above a two-column archive. Selecting an archived shirt scrolls it into focus.
- The visible size range is `S`, `M`, `L`, `XL`, and `2XL`. Size selection persists when switching shirts. Both the focused shirt and archive previews scale from 50% at `S` to an intentionally oversized 130% at `2XL`; the focused shirt uses an overshooting 280 ms transform transition for a comical effect.
- Products with no available `S`–`2XL` variant display an orange `sold out` badge over both the focused artwork and archive preview, and their add button is disabled.
- Cart creation, restoration, item addition, item removal, totals, and checkout redirects are implemented.
- Product availability and variant stock are derived from Fourthwall responses.
- The app currently has no dedicated automated test suite.

## Commands

```bash
bun install
bun run dev
bun run typecheck
bun run build
bun run deploy
```

`bun run typecheck` regenerates Wrangler and React Router types before running TypeScript. Run both `bun run typecheck` and `bun run build` after code or configuration changes.

For UI changes, also run the actual storefront and verify the affected desktop and mobile surfaces in a browser. For commerce changes, exercise the relevant live Fourthwall path without submitting an order.

## Change guidelines

- Keep the implementation direct; this is a small storefront, not a general commerce framework.
- Reuse the existing Fourthwall parsers and request helpers instead of introducing a second API layer.
- Validate unknown API responses at the boundary before passing them to React.
- Keep Storefront API calls server-side except for cart operations, which are intentionally client-side.
- Preserve cart IDs across reloads and avoid changing checkout URL semantics.
- Do not add mock products or placeholder commerce behavior when Fourthwall is unavailable.
- Do not rename Cloudflare, Fourthwall, package, or cart-storage identifiers as part of a visual branding change.
- Avoid adding dependencies for behavior that the platform or a small local function already provides.