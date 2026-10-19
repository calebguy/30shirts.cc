import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { NavLink } from "react-router";

import {
  addCartItem,
  changeCartItemQuantity,
  createCart,
  createCheckoutUrl,
  FourthwallCartError,
  getCart,
} from "../lib/fourthwall-cart";
import {
  cartTotal,
  formatMoney,
  type Cart,
  type CartItem,
  type StorefrontConfig,
} from "../lib/fourthwall";

const CART_STORAGE_KEY = "30shirts.cc-cart";

interface CartContextValue {
  cart?: Cart;
  error?: string;
  pending: boolean;
  restoring: boolean;
  itemCount: number;
  addItem: (variantId: string) => Promise<void>;
  updateItemQuantity: (
    variantId: string,
    quantity: number,
  ) => Promise<boolean>;
  checkout: () => void;
}

interface CartProviderProps {
  children: ReactNode;
  config?: StorefrontConfig;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children, config }: CartProviderProps) {
  const [cart, setCart] = useState<Cart>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [restoring, setRestoring] = useState(Boolean(config));

  useEffect(() => {
    if (!config) {
      setRestoring(false);
      return;
    }

    const storefront = config;
    const storedCartId = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!storedCartId) {
      setRestoring(false);
      return;
    }
    const cartId = storedCartId;

    let cancelled = false;

    async function restoreCart() {
      try {
        const restoredCart = await getCart(storefront, cartId);
        if (!cancelled) {
          setCart(restoredCart);
        }
      } catch (cause) {
        if (cause instanceof FourthwallCartError && cause.status === 404) {
          window.localStorage.removeItem(CART_STORAGE_KEY);
          return;
        }

        if (!cancelled) {
          setError("We couldn't restore your cart. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setRestoring(false);
        }
      }
    }

    void restoreCart();
    return () => {
      cancelled = true;
    };
  }, [config]);

  async function addItem(variantId: string) {
    if (!config || pending) {
      return;
    }

    setPending(true);
    setError(undefined);

    try {
      const updatedCart = cart
        ? await addCartItem({
            config,
            cartId: cart.id,
            item: { variantId, quantity: 1 },
          })
        : await createCart(config, { variantId, quantity: 1 });

      window.localStorage.setItem(CART_STORAGE_KEY, updatedCart.id);
      setCart(updatedCart);
    } catch {
      setError("That shirt couldn't be added. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function updateItemQuantity(
    variantId: string,
    quantity: number,
  ): Promise<boolean> {
    if (
      !config ||
      !cart ||
      pending ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      return false;
    }

    setPending(true);
    setError(undefined);

    try {
      const updatedCart = await changeCartItemQuantity({
        config,
        cartId: cart.id,
        item: { variantId, quantity },
      });
      setCart(updatedCart);
      return true;
    } catch {
      setError("That quantity couldn't be updated. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function checkout() {
    if (!config || !cart || cart.items.length === 0) {
      return;
    }

    window.location.assign(createCheckoutUrl(config, cart.id));
  }

  const itemCount =
    cart?.items.reduce((total, item) => total + item.quantity, 0) ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        error,
        pending,
        restoring,
        itemCount,
        addItem,
        updateItemQuantity,
        checkout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return cart;
}

export function CartButton() {
  const { itemCount } = useCart();
  if (itemCount === 0) {
    return null;
  }

  return (
    <NavLink className="cart-trigger" to="/cart">
      Cart<span aria-label={`${itemCount} items`}>{itemCount}</span>
    </NavLink>
  );
}

export function AddToCartButton({ variantId }: { variantId: string }) {
  const { addItem, pending } = useCart();

  return (
    <button
      className="primary-button"
      type="button"
      disabled={pending}
      onClick={() => void addItem(variantId)}
    >
      {pending ? "Adding…" : "Add to cart"}
    </button>
  );
}

interface CartQuantityControlProps {
  item: CartItem;
  pending: boolean;
  onQuantityChange: (
    variantId: string,
    quantity: number,
  ) => Promise<boolean>;
}

function parseQuantity(value: string): number | undefined {
  if (!/^\d+$/.test(value)) {
    return undefined;
  }

  const quantity = Number(value);
  return Number.isSafeInteger(quantity) ? quantity : undefined;
}

function getProductGalleryPath(item: CartItem): string {
  const search = new URLSearchParams({ product: item.productId });
  if (item.size) {
    search.set("size", item.size);
  }

  return `/?${search}`;
}

function CartQuantityControl({
  item,
  pending,
  onQuantityChange,
}: CartQuantityControlProps) {
  const [draft, setDraft] = useState(String(item.quantity));

  useEffect(() => {
    setDraft(String(item.quantity));
  }, [item.quantity]);

  async function submitQuantity(quantity: number) {
    setDraft(String(quantity));

    if (quantity === item.quantity) {
      return;
    }

    const updated = await onQuantityChange(item.variantId, quantity);
    if (!updated) {
      setDraft(String(item.quantity));
    }
  }

  function commitDraft() {
    const quantity = parseQuantity(draft);
    if (quantity === undefined) {
      setDraft(String(item.quantity));
      return;
    }

    void submitQuantity(quantity);
  }

  function stepQuantity(change: number) {
    const currentQuantity = parseQuantity(draft) ?? item.quantity;
    void submitQuantity(Math.max(0, currentQuantity + change));
  }

  return (
    <div className="cart-item__quantity">
      <button
        type="button"
        aria-label={
          item.quantity === 1
            ? `Remove ${item.productName} from cart`
            : `Decrease quantity of ${item.productName}`
        }
        title={item.quantity === 1 ? "Remove" : "Decrease quantity"}
        disabled={pending}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => stepQuantity(-1)}
      >
        −
      </button>
      <input
        type="number"
        aria-label={`Quantity of ${item.productName}`}
        min="0"
        step="1"
        inputMode="numeric"
        value={draft}
        disabled={pending}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }

          if (event.key === "Escape") {
            setDraft(String(item.quantity));
            event.currentTarget.blur();
          }
        }}
      />
      <button
        type="button"
        aria-label={`Increase quantity of ${item.productName}`}
        title="Increase quantity"
        disabled={pending}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => stepQuantity(1)}
      >
        +
      </button>
    </div>
  );
}

