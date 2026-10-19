import { CartPage } from "../components/cart";

export function meta() {
  return [
    { title: "Cart — 30shirts.cc" },
    { name: "description", content: "Review your 30shirts.cc cart." },
  ];
}

export default function Cart() {
  return <CartPage />;
}
