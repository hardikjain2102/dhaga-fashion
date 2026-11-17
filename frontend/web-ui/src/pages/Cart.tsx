import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api";
import { useCart } from "../cart/CartContext";
import { formatPrice } from "../lib/format";

export default function CartPage() {
  const { cart, setQuantity, remove } = useCart();
  const [error, setError] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the cart.");
    }
  };

  if (cart.lines.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl">Your cart is empty</h1>
        <p className="mt-2 text-muted">Find something you love.</p>
        <Link to="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Your cart</h1>
      {error && <p role="alert" className="text-thread">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <ul className="space-y-3 lg:col-span-2">
          {cart.lines.map((l) => (
            <li key={`${l.productId}-${l.size}`} className="card flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 rounded" style={{ backgroundColor: l.swatch }} aria-hidden="true" />
              <div className="flex-1">
                <Link to={`/products/${l.productId}`} className="font-medium hover:text-thread">{l.name}</Link>
                <p className="text-sm text-muted">Size {l.size} · {formatPrice(l.unitPrice)}</p>
                {l.quantity > l.available && (
                  <p className="text-sm text-thread">Only {l.available} available now. Reduce the quantity.</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="btn-outline px-2 py-1"
                    aria-label={`Decrease quantity of ${l.name}`}
                    onClick={() => run(() => setQuantity(l.productId, l.size, l.quantity - 1))}
                  >-</button>
                  <span className="w-6 text-center text-sm" aria-live="polite">{l.quantity}</span>
                  <button
                    className="btn-outline px-2 py-1"
                    aria-label={`Increase quantity of ${l.name}`}
                    disabled={l.quantity >= l.available}
                    onClick={() => run(() => setQuantity(l.productId, l.size, l.quantity + 1))}
                  >+</button>
                  <button
                    className="ml-3 text-sm text-muted underline"
                    onClick={() => run(() => remove(l.productId, l.size))}
                  >Remove</button>
                </div>
              </div>
              <p className="font-medium">{formatPrice(l.lineTotal)}</p>
            </li>
          ))}
        </ul>

        <aside className="card h-fit space-y-3 p-5">
          <h2 className="text-xl">Summary</h2>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Items ({cart.itemCount})</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <div className="flex justify-between border-t border-sand-200 pt-3 font-medium">
            <span>Total</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <Link
            to="/checkout"
            className={`btn-primary w-full ${cart.lines.some((l) => l.quantity > l.available) ? "pointer-events-none opacity-50" : ""}`}
          >
            Proceed to checkout
          </Link>
          <p className="text-xs text-muted">Stock is reserved when you place the order, not when you add to cart.</p>
        </aside>
      </div>
    </div>
  );
}
