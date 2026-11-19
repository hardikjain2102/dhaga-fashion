import { NavLink, Outlet } from "react-router-dom";

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm transition ${isActive ? "bg-ink text-paper" : "hover:bg-sand-100"}`;

export default function AdminLayout() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl">Admin panel</h1>
        <nav className="flex flex-wrap gap-2" aria-label="Admin">
          <NavLink to="/admin" end className={tab}>Overview</NavLink>
          <NavLink to="/admin/users" className={tab}>Users</NavLink>
          <NavLink to="/admin/products" className={tab}>Products</NavLink>
          <NavLink to="/admin/orders" className={tab}>Orders</NavLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
