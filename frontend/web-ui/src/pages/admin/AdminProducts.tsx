import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../api";
import { formatPrice } from "../../lib/format";
import type { Product } from "../../types";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => setError("Could not load products."));
  }, []);

  const remove = async (p: Product) => {
    if (!window.confirm(`Remove "${p.name}" by ${p.sellerName}? This cannot be undone.`)) return;
    setError("");
    try {
      await api.adminDeleteProduct(p.id);
      setProducts((list) => (list ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove the product.");
    }
  };

  const f = filter.trim().toLowerCase();
  const shown = (products ?? []).filter(
    (p) => !f || p.name.toLowerCase().includes(f) || p.sellerName.toLowerCase().includes(f)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl">All products</h2>
        <div className="w-full sm:w-64">
          <label htmlFor="pfilter" className="sr-only">Filter by product or seller</label>
          <input id="pfilter" type="search" className="input" placeholder="Filter by product or seller"
                 value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>
      {error && <p role="alert" className="text-thread">{error}</p>}
      {!products && !error && <p role="status" className="text-muted">Loading...</p>}
      {products && shown.length === 0 && <p className="card p-6 text-center text-muted">No products found.</p>}

      {shown.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 text-muted">
              <tr>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Seller</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Total stock</th>
                <th className="p-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {shown.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 shrink-0 rounded" style={{ backgroundColor: p.swatch }} aria-hidden="true" />
                      <Link to={`/products/${p.id}`} className="font-medium hover:text-thread">{p.name}</Link>
                    </div>
                  </td>
                  <td className="p-3">{p.sellerName}</td>
                  <td className="p-3">{formatPrice(p.price)}</td>
                  <td className="p-3">{p.sizes.reduce((n, s) => n + s.stock, 0)}</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <button className="text-thread underline" onClick={() => remove(p)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
