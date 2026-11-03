import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("cart", "routes/cart.tsx"),
  route("products/:slug", "routes/product.tsx"),
  route("og/:slug/image.png", "routes/og-image.ts"),
] satisfies RouteConfig;
