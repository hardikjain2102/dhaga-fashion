import { useEffect, useState } from "react";
import { ApiError, api } from "../../api";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatPrice } from "../../lib/format";
import type { Fulfilment, SellerOrderItem } from "../../types";

const ACTION: Record<Fulfilment, string | null> = {
  placed: "Mark as packed",
  packed: "Mark as shipped",
  shipped: "Mark as delivered",
  delivered: null,
};

export default function SellerOrders() {
  const [items, setItems] = useState<SellerOrderItem[] | null>(null);
  const [error, setError] = useState("");
  const [hideDone, setHideDone] = useState(true);
  const [busyKey, setBusyKey] = useState("");

  const reload = () =>
    api.listMyOrderItems().then(setItems).catch(() => setError("Could not load your orders."));

  useEffect(() => {
    void reload();
  }, []);

  const advance = async (i: SellerOrderItem) => {
    const key = `${i.orderId}|${i.productId}|${i.size}`;
    setBusyKey(key);
    setError("");
    try {
      await api.advanceFulfilment(i.orderId, i.productId, i.size);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the item.");
    } finally {
      setBusyKey("");
    }
  };

  const shown = (items ?? []).filter((i) => !hideDone || i.fulfilment !== "delivered");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Orders to fulfil</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />
          Hide delivered
        </label>
      </div>
      <p className="text-sm text-muted">
        Only paid orders appear here, and only the items you sell. Customers see status changes on their order page.
      </p>

      {error && <p role="alert" className="text-thread">{error}</p>}
      {!items && !error && <p className="text-muted">Loading...</p>}
      {items && shown.length === 0 && <p className="card p-6 text-center text-muted">Nothing to show.</p>}

      <ul className="space-y-3">
        {shown.map((i) => {
          const key = `${i.orderId}|${i.productId}|${i.size}`;
          const action = ACTION[i.fulfilment];
          return (
            <li key={key} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{i.name}</p>
                  <p className="text-sm text-muted">
                    Size {i.size} · {i.quantity} x {formatPrice(i.unitPrice)} · Order {i.orderId} · {formatDate(i.createdAt)}
                  </p>
                </div>
                <StatusBadge status={i.fulfilment} />
              </div>
              <p className="text-sm text-muted">
                Ship to: {i.address.fullName}, {i.address.phone}, {i.address.line1}, {i.address.city},{" "}
                {i.address.state} {i.address.pincode}
              </p>
              {action && (
                <button className="btn-primary" disabled={busyKey === key} onClick={() => advance(i)}>
                  {busyKey === key ? "Updating..." : action}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
