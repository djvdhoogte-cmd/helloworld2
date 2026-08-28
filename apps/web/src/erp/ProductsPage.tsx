import { useEffect, useState, type FormEvent } from "react";
import type { Product } from "@whitelabel/shared";
import { productApi } from "./api.js";

export function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    productApi
      .list()
      .then(setProducts)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await productApi.create({
        sku,
        name,
        unitPrice: Number(unitPrice),
        stockQty: Number(stockQty),
      });
      setSku("");
      setName("");
      setUnitPrice("");
      setStockQty("0");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await productApi.remove(id);
    refresh();
  }

  return (
    <div className="page">
      <h1>Catalog</h1>
      {error && <p className="form-error">{error}</p>}

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          placeholder="Unit price"
          type="number"
          min="0"
          step="0.01"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />
        <input
          placeholder="Stock"
          type="number"
          min="0"
          value={stockQty}
          onChange={(e) => setStockQty(e.target.value)}
        />
        <button type="submit" disabled={submitting}>
          Add product
        </button>
      </form>

      {!products ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Unit price</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.unitPrice.toFixed(2)}</td>
                <td>{p.stockQty}</td>
                <td>
                  <button className="link-button" onClick={() => handleDelete(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