interface CartLineItemProps {
  item: CartItem;
  pending: boolean;
  onQuantityChange: (
    variantId: string,
    quantity: number,
  ) => Promise<boolean>;
}

function CartLineItem({
  item,
  pending,
  onQuantityChange,
}: CartLineItemProps) {
  const [isBackVisible, setIsBackVisible] = useState(false);
  const frontImage = item.images[0];
  const backImage = item.images[1];

  return (
    <li className="cart-item">
      <button
        className="cart-item__artwork"
        type="button"
        aria-label={`Show ${isBackVisible ? "front" : "back"} of ${item.productName}`}
        aria-pressed={isBackVisible}
        data-side={isBackVisible ? "back" : "front"}
        data-size={item.size}
        disabled={!backImage}
        onClick={() => setIsBackVisible((current) => !current)}
      >
        <span className="shirt-viewer__views">
          {frontImage ? (
            <span className="shirt-viewer__face shirt-viewer__face--front">
              <img
                src={frontImage.url}
                width={frontImage.width}
                height={frontImage.height}
                alt=""
              />
            </span>
          ) : null}
          {backImage ? (
            <span className="shirt-viewer__face shirt-viewer__face--back">
              <img
                src={backImage.url}
                width={backImage.width}
                height={backImage.height}
                alt=""
              />
            </span>
          ) : null}
        </span>
      </button>
      <div className="cart-item__details">
        <NavLink
          className="cart-item__name"
          to={getProductGalleryPath(item)}
        >
          {item.productName}
        </NavLink>
      </div>
      <div className="cart-item__meta">
        <span>{item.size ?? item.variantName}</span>
        <CartQuantityControl
          item={item}
          pending={pending}
          onQuantityChange={onQuantityChange}
        />
      </div>
      <strong className="cart-item__total">
        {formatMoney({
          value: item.price.value * item.quantity,
          currency: item.price.currency,
        })}
      </strong>
    </li>
  );
}

export function CartPage() {
  const {
    cart,
    checkout,
    error,
    itemCount,
    pending,
    updateItemQuantity,
    restoring,
  } = useCart();

  const activeCart = cart?.items.length ? cart : undefined;

  return (
    <main className="cart-page">
      <section className="cart-panel" aria-label="Shopping cart">
      <header className="cart-page__header">
        <h1>
          Cart<span aria-label={`${itemCount} items`}>{itemCount}</span>
        </h1>
        <NavLink
          className="icon-button"
          aria-label="Return to the storefront"
          to="/"
        >
          ×
        </NavLink>
      </header>

      {error ? <p className="cart-error">{error}</p> : null}

      {restoring ? (
        <div className="empty-cart">
          <p>Loading cart…</p>
        </div>
      ) : activeCart ? (
        <>
          <ul className="cart-items">
            {activeCart.items.map((item) => (
              <CartLineItem
                item={item}
                pending={pending}
                onQuantityChange={updateItemQuantity}
                key={item.variantId}
              />
            ))}
          </ul>
          <footer className="cart-page__footer">
            <div className="cart-total">
              <strong>~{formatMoney(cartTotal(activeCart))}</strong>
            </div>
            <div className="cart-page__actions">
              <button
                className="primary-button"
                type="button"
                disabled={pending}
                onClick={checkout}
              >
                Pay
              </button>
            </div>
          </footer>
        </>
      ) : (
        <div className="empty-cart">
          <p>nothing</p>
        </div>
      )}
      </section>
    </main>
  );
}
