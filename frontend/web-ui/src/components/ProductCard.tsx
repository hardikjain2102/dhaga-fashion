import type { Product } from "../types";
import { formatPrice } from "../lib/format";

export default function ProductCard({ product }: { product: Product }) {
  const total = product.sizes.reduce((sum, s) => sum + s.stock, 0);
  return (
    <article className="card overflow-hidden transition hover:shadow-md">
      <div
        className="flex h-52 items-end p-3"
        style={{ backgroundColor: product.swatch }}
        role="img"
        aria-label={`${product.name} colour swatch`}
      >
        <span className="rounded bg-paper/90 px-2 py-0.5 text-xs">{product.category}</span>
      </div>
      <div className="space-y-1 p-4">
        <h3 className="text-lg leading-snug">{product.name}</h3>
        <p className="text-xs text-muted">by {product.sellerName}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="font-medium">{formatPrice(product.price)}</span>
          {total === 0 ? (
            <span className="text-xs font-medium text-thread">Out of stock</span>
          ) : (
            <span className="text-xs text-muted">{total} in stock</span>
          )}
        </div>
      </div>
    </article>
  );
}
