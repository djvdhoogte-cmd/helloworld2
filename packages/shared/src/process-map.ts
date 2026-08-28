export interface ProcessMapSummary {
  id: string;
  brandId: string;
  ownerId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessMap extends ProcessMapSummary {
  bpmnXml: string;
}

export interface CreateProcessMapRequest {
  name: string;
  bpmnXml: string;
}

export interface UpdateProcessMapRequest {
  name?: string;
  bpmnXml?: string;
}
