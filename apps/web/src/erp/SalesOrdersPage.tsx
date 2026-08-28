import { useEffect, useState, type FormEvent } from "react";
import type { Customer, OrderLineInput, Product, SalesOrder, SalesOrderStatus } from "@whitelabel/shared";
import { customerApi, productApi, salesOrderApi } from "./api.js";
import { OrderLineEditor } from "./OrderLineEditor.js";

const NEXT_STATUS: Partial<Record<SalesOrderStatus, SalesOrderStatus>> = {
  draft: "submitted",
  submitted: "fulfilled",
};

export function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<OrderLineInput[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refreshOrders() {
    salesOrderApi
      .list()
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load orders"));
  }

  useEffect(() => {
    refreshOrders();
    customerApi.list().then((list) => {
      setCustomers(list);
      setCustomerId((current) => current || list[0]?.id || "");
    });
    productApi.list().then(setProducts);
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!customerId || lines.length === 0) {
      setError("Select a customer and at least one line item");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await salesOrderApi.create({ customerId, lines });
      setLines([]);
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  async function advance(order: SalesOrder) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await salesOrderApi.setStatus(order.id, { status: next });
      refreshOrders();
      productApi.list().then(setProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update order");
    }
  }

  async function cancel(order: SalesOrder) {
    try {
      await salesOrderApi.setStatus(order.id, { status: "cancelled" });
      refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel order");
    }
  }

  function customerName(id: string) {
    return customers.find((c) => c.id === id)?.name ?? id;
  }

  return (
    <div className="page">
      <h1>Sales Orders</h1>
      {error && <p className="form-error">{error}</p>}

      <form className="order-form" onSubmit={handleCreate}>
        <label>
          Customer
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <OrderLineEditor products={products} lines={lines} onChange={setLines} />
        <button type="submit" disabled={submitting || customers.length === 0}>
          Create order
        </button>
        {customers.length === 0 && <p className="muted">Add a customer first.</p>}
      </form>

      {!orders ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Total</th>
              <th>Updated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{customerName(o.customerId)}</td>
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
