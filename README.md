# 30shirts.cc

One shirt published every day. React Router renders on Cloudflare Workers; Fourthwall provides the product catalog, cart, hosted checkout, payments, and fulfillment.

On mobile, the selected shirt fills the first viewport, with its size selector and add button aligned at the bottom; scrolling reveals the archive below. Sizes wrap on narrow screens, and enlarged shirt previews do not cause horizontal page scrolling. The add and cart-close controls use the size buttons' padding and typography at every viewport width.

Archive cards show the price of the size that will be selected when opening that shirt, rather than the lowest variant price.

Fourthwall's first two images provide the front and back shirt views. The third image is the background behind the shirt in both the focused viewer and archive/cart previews; it is not a reference slide. Images from the fourth onward are horizontal reference slides. Each slide occupies the full viewer width, so the next image appears only after navigating. Shirt and reference images retain their aspect ratios without cropping at their default size; selecting a larger shirt size still scales the artwork. Select a reference to open its full image in a new tab. The focused viewer starts on the shirt (tap to flip), and selecting another shirt returns it to the first slide. Where an image has no background, its container shows the storefront's page color rather than a gray tile. Cart quantity-control borders match the text color, with space separating the size from the quantity selector.

When reference slides exist, edge arrows navigate them and a full-width indicator at the bottom of the viewer shows the current slide instead of the native scrollbar. Arrows remain visible but disabled at either end; swiping, horizontal scrolling, and keyboard navigation still work. The front/back flip shares the shirt's first position; shirts without references have no arrows or indicator.

## Local setup

Install dependencies:

```bash
bun install
```

Create the local Worker environment file:

```bash
cp .dev.vars.example .dev.vars
```

Set these values in `.dev.vars`:

- `FOURTHWALL_STOREFRONT_TOKEN`: Fourthwall **Settings → For Developers → Headless**
- `FOURTHWALL_CHECKOUT_DOMAIN`: the shop hostname, without `https://`
- `FOURTHWALL_CURRENCY`: a Fourthwall-supported currency code; defaults to `USD`

Start the application:

```bash
bun run dev
```

The storefront is available at `http://localhost:5173`.

## Verification

```bash
bun run typecheck
bun run build
```

`typecheck` regenerates Cloudflare Worker binding types before checking the React Router application.

## Deployment

Store the production Fourthwall token as a Worker secret:

```bash
bunx wrangler secret put FOURTHWALL_STOREFRONT_TOKEN
```

The non-secret checkout domain and currency, plus the `30shirts.cc` custom-domain routes, are configured in `wrangler.jsonc`. Deploy with:

```bash
bun run deploy
```

The Storefront token is a public storefront credential used by Fourthwall's browser-facing Storefront API. Product creation uses Fourthwall's separate Platform API and should use server-side credentials.
