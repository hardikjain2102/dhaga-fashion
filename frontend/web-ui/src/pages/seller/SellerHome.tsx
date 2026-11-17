import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import type { Product, SellerOrderItem } from "../../types";

const totalStock = (p: Product) => p.sizes.reduce((n, s) => n + s.stock, 0);

export default function SellerHome() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [items, setItems] = useState<SellerOrderItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listMyProducts(), api.listMyOrderItems()])
      .then(([p, i]) => {
        setProducts(p);
        setItems(i);
      })
      .catch(() => setError("Could not load your dashboard."));
  }, []);

  if (error) return <p role="alert" className="text-thread">{error}</p>;
  if (!products || !items) return <p className="text-muted">Loading...</p>;

  const outOfStock = products.filter((p) => totalStock(p) === 0);
  const low = products.filter((p) => totalStock(p) > 0 && totalStock(p) <= 5);
  const toShip = items.filter((i) => i.fulfilment !== "delivered");

  const stats = [
    { label: "Products", value: products.length, to: "/seller/products" },
    { label: "Items to fulfil", value: toShip.length, to: "/seller/orders" },
    { label: "Low stock (5 or fewer)", value: low.length, to: "/seller/products" },
    { label: "Out of stock", value: outOfStock.length, to: "/seller/products" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card p-5 hover:shadow-md">
            <p className="text-3xl font-display">{s.value}</p>
            <p className="mt-1 text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </div>

      {products.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-muted">You have no products yet.</p>
          <Link to="/seller/products/new" className="btn-primary mt-4">Add your first product</Link>
        </div>
      )}

      {(low.length > 0 || outOfStock.length > 0) && (
        <section className="card p-5">
          <h2 className="mb-2 text-xl">Needs restocking</h2>
          <ul className="space-y-1 text-sm">
            {[...outOfStock, ...low].map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>{p.name}</span>
                <span className={totalStock(p) === 0 ? "font-medium text-thread" : "text-muted"}>
                  {totalStock(p) === 0 ? "Out of stock" : `${totalStock(p)} left`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
