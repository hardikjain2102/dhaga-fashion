import type { Fulfilment, OrderStatus } from "../types";

const styles: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  PAID: "bg-green-100 text-green-900",
  CANCELLED: "bg-red-100 text-red-900",
  placed: "bg-sand-200 text-ink",
  packed: "bg-blue-100 text-blue-900",
  shipped: "bg-indigo-100 text-indigo-900",
  delivered: "bg-green-100 text-green-900",
};

export default function StatusBadge({ status }: { status: OrderStatus | Fulfilment }) {
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${styles[status] ?? "bg-sand-200"}`}>
      {status}
    </span>
  );
}
