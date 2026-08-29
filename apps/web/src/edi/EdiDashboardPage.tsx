import { useEffect, useState } from "react";
import type { EdiStats } from "@whitelabel/shared";
import { ediApi } from "./api.js";

function BarList({ items }: { items: { label: string; count: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="bar-label">{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
          </div>
          <span className="bar-count">{item.count}</span>
        </div>
      ))}
    </div>
  );
}

export function EdiDashboardPage() {
  const [stats, setStats] = useState<EdiStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ediApi
      .stats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load stats"));
  }, []);

  if (error) return <p className="form-error">{error}</p>;
  if (!stats) return <p>Loading…</p>;

  return (
    <div>
      <div className="stat-tiles">
        <div className="stat-tile">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Total messages</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{stats.byDirection.inbound}</span>
          <span className="stat-label">Inbound</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{stats.byDirection.outbound}</span>
          <span className="stat-label">Outbound</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value error">{stats.byStatus.error}</span>
          <span className="stat-label">Parse errors</span>
        </div>
      </div>

      <h2>By message type</h2>
      {stats.byType.length === 0 ? (
        <p className="muted">No messages yet.</p>
      ) : (
        <BarList items={stats.byType.map((t) => ({ label: `${t.label} (${t.standard})`, count: t.count }))} />
      )}

      <h2>By trading partner</h2>
      {stats.byPartner.length === 0 ? (
        <p className="muted">No messages yet.</p>
      ) : (
        <BarList items={stats.byPartner.map((p) => ({ label: p.partnerName, count: p.count }))} />
      )}
    </div>
  );
}
