import { useEffect, useState } from "react";
import { api } from "../api";
import ProductCard from "../components/ProductCard";
import type { Product } from "../types";

export default function Home() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listProducts().then(setProducts).catch(() => setError("Could not load products."));
  }, []);

  return (
    <div className="space-y-10">
      <section className="rounded-lg bg-sand-100 px-6 py-14 text-center">
        <h1 className="text-4xl sm:text-5xl">Woven with care</h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Handcrafted kurtas, sarees and dupattas from independent weavers.
        </p>
      </section>

      <section aria-labelledby="featured">
        <h2 id="featured" className="mb-4 text-2xl">Featured</h2>
        {error && <p role="alert" className="text-thread">{error}</p>}
        {!products && !error && <p className="text-muted">Loading...</p>}
        {products && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
