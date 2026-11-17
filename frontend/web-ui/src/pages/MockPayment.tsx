import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { formatDate, formatPrice } from "../lib/format";
import type { Order } from "../types";

// DEVELOPMENT ONLY. In Milestone 5 this page is replaced by the Razorpay checkout widget (test mode);
// payment-svc verifies the HMAC signature before the order is marked PAID.
export default function MockPayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    let live = true;
    api
      .getOrder(orderId)
      .then((o) => {
        if (!live) return;
        if (o.status !== "PENDING") navigate(`/orders/${o.id}`, { replace: true });
        else setOrder(o);
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Could not load the order."));
    return () => {
      live = false;
    };
  }, [orderId, navigate]);

  const pay = async (outcome: "success" | "failure") => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      await api.payOrder(order.id, outcome);
      navigate(`/orders/${order.id}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Payment failed.");
      setBusy(false);
    }
  };

  if (error && !order) {
    return (
      <div className="text-center">
        <p role="alert" className="text-thread">{error}</p>
        <Link to="/orders" className="btn-outline mt-4">My orders</Link>
      </div>
    );
  }
  if (!order) return <p className="text-muted">Loading...</p>;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
        Mock payment page (test only). No real money moves.
      </div>
      <div className="card space-y-4 p-6">
        <h1 className="text-2xl">Pay {formatPrice(order.total)}</h1>
        <p className="text-sm text-muted">
          Order {order.id}. Items are held until {formatDate(order.expiresAt)}.
        </p>
        {error && <p role="alert" className="text-sm text-thread">{error}</p>}
        <button className="btn-primary w-full" disabled={busy} onClick={() => pay("success")}>
          {busy ? "Processing..." : "Pay now (simulate success)"}
        </button>
        <button className="btn-outline w-full" disabled={busy} onClick={() => pay("failure")}>
          Simulate failed payment
        </button>
      </div>
    </div>
  );
}
