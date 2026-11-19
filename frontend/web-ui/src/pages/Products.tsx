import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import { CATEGORIES, type Category, type Product } from "../types";

export default function Products() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const rawCategory = params.get("category") ?? "";
  const category: Category | "" = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "";

  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true; // ignore stale responses when the filter changes quickly
    setProducts(null);
    setError("");
    api
      .listProducts({ q, category })
      .then((list) => live && setProducts(list))
      .catch(() => live && setError("Could not load products."));
    return () => {
      live = false;
    };
  }, [q, category]);

  const update = (next: { q?: string; category?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl">Shop</h1>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search products</label>
          <input
            id="search"
            type="search"
            className="input"
            placeholder="Search kurtas, sarees, dupattas..."
            value={q}
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="category" className="sr-only">Category</label>
          <select
            id="category"
            className="input sm:w-48"
            value={category}
            onChange={(e) => update({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p role="alert" className="text-thread">{error}</p>}
      {!products && !error && <p role="status" className="text-muted">Loading...</p>}
      {products && products.length === 0 && (
        <p className="card p-6 text-center text-muted">No products match your search.</p>
      )}
      {products && products.length > 0 && (
        <>
          <p className="text-sm text-muted" aria-live="polite">{products.length} product(s)</p>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
