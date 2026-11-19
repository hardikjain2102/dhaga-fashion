import { useEffect, useState } from "react";
import { ApiError, api } from "../../api";
import type { AdminUser, Role, SellerStatus } from "../../types";

const statusStyle: Record<SellerStatus, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  suspended: "bg-red-100 text-red-900",
};

// Pending sellers first, so the work that needs attention is at the top.
const rank = (u: AdminUser) => (u.role === "seller" && u.sellerStatus === "pending" ? 0 : 1);

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [busyId, setBusyId] = useState("");

  const reload = () =>
    api
      .listUsers()
      .then(setUsers)
      .catch(() => setError("Could not load users."));

  useEffect(() => {
    void reload();
  }, []);

  const change = async (u: AdminUser, status: "approved" | "suspended") => {
    if (status === "suspended" && !window.confirm(`Suspend ${u.name}? They will lose seller access.`)) return;
    setBusyId(u.id);
    setError("");
    try {
      await api.setSellerStatus(u.id, status);
      await reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the seller.");
    } finally {
      setBusyId("");
    }
  };

  const shown = (users ?? [])
    .filter((u) => !role || u.role === role)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">Users</h2>
        <div>
          <label htmlFor="role" className="sr-only">Filter by role</label>
          <select id="role" className="input w-44" value={role} onChange={(e) => setRole(e.target.value as Role | "")}>
            <option value="">All roles</option>
            <option value="customer">Customers</option>
            <option value="seller">Sellers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-thread">{error}</p>}
      {!users && !error && <p className="text-muted">Loading...</p>}

      {users && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 text-muted">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Email</th>
                <th className="p-3 font-medium">Role</th>
                <th className="p-3 font-medium">Seller status</th>
                <th className="p-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {shown.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">
                    {u.role === "seller" && u.sellerStatus ? (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle[u.sellerStatus]}`}>
                        {u.sellerStatus}
                      </span>
                    ) : (
                      <span className="text-muted">n/a</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {u.role === "seller" && u.sellerStatus === "pending" && (
                      <>
                        <button className="btn-primary mr-2 px-3 py-1" disabled={busyId === u.id}
                                onClick={() => change(u, "approved")}>Approve</button>
                        <button className="btn-outline px-3 py-1" disabled={busyId === u.id}
                                onClick={() => change(u, "suspended")}>Suspend</button>
                      </>
                    )}
                    {u.role === "seller" && u.sellerStatus === "approved" && (
                      <button className="btn-outline px-3 py-1" disabled={busyId === u.id}
                              onClick={() => change(u, "suspended")}>Suspend</button>
                    )}
                    {u.role === "seller" && u.sellerStatus === "suspended" && (
                      <button className="btn-primary px-3 py-1" disabled={busyId === u.id}
                              onClick={() => change(u, "approved")}>Reinstate</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        Admins are never self-registered. In production the first admin is created by a one-time bootstrap Job.
      </p>
    </div>
  );
}
