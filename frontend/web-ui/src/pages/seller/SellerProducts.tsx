import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../../api";
import { formatPrice } from "../../lib/format";
import type { Product } from "../../types";

export default function SellerProducts() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listMyProducts().then(setProducts).catch(() => setError("Could not load your products."));
  }, []);

  const onDelete = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    setError("");
    try {
      await api.deleteProduct(p.id);
      setProducts((list) => (list ?? []).filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete the product.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl">My products</h2>
        <Link to="/seller/products/new" className="btn-primary">Add product</Link>
      </div>
      {error && <p role="alert" className="text-thread">{error}</p>}
      {!products && !error && <p className="text-muted">Loading...</p>}
      {products && products.length === 0 && (
        <p className="card p-6 text-center text-muted">No products yet.</p>
      )}
      {products && products.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-sand-200 text-muted">
              <tr>
                <th className="p-3 font-medium">Product</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Price</th>
                <th className="p-3 font-medium">Stock by size</th>
                <th className="p-3 font-medium"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 shrink-0 rounded" style={{ backgroundColor: p.swatch }} aria-hidden="true" />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3">{p.category}</td>
                  <td className="p-3">{formatPrice(p.price)}</td>
                  <td className="p-3">
                    {p.sizes.map((s) => (
                      <span
                        key={s.size}
                        className={`mr-1 inline-block rounded px-1.5 py-0.5 text-xs ${
                          s.stock === 0 ? "bg-red-100 text-red-900" : "bg-sand-200"
                        }`}
                      >
                        {s.size}: {s.stock}
                      </span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    <Link to={`/seller/products/${p.id}/edit`} className="mr-3 underline">Edit</Link>
                    <button className="text-thread underline" onClick={() => onDelete(p)}>Delete</button>
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
