import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type {
  CreateProcessMapRequest,
  ProcessMap,
  UpdateProcessMapRequest,
} from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { processMapsCollection } from "../services/processMaps.js";

export const processMapRouter = Router();
processMapRouter.use(requireFeature("processMapping"));
processMapRouter.use(requireAuth);

const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="Start" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1">
        <dc:Bounds x="180" y="180" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

processMapRouter.get("/", (req, res) => {
  const maps = processMapsCollection
    .filter((m) => m.brandId === req.brand.id && m.ownerId === req.auth!.sub)
    .map(({ bpmnXml: _bpmnXml, ...summary }) => summary);
  res.json(maps);
});

processMapRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateProcessMapRequest>;
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const now = new Date().toISOString();
  const map: ProcessMap = {
    id: nanoid(),
    brandId: req.brand.id,
    ownerId: req.auth!.sub,
    name,
    bpmnXml: body.bpmnXml?.trim() || DEFAULT_BPMN_XML,
    createdAt: now,
    updatedAt: now,
  };
  processMapsCollection.insert(map);
  res.status(201).json(map);
});

function findOwnedMap(req: Request<{ id: string }>) {
  return processMapsCollection.find(
    (m) => m.id === req.params.id && m.brandId === req.brand.id && m.ownerId === req.auth!.sub,
  );
}

processMapRouter.get("/:id", (req, res) => {
  const map = findOwnedMap(req);
  if (!map) {
    res.status(404).json({ error: "Process map not found" });
    return;
  }
  res.json(map);
});

processMapRouter.put("/:id", (req, res) => {
  const existing = findOwnedMap(req);
  if (!existing) {
    res.status(404).json({ error: "Process map not found" });
    return;
  }
  const body = req.body as UpdateProcessMapRequest;
  const updated = processMapsCollection.update(
    (m) => m.id === existing.id,
    (m) => ({
      ...m,
      name: body.name?.trim() || m.name,
      bpmnXml: body.bpmnXml ?? m.bpmnXml,
      updatedAt: new Date().toISOString(),
    }),
  );
  res.json(updated);
});

processMapRouter.delete("/:id", (req, res) => {
  const existing = findOwnedMap(req);
  if (!existing) {
    res.status(404).json({ error: "Process map not found" });
    return;
  }
  processMapsCollection.remove((m) => m.id === existing.id);
  res.status(204).send();
});
