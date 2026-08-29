import type {
  EdiException,
  EdiMessage,
  EdiMessageSummary,
  EdiPartnerFlowEntry,
  EdiPartnerKind,
  EdiStats,
  UploadEdiMessageRequest,
} from "@whitelabel/shared";
import { apiFetch } from "../app/api.js";

export const ediApi = {
  list: () => apiFetch<EdiMessageSummary[]>("/api/edi/messages"),
  get: (id: string) => apiFetch<EdiMessage>(`/api/edi/messages/${id}`),
  upload: (body: UploadEdiMessageRequest) =>
    apiFetch<EdiMessage>("/api/edi/messages", { method: "POST", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/edi/messages/${id}`, { method: "DELETE" }),
  stats: () => apiFetch<EdiStats>("/api/edi/stats"),
  exceptions: () => apiFetch<EdiException[]>("/api/edi/exceptions"),
  partnerFlow: (kind: EdiPartnerKind, id: string) =>
    apiFetch<EdiPartnerFlowEntry[]>(`/api/edi/partners/${kind}/${id}/flow`),
};
