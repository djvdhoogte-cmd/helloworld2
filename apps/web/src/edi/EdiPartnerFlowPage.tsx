import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Customer, EdiPartnerFlowEntry, EdiPartnerKind, Supplier } from "@whitelabel/shared";
import { customerApi, supplierApi } from "../erp/api.js";
import { ediApi } from "./api.js";

interface PartnerOption {
  id: string;
  kind: EdiPartnerKind;
  name: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  order: "Order",
  orderResponse: "Order Response",
  despatch: "Despatch",
  invoice: "Invoice",
  acknowledgment: "Acknowledgment",
  other: "Other",
};

export function EdiPartnerFlowPage() {
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [flow, setFlow] = useState<EdiPartnerFlowEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([customerApi.list().catch(() => [] as Customer[]), supplierApi.list().catch(() => [] as Supplier[])]).then(
      ([customers, suppliers]) => {
        const options: PartnerOption[] = [
          ...customers.map((c) => ({ id: c.id, kind: "customer" as const, name: `${c.name} (customer)` })),
          ...suppliers.map((s) => ({ id: s.id, kind: "supplier" as const, name: `${s.name} (supplier)` })),
        ];
        setPartners(options);
        setSelected((current) => current || `${options[0]?.kind}:${options[0]?.id}` || "");
      },
    );
  }, []);

  useEffect(() => {
    if (!selected) return;
    const [kind, id] = selected.split(":") as [EdiPartnerKind, string];
    ediApi
      .partnerFlow(kind, id)
      .then(setFlow)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load flow"));
  }, [selected]);

  return (
    <div>
      {error && <p className="form-error">{error}</p>}
      <label className="partner-flow-select">
        Trading partner
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {partners.map((p) => (
            <option key={`${p.kind}:${p.id}`} value={`${p.kind}:${p.id}`}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      {partners.length === 0 ? (
        <p className="muted">Add a customer or supplier with EDI IDs first.</p>
      ) : !flow ? (
        <p>Loading…</p>
      ) : flow.length === 0 ? (
        <p className="muted">No EDI messages matched to this partner yet.</p>
      ) : (
        <ol className="flow-timeline">
          {flow.map((entry) => (
            <li key={entry.message.id} className={`flow-entry category-${entry.category}`}>
              <span className="flow-category">{CATEGORY_LABEL[entry.category]}</span>
              <span className="flow-label">{entry.label}</span>
              <span className="flow-direction">{entry.message.direction}</span>
              <span className="flow-date">{new Date(entry.message.messageDate).toLocaleString()}</span>
              <Link to={`/edi/messages/${entry.message.id}`}>View</Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
