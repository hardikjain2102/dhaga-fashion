import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import { CATEGORIES, type Category } from "../../types";

interface SizeRow { size: string; stock: string }

export default function SellerProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(editing);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Category>("Kurta");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [swatch, setSwatch] = useState("#8c3b2a");
  const [rows, setRows] = useState<SizeRow[]>([{ size: "M", stock: "10" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let live = true;
    api
      .getProduct(id)
      .then((p) => {
        if (!live) return;
        if (p.sellerId !== user?.id) {
          setError("You can only edit your own products.");
        } else {
          setName(p.name);
          setCategory(p.category);
          setPrice(String(p.price));
          setDescription(p.description);
          setSwatch(p.swatch);
          setRows(p.sizes.map((s) => ({ size: s.size, stock: String(s.stock) })));
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof ApiError ? e.message : "Could not load the product.");
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id, user?.id]);

  const setRow = (i: number, patch: Partial<SizeRow>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d+$/.test(price)) return setError("Price must be a whole number of rupees.");
    if (rows.length === 0) return setError("Add at least one size.");
    for (const r of rows) {
      if (!r.size.trim()) return setError("Every size needs a label.");
      if (!/^\d+$/.test(r.stock)) return setError(`Stock for size "${r.size}" must be a whole number.`);
    }
    const input = {
      name,
      category,
      price: Number(price),
      description,
      swatch,
      sizes: rows.map((r) => ({ size: r.size, stock: Number(r.stock) })),
    };
    setBusy(true);
    try {
      if (id) await api.updateProduct(id, input);
      else await api.createProduct(input);
      navigate("/seller/products", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the product.");
      setBusy(false);
    }
  };

  if (loading) return <p role="status" className="text-muted">Loading...</p>;
  if (editing && error && !name) {
    return (
      <div className="text-center">
        <p role="alert" className="text-thread">{error}</p>
        <Link to="/seller/products" className="btn-outline mt-4">Back to my products</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/seller/products" className="text-sm text-muted underline">Back to my products</Link>
      <h2 className="text-2xl">{editing ? "Edit product" : "Add product"}</h2>

      <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">Name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="category" className="label">Category</label>
            <select id="category" className="input" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="price" className="label">Price (INR)</label>
            <input id="price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label htmlFor="swatch" className="label">Colour</label>
            <input id="swatch" type="color" className="h-10 w-full cursor-pointer rounded-md border border-sand-300 bg-white p-1"
                   value={swatch} onChange={(e) => setSwatch(e.target.value)} />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="label">Description</label>
          <textarea id="description" rows={3} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <fieldset className="space-y-2">
          <legend className="label">Sizes and stock</legend>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="btn-outline px-2 py-1"
                    onClick={() => setRows(["S", "M", "L", "XL"].map((s) => ({ size: s, stock: "10" })))}>
              Use S, M, L, XL
            </button>
            <button type="button" className="btn-outline px-2 py-1"
                    onClick={() => setRows([{ size: "Free", stock: "10" }])}>
              Free size
            </button>
          </div>
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input aria-label={`Size label ${i + 1}`} className="input w-28" placeholder="Size"
                     value={r.size} onChange={(e) => setRow(i, { size: e.target.value })} />
              <input aria-label={`Stock for size ${r.size || i + 1}`} className="input w-28" placeholder="Stock" inputMode="numeric"
                     value={r.stock} onChange={(e) => setRow(i, { stock: e.target.value })} />
              <button type="button" className="text-sm text-thread underline" disabled={rows.length === 1}
                      onClick={() => setRows((list) => list.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn-outline px-3 py-1 text-sm" disabled={rows.length >= 8}
                  onClick={() => setRows((r) => [...r, { size: "", stock: "0" }])}>
            Add size
          </button>
        </fieldset>

        {error && <p role="alert" className="text-sm text-thread">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Saving..." : editing ? "Save changes" : "Create product"}
        </button>
      </form>
    </div>
  );
}
