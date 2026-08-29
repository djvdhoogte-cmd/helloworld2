import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { EdiMessage } from "@whitelabel/shared";
import { getEdiMessageLabel } from "@whitelabel/shared";
import { ediApi } from "./api.js";

export function EdiMessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [message, setMessage] = useState<EdiMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    ediApi
      .get(id)
      .then(setMessage)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load message"));
  }, [id]);

  if (error) {
    return (
      <div>
        <p className="form-error">{error}</p>
        <Link to="/edi/messages">Back to inventory</Link>
      </div>
    );
  }
  if (!message) return <p>Loading…</p>;

  const segments = message.rawMessage
    .split(/['~]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div>
      <Link to="/edi/messages">← Back to inventory</Link>
      <dl className="detail-grid">
        <dt>Standard</dt>
        <dd>{message.standard}</dd>
        <dt>Message type</dt>
        <dd>
          {message.messageType}
          {message.standard !== "UNKNOWN" && ` — ${getEdiMessageLabel(message.standard, message.messageType)}`}
        </dd>
        <dt>Direction</dt>
        <dd>{message.direction}</dd>
        <dt>Sender</dt>
        <dd>{message.senderId || "—"}</dd>
        <dt>Receiver</dt>
        <dd>{message.receiverId || "—"}</dd>
        <dt>Control number</dt>
        <dd>{message.controlNumber || "—"}</dd>
        <dt>Message date</dt>
        <dd>{new Date(message.messageDate).toLocaleString()}</dd>
        <dt>Matched partner</dt>
        <dd>{message.partnerName ? `${message.partnerName} (${message.partnerKind})` : "Unmatched"}</dd>
        <dt>Status</dt>
        <dd>
          <span className={message.parseStatus === "error" ? "status-badge error" : "status-badge ok"}>
            {message.parseStatus}
          </span>
          {message.parseError && <span className="form-error"> {message.parseError}</span>}
        </dd>
      </dl>

      <h2>Raw message</h2>
      <pre className="edi-raw">
        {segments.map((seg, i) => (
          <div key={i}>{seg}</div>
        ))}
      </pre>
    </div>
  );
}
