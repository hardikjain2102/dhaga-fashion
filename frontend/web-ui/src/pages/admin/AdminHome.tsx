import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { formatPrice } from "../../lib/format";
import type { AdminOrder, AdminUser, Product } from "../../types";

interface Data {
  users: AdminUser[];
  products: Product[];
  orders: AdminOrder[];
}

export default function AdminHome() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.listUsers(), api.listProducts(), api.adminListOrders()])
      .then(([users, products, orders]) => setData({ users, products, orders }))
      .catch(() => setError("Could not load the overview."));
  }, []);

  if (error) return <p role="alert" className="text-thread">{error}</p>;
  if (!data) return <p role="status" className="text-muted">Loading...</p>;

  const customers = data.users.filter((u) => u.role === "customer").length;
  const sellers = data.users.filter((u) => u.role === "seller");
  const pending = sellers.filter((u) => u.sellerStatus === "pending").length;
  const paid = data.orders.filter((o) => o.status === "PAID");
  const revenue = paid.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    { label: "Customers", value: String(customers), to: "/admin/users" },
    { label: "Sellers", value: String(sellers.length), to: "/admin/users" },
    { label: "Sellers awaiting approval", value: String(pending), to: "/admin/users", highlight: pending > 0 },
    { label: "Products", value: String(data.products.length), to: "/admin/products" },
    { label: "Orders (all statuses)", value: String(data.orders.length), to: "/admin/orders" },
    { label: "Paid revenue", value: formatPrice(revenue), to: "/admin/orders" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={`card p-5 hover:shadow-md ${s.highlight ? "border-thread" : ""}`}
          >
            <p className="font-display text-3xl">{s.value}</p>
            <p className="mt-1 text-sm text-muted">{s.label}</p>
          </Link>
        ))}
      </div>
      {pending > 0 && (
        <p className="rounded-md bg-thread-soft p-3 text-sm">
          {pending} seller(s) are waiting for approval.{" "}
          <Link to="/admin/users" className="underline">Review them</Link>
        </p>
      )}
    </div>
  );
}
