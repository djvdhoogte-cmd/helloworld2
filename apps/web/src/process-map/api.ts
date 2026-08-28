import type {
  CreateProcessMapRequest,
  ProcessMap,
  ProcessMapSummary,
  UpdateProcessMapRequest,
} from "@whitelabel/shared";
import { apiFetch } from "../app/api.js";

const BASE = "/api/process-maps";

export const processMapApi = {
  list: () => apiFetch<ProcessMapSummary[]>(BASE),
  get: (id: string) => apiFetch<ProcessMap>(`${BASE}/${id}`),
  create: (body: CreateProcessMapRequest) =>
    apiFetch<ProcessMap>(BASE, { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateProcessMapRequest) =>
    apiFetch<ProcessMap>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" }),
};
