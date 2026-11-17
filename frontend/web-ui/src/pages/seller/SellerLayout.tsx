import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${isActive ? "bg-ink text-paper" : "hover:bg-sand-100"}`;

// Wraps every /seller/* page. Sellers who are not approved only ever see the status screen.
export default function SellerLayout() {
  const { user, refreshUser } = useAuth();
  const [checked, setChecked] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    void refreshUser().finally(() => setChecked(true));
  }, [refreshUser]);

  const recheck = async () => {
    setChecking(true);
    await refreshUser();
    setChecking(false);
  };

  if (!checked) return <p className="text-muted">Checking your seller account...</p>;

  if (user?.sellerStatus === "suspended") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl">Account suspended</h1>
        <p className="mt-2 text-muted">
          Your seller account has been suspended, so you cannot manage products or orders.
          Please contact support.
        </p>
      </div>
    );
  }

  if (user?.sellerStatus !== "approved") {
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl">Awaiting approval</h1>
        <p className="mt-2 text-muted">
          Thanks for signing up, {user?.name}. An admin needs to approve your seller account before you
          can list products. This usually happens within a day.
        </p>
        <button className="btn-outline mt-6" onClick={recheck} disabled={checking}>
          {checking ? "Checking..." : "Check status again"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Seller dashboard</h1>
        <nav className="flex gap-2" aria-label="Seller">
          <NavLink to="/seller" end className={tab}>Overview</NavLink>
          <NavLink to="/seller/products" className={tab}>Products</NavLink>
          <NavLink to="/seller/orders" className={tab}>Orders</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
