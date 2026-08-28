import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ProcessMapSummary } from "@whitelabel/shared";
import { processMapApi } from "./api.js";

export function ProcessMapListPage() {
  const navigate = useNavigate();
  const [maps, setMaps] = useState<ProcessMapSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function refresh() {
    processMapApi
      .list()
      .then(setMaps)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }

  useEffect(refresh, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const map = await processMapApi.create({ name: "Untitled process", bpmnXml: "" });
      navigate(`/process-maps/${map.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create process map");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await processMapApi.remove(id);
    refresh();
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>BPMN 2.0 Process Maps</h1>
        <button onClick={handleCreate} disabled={creating}>
          {creating ? "Creating…" : "New process map"}
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!maps ? (
        <p>Loading…</p>
      ) : maps.length === 0 ? (
        <p>No process maps yet. Create your first one to start mapping wholesale operations.</p>
      ) : (
        <ul className="process-map-list">
          {maps.map((map) => (
            <li key={map.id}>
              <Link to={`/process-maps/${map.id}`}>{map.name}</Link>
              <span className="muted"> updated {new Date(map.updatedAt).toLocaleString()}</span>
              <button className="link-button" onClick={() => handleDelete(map.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
