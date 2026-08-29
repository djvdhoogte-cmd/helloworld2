import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { EdiDirection, EdiMessageSummary } from "@whitelabel/shared";
import { getEdiMessageLabel } from "@whitelabel/shared";
import { ediApi } from "./api.js";

export function EdiMessagesPage() {
  const [messages, setMessages] = useState<EdiMessageSummary[] | null>(null);
  const [direction, setDirection] = useState<EdiDirection>("inbound");
  const [rawMessage, setRawMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function refresh() {
    ediApi
      .list()
      .then(setMessages)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(refresh, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!rawMessage.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await ediApi.upload({ direction, rawMessage });
      setRawMessage("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload message");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await ediApi.remove(id);
    refresh();
  }

  return (
    <div>
      {error && <p className="form-error">{error}</p>}

      <form className="order-form" onSubmit={handleUpload}>
        <label>
          Direction
          <select value={direction} onChange={(e) => setDirection(e.target.value as EdiDirection)}>
            <option value="inbound">Inbound (received from partner)</option>
            <option value="outbound">Outbound (sent to partner)</option>
          </select>
        </label>
        <label>
          Raw EDI message (EDIFACT or X12)
          <textarea
            className="edi-textarea"
            value={rawMessage}
            onChange={(e) => setRawMessage(e.target.value)}
            placeholder="UNA:+.? '&#10;UNB+UNOC:3+SENDERID:14+RECEIVERID:14+250115:0930+CTRL0001'&#10;UNH+1+ORDERS:D:96A:UN:EAN008'&#10;..."
            rows={8}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Uploading…" : "Upload message"}
        </button>
      </form>

      {!messages ? (
        <p>Loading…</p>
      ) : messages.length === 0 ? (
        <p>No EDI messages inventoried yet. Paste one above to get started.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Direction</th>
              <th>Standard</th>
              <th>Type</th>
              <th>Partner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {messages.map((m) => (
              <tr key={m.id}>
                <td>{new Date(m.messageDate).toLocaleString()}</td>
                <td>{m.direction}</td>
                <td>{m.standard}</td>
                <td>{m.standard === "UNKNOWN" ? m.messageType : getEdiMessageLabel(m.standard, m.messageType)}</td>
                <td>{m.partnerName ?? <span className="muted">Unmatched</span>}</td>
                <td>
                  <span className={m.parseStatus === "error" ? "status-badge error" : "status-badge ok"}>
                    {m.parseStatus}
                  </span>
                </td>
                <td>
                  <Link to={`/edi/messages/${m.id}`}>View</Link>
                  <button className="link-button" onClick={() => handleDelete(m.id)}>
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
