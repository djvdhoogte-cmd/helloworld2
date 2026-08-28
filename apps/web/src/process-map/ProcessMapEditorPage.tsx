import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";
import type { ProcessMap } from "@whitelabel/shared";
import { processMapApi } from "./api.js";

export function ProcessMapEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  // bpmn-js ships no type declarations, so the modeler instance is untyped here.
  const modelerRef = useRef<InstanceType<typeof BpmnModeler> | null>(null);
  const [map, setMap] = useState<ProcessMap | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !id) return;

    let cancelled = false;
    const modeler = new BpmnModeler({ container: containerRef.current });
    modelerRef.current = modeler;

    processMapApi
      .get(id)
      .then(async (loaded) => {
        if (cancelled) return;
        setMap(loaded);
        await modeler.importXML(loaded.bpmnXml);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load diagram");
      });

    return () => {
      cancelled = true;
      modeler.destroy();
    };
  }, [id]);

  async function handleSave() {
    if (!modelerRef.current || !map) return;
    setStatus("saving");
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const updated = await processMapApi.update(map.id, { bpmnXml: xml });
      setMap(updated);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  if (error) {
    return (
      <div className="page">
        <p className="form-error">{error}</p>
        <Link to="/process-maps">Back to list</Link>
      </div>
    );
  }

  return (
    <div className="page process-map-editor">
      <div className="page-header">
        <button className="link-button" onClick={() => navigate("/process-maps")}>
          ← Back
        </button>
        <h1>{map?.name ?? "Loading…"}</h1>
        <button onClick={handleSave} disabled={!map || status === "saving"}>
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save"}
        </button>
      </div>
      <div ref={containerRef} className="bpmn-canvas" />
    </div>
  );
}
