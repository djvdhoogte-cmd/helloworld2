import { useEffect, useState, type FormEvent } from "react";
import type { OrderLineInput, Product, PurchaseOrder, PurchaseOrderStatus, Supplier } from "@whitelabel/shared";
import { productApi, purchaseOrderApi, supplierApi } from "./api.js";
import { OrderLineEditor } from "./OrderLineEditor.js";

const NEXT_STATUS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus>> = {
  draft: "submitted",
  submitted: "received",
};

export function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<OrderLineInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refreshOrders() {
    purchaseOrderApi
      .list()
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load orders"));
  }

  useEffect(() => {
    refreshOrders();
    supplierApi.list().then((list) => {
      setSuppliers(list);
      setSupplierId((current) => current || list[0]?.id || "");
    });
    productApi.list().then(setProducts);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!supplierId || lines.length === 0) {
      setError("Select a supplier and at least one line item");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await purchaseOrderApi.create({ supplierId, lines });
      setLines([]);
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  async function advance(order: PurchaseOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await purchaseOrderApi.setStatus(order.id, { status: next });
      refreshOrders();
      productApi.list().then(setProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  async function cancel(order: PurchaseOrder) {
    try {
      await purchaseOrderApi.setStatus(order.id, { status: "cancelled" });
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  function supplierName(id: string) {
    return suppliers.find((s) => s.id === id)?.name ?? id;
  }

  return (
    <div className="page">
      <h1>Purchase Orders</h1>
      {error && <p className="form-error">{error}</p>}

      <form className="order-form" onSubmit={handleCreate}>
        <label>
          Supplier
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <OrderLineEditor products={products} lines={lines} onChange={setLines} />
        <button type="submit" disabled={submitting || suppliers.length === 0}>
          Create order
        </button>
        {suppliers.length === 0 && <p className="muted">Add a supplier first.</p>}
      </form>

      {!orders ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              <th>Status</th>
              <th>Total</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{supplierName(o.supplierId)}</td>
                <td>{o.status}</td>
                <td>{o.totalAmount.toFixed(2)}</td>
                <td>{new Date(o.updatedAt).toLocaleString()}</td>
                <td>
                  {NEXT_STATUS[o.status] && (
                    <button className="link-button" onClick={() => advance(o)}>
                      Mark {NEXT_STATUS[o.status]}
                    </button>
                  )}
                  {(o.status === "draft" || o.status === "submitted") && (
                    <button className="link-button" onClick={() => cancel(o)}>
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
