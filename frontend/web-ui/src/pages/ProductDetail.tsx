import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { useAuth } from "../auth/AuthContext";
import { useCart } from "../cart/CartContext";
import { formatPrice } from "../lib/format";
import type { Product } from "../types";

export default function ProductDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { add } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .getProduct(id)
      .then((p) => live && setProduct(p))
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Could not load product."));
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="text-center">
        <p role="alert" className="text-thread">{error}</p>
        <Link to="/products" className="btn-outline mt-4">Back to shop</Link>
      </div>
    );
  }
  if (!product) return <p className="text-muted">Loading...</p>;

  const selected = product.sizes.find((s) => s.size === size);
  const maxQty = Math.min(selected?.stock ?? 1, 10);
  const isCustomer = user?.role === "customer";

  const onAdd = async () => {
    setMessage("");
    setError("");
    if (!user) {
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    if (!selected) {
      setMessage("Please choose a size.");
      return;
    }
    setBusy(true);
    try {
      await add(product.id, selected.size, qty);
      setMessage("Added to your cart.");
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : "Could not add to cart.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div
        className="h-80 rounded-lg md:h-full md:min-h-[26rem]"
        style={{ backgroundColor: product.swatch }}
        role="img"
        aria-label={`${product.name} colour swatch`}
      />

      <div className="space-y-5">
        <Link to="/products" className="text-sm text-muted underline">Back to shop</Link>
        <div>
          <p className="text-sm text-muted">{product.category} · by {product.sellerName}</p>
          <h1 className="mt-1 text-3xl">{product.name}</h1>
          <p className="mt-2 text-2xl">{formatPrice(product.price)}</p>
        </div>
        <p className="text-muted">{product.description}</p>

        <fieldset>
          <legend className="label">Size</legend>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <label
                key={s.size}
                className={`rounded-md border px-4 py-2 text-sm ${
                  s.stock === 0
                    ? "cursor-not-allowed border-sand-200 text-muted line-through"
                    : size === s.size
                    ? "cursor-pointer border-thread bg-thread-soft"
                    : "cursor-pointer border-sand-300 hover:bg-sand-100"
                }`}
              >
                <input
                  type="radio"
                  name="size"
                  value={s.size}
                  className="sr-only"
                  disabled={s.stock === 0}
                  checked={size === s.size}
                  onChange={() => {
                    setSize(s.size);
                    setQty(1);
                    setMessage("");
                  }}
                />
                {s.size}
              </label>
            ))}
          </div>
          {selected && (
            <p className="mt-2 text-xs text-muted">
              {selected.stock <= 3 ? `Only ${selected.stock} left` : `${selected.stock} in stock`}
            </p>
          )}
        </fieldset>

        {isCustomer || !user ? (
          <div className="flex items-end gap-3">
            <div>
              <label htmlFor="qty" className="label">Quantity</label>
              <select
                id="qty"
                className="input w-24"
                value={qty}
                disabled={!selected}
                onChange={(e) => setQty(Number(e.target.value))}
              >
                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <button className="btn-primary flex-1" onClick={onAdd} disabled={busy}>
              {busy ? "Adding..." : user ? "Add to cart" : "Log in to buy"}
            </button>
          </div>
        ) : (
          <p className="rounded-md bg-sand-100 p-3 text-sm text-muted">
            Only customer accounts can buy. You are signed in as a {user.role}.
          </p>
        )}

        {message && (
          <p role="status" className="text-sm">
            {message}{" "}
            {message.startsWith("Added") && (
              <Link to="/cart" className="text-thread underline">View cart</Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
