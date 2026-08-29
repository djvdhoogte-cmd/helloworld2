import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { EdiException } from "@whitelabel/shared";
import { ediApi } from "./api.js";

const KIND_LABEL: Record<EdiException["kind"], string> = {
  parseError: "Parse error",
  orphanInvoice: "Invoice without matching order",
};

export function EdiExceptionsPage() {
  const [exceptions, setExceptions] = useState<EdiException[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ediApi
      .exceptions()
      .then(setExceptions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load exceptions"));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!exceptions) return <p>Loading…</p>;

  if (exceptions.length === 0) {
    return <p>No exceptions found — every message parsed cleanly and every invoice has a matching order.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Kind</th>
          <th>Message</th>
          <th>Partner</th>
          <th>Detail</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {exceptions.map((exc) => (
          <tr key={exc.message.id}>
            <td>
              <span className="status-badge error">{KIND_LABEL[exc.kind]}</span>
            </td>
            <td>
              {exc.message.standard} {exc.message.messageType}
            </td>
            <td>{exc.message.partnerName ?? <span className="muted">Unmatched</span>}</td>
            <td>{exc.detail}</td>
            <td>
              <Link to={`/edi/messages/${exc.message.id}`}>View</Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
