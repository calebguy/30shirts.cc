# 30shirts.cc

One shirt published every day. React Router renders on Cloudflare Workers; Fourthwall provides the product catalog, cart, hosted checkout, payments, and fulfillment.

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
