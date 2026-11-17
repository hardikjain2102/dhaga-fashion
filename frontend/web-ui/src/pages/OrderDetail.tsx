import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import StatusBadge from "../components/StatusBadge";
import { formatDate, formatPrice } from "../lib/format";
import type { Order } from "../types";

const banner: Record<Order["status"], { cls: string; text: string }> = {
  PAID: { cls: "bg-green-50 text-green-900", text: "Payment received. Thank you! A confirmation email will be sent." },
  CANCELLED: { cls: "bg-red-50 text-red-900", text: "This order was cancelled and the reserved items were released." },
  PENDING: { cls: "bg-amber-50 text-amber-900", text: "Waiting for payment. Items are held until the time shown below." },
};

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    api
      .getOrder(id)
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the order."));
  }, [id]);

  if (error) {
    return (
      <div className="text-center">
        <p role="alert" className="text-thread">{error}</p>
        <Link to="/orders" className="btn-outline mt-4">My orders</Link>
      </div>
    );
  }
  if (!order) return <p className="text-muted">Loading...</p>;

  const b = banner[order.status];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/orders" className="text-sm text-muted underline">All orders</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">Order {order.id}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p role="status" className={`rounded-md p-3 text-sm ${b.cls}`}>{b.text}</p>

      {order.status === "PENDING" && (
        <div className="flex items-center gap-3">
          <Link to={`/pay/${order.id}`} className="btn-primary">Complete payment</Link>
          <span className="text-sm text-muted">Expires {formatDate(order.expiresAt)}</span>
        </div>
      )}

      <section className="card divide-y divide-sand-200">
        {order.items.map((i) => (
          <div key={`${i.productId}-${i.size}`} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <Link to={`/products/${i.productId}`} className="font-medium hover:text-thread">{i.name}</Link>
              <p className="text-sm text-muted">
                Size {i.size} · {i.quantity} x {formatPrice(i.unitPrice)} · sold by {i.sellerName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {order.status === "PAID" && <StatusBadge status={i.fulfilment} />}
              <span>{formatPrice(i.unitPrice * i.quantity)}</span>
            </div>
          </div>
        ))}
        <div className="flex justify-between p-4 font-medium">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-1 text-lg">Delivery address</h2>
        <p>{order.address.fullName} · {order.address.phone}</p>
        <p className="text-muted">
          {order.address.line1}, {order.address.city}, {order.address.state} {order.address.pincode}
        </p>
        <p className="mt-2 text-xs text-muted">Placed {formatDate(order.createdAt)}</p>
      </section>
    </div>
  );
}
