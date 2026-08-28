import { useEffect, useState, type FormEvent } from "react";
import type { Customer } from "@whitelabel/shared";
import { customerApi } from "./api.js";

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pricingTier, setPricingTier] = useState("standard");
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    customerApi
      .list()
      .then(setCustomers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await customerApi.create({ name, contactEmail: email, contactPhone: phone, pricingTier });
      setName("");
      setEmail("");
      setPhone("");
      setPricingTier("standard");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await customerApi.remove(id);
    refresh();
  }

  return (
    <div className="page">
      <h1>Customers</h1>
      {error && <p className="form-error">{error}</p>}

      <form className="inline-form" onSubmit={handleCreate}>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <select value={pricingTier} onChange={(e) => setPricingTier(e.target.value)}>
          <option value="standard">Standard</option>
          <option value="preferred">Preferred</option>
          <option value="volume">Volume</option>
        </select>
        <button type="submit" disabled={submitting}>
          Add customer
        </button>
      </form>

      {!customers ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Tier</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.contactEmail}</td>
                <td>{c.contactPhone}</td>
                <td>{c.pricingTier}</td>
                <td>
                  <button className="link-button" onClick={() => handleDelete(c.id)}>
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
