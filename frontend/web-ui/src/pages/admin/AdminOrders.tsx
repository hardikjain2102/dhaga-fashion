import { useEffect, useState } from "react";
import { ApiError, api } from "../../api";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatPrice } from "../../lib/format";
import type { AdminOrder, Fulfilment, OrderStatus } from "../../types";

const ACTION: Record<Fulfilment, string | null> = {
  placed: "Mark as packed",
  packed: "Mark as shipped",
  shipped: "Mark as delivered",
  delivered: null,
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [busyKey, setBusyKey] = useState("");

  const reload = () =>
    api
      .adminListOrders()
      .then(setOrders)
      .catch(() => setError("Could not load orders."));

  useEffect(() => {
    void reload();
  }, []);

  const advance = async (orderId: string, productId: string, size: string) => {
    const key = `${orderId}|${productId}|${size}`;
    setBusyKey(key);
    setError("");
    try {
      await api.adminAdvanceFulfilment(orderId, productId, size);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the item.");
    } finally {
      setBusyKey("");
    }
  };

  const shown = (orders ?? []).filter((o) => !status || o.status === status);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">All orders</h2>
        <div>
          <label htmlFor="ostatus" className="sr-only">Filter by status</label>
          <select id="ostatus" className="input w-44" value={status}
                  onChange={(e) => setStatus(e.target.value as OrderStatus | "")}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-thread">{error}</p>}
      {!orders && !error && <p className="text-muted">Loading...</p>}
      {orders && shown.length === 0 && <p className="card p-6 text-center text-muted">No orders found.</p>}

      <ul className="space-y-3">
        {shown.map((o) => (
          <li key={o.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{o.id}</p>
                <p className="text-sm text-muted">
                  {o.customerName} ({o.customerEmail}) · {formatDate(o.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={o.status} />
                <span className="font-medium">{formatPrice(o.total)}</span>
              </div>
            </div>

            <ul className="divide-y divide-sand-200 text-sm">
              {o.items.map((i) => {
                const key = `${o.id}|${i.productId}|${i.size}`;
                const action = o.status === "PAID" ? ACTION[i.fulfilment] : null;
                return (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      {i.name} ({i.size}) x {i.quantity}{" "}
                      <span className="text-muted">sold by {i.sellerName}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {o.status === "PAID" && <StatusBadge status={i.fulfilment} />}
                      {action && (
                        <button className="btn-outline px-3 py-1" disabled={busyKey === key}
                                onClick={() => advance(o.id, i.productId, i.size)}>
                          {busyKey === key ? "Updating..." : action}
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
