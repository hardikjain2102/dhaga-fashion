import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import { useCart } from "../cart/CartContext";
import { formatPrice } from "../lib/format";
import type { Address } from "../types";

const empty: Address = { fullName: "", phone: "", line1: "", city: "", state: "", pincode: "" };

export default function Checkout() {
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [addr, setAddr] = useState<Address>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddr((a) => ({ ...a, [key]: e.target.value }));

  if (cart.lines.length === 0) {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl">Nothing to check out</h1>
        <Link to="/products" className="btn-primary mt-6">Browse products</Link>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (addr.fullName.trim().length < 2) return setError("Please enter the recipient's name.");
    if (!/^\d{10}$/.test(addr.phone)) return setError("Phone must be 10 digits.");
    if (addr.line1.trim().length < 5) return setError("Please enter your address.");
    if (addr.city.trim().length < 2 || addr.state.trim().length < 2) return setError("Please enter city and state.");
    if (!/^\d{6}$/.test(addr.pincode)) return setError("Pincode must be 6 digits.");

    setBusy(true);
    try {
      const order = await api.checkout(addr);
      await refresh();
      navigate(`/pay/${order.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed. Try again.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Checkout</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <form onSubmit={onSubmit} className="card space-y-4 p-6 lg:col-span-2" noValidate>
          <h2 className="text-xl">Delivery address</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="fullName" className="label">Full name</label>
              <input id="fullName" className="input" autoComplete="name" value={addr.fullName} onChange={set("fullName")} />
            </div>
            <div>
              <label htmlFor="phone" className="label">Phone (10 digits)</label>
              <input id="phone" className="input" inputMode="numeric" autoComplete="tel-national" value={addr.phone} onChange={set("phone")} />
            </div>
          </div>
          <div>
            <label htmlFor="line1" className="label">Address</label>
            <input id="line1" className="input" autoComplete="street-address" value={addr.line1} onChange={set("line1")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="city" className="label">City</label>
              <input id="city" className="input" autoComplete="address-level2" value={addr.city} onChange={set("city")} />
            </div>
            <div>
              <label htmlFor="state" className="label">State</label>
              <input id="state" className="input" autoComplete="address-level1" value={addr.state} onChange={set("state")} />
            </div>
            <div>
              <label htmlFor="pincode" className="label">Pincode</label>
              <input id="pincode" className="input" inputMode="numeric" autoComplete="postal-code" value={addr.pincode} onChange={set("pincode")} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-thread">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Placing order..." : `Place order and pay ${formatPrice(cart.total)}`}
          </button>
        </form>

        <aside className="card h-fit space-y-3 p-5">
          <h2 className="text-xl">Order summary</h2>
          <ul className="space-y-2 text-sm">
            {cart.lines.map((l) => (
              <li key={`${l.productId}-${l.size}`} className="flex justify-between gap-2">
                <span>{l.name} ({l.size}) x {l.quantity}</span>
                <span>{formatPrice(l.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-sand-200 pt-3 font-medium">
            <span>Total</span>
            <span>{formatPrice(cart.total)}</span>
          </div>
          <p className="text-xs text-muted">
            Your items are held for 15 minutes while you pay. After that the order is cancelled and stock is released.
          </p>
        </aside>
      </div>
    </div>
  );
}
