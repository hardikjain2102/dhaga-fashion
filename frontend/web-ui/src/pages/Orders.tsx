import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import StatusBadge from "../components/StatusBadge";
import { formatDate, formatPrice } from "../lib/format";
import type { Order } from "../types";

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listMyOrders().then(setOrders).catch(() => setError("Could not load your orders."));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">My orders</h1>
      {error && <p role="alert" className="text-thread">{error}</p>}
      {!orders && !error && <p role="status" className="text-muted">Loading...</p>}
      {orders && orders.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-muted">You haven't placed any orders yet.</p>
          <Link to="/products" className="btn-primary mt-4">Start shopping</Link>
        </div>
      )}
      {orders && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 hover:shadow-md">
                <div>
                  <p className="font-medium">{o.id}</p>
                  <p className="text-sm text-muted">
                    {formatDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={o.status} />
                  <span className="font-medium">{formatPrice(o.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
