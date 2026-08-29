export type EdiStandard = "EDIFACT" | "X12" | "UNKNOWN";
export type EdiDirection = "inbound" | "outbound";
export type EdiParseStatus = "ok" | "error";
export type EdiPartnerKind = "customer" | "supplier";

export type EdiMessageCategory =
  | "order"
  | "orderResponse"
  | "despatch"
  | "invoice"
  | "acknowledgment"
  | "other";

export interface EdiMessage {
  id: string;
  brandId: string;
  direction: EdiDirection;
  standard: EdiStandard;
  messageType: string;
  senderId: string;
  receiverId: string;
  controlNumber: string;
  messageDate: string;
  partnerId: string | null;
  partnerKind: EdiPartnerKind | null;
  partnerName: string | null;
  rawMessage: string;
  parseStatus: EdiParseStatus;
  parseError: string | null;
  uploadedBy: string;
  createdAt: string;
}

/** Trimmed projection of EdiMessage without the raw payload, for list views. */
export type EdiMessageSummary = Omit<EdiMessage, "rawMessage">;

export interface UploadEdiMessageRequest {
  direction: EdiDirection;
  rawMessage: string;
}

export interface EdiMessageTypeInfo {
  standard: Exclude<EdiStandard, "UNKNOWN">;
  code: string;
  label: string;
  category: EdiMessageCategory;
}

/**
 * A representative catalog of common EDIFACT and X12 message/transaction
 * types across the order-to-cash and logistics flow. Not exhaustive — the
 * inventory still accepts and stores any message type code it encounters,
 * this table only drives friendlier labels and flow/category grouping.
 */
export const EDI_MESSAGE_TYPES: EdiMessageTypeInfo[] = [
  // EDIFACT
  { standard: "EDIFACT", code: "ORDERS", label: "Purchase Order", category: "order" },
  { standard: "EDIFACT", code: "ORDCHG", label: "Purchase Order Change Request", category: "order" },
  { standard: "EDIFACT", code: "ORDRSP", label: "Purchase Order Response", category: "orderResponse" },
  { standard: "EDIFACT", code: "DESADV", label: "Despatch Advice", category: "despatch" },
  { standard: "EDIFACT", code: "RECADV", label: "Receiving Advice", category: "despatch" },
  { standard: "EDIFACT", code: "INVOIC", label: "Invoice", category: "invoice" },
  { standard: "EDIFACT", code: "INVRPT", label: "Inventory Report", category: "other" },
  { standard: "EDIFACT", code: "PRICAT", label: "Price/Sales Catalogue", category: "other" },
  { standard: "EDIFACT", code: "CONTRL", label: "Syntax/Service Report", category: "acknowledgment" },
  { standard: "EDIFACT", code: "APERAK", label: "Application Error & Acknowledgement", category: "acknowledgment" },
  { standard: "EDIFACT", code: "IFTMIN", label: "Instruction Message (Transport)", category: "other" },
  { standard: "EDIFACT", code: "IFTSTA", label: "Multimodal Status Report", category: "other" },
  { standard: "EDIFACT", code: "PAYORD", label: "Payment Order", category: "other" },
  { standard: "EDIFACT", code: "REMADV", label: "Remittance Advice", category: "other" },
  { standard: "EDIFACT", code: "SLSRPT", label: "Sales Data Report", category: "other" },
  // X12
  { standard: "X12", code: "850", label: "Purchase Order", category: "order" },
  { standard: "X12", code: "860", label: "Purchase Order Change Request", category: "order" },
  { standard: "X12", code: "855", label: "Purchase Order Acknowledgment", category: "orderResponse" },
  { standard: "X12", code: "856", label: "Ship Notice / Manifest (ASN)", category: "despatch" },
  { standard: "X12", code: "945", label: "Warehouse Shipping Advice", category: "despatch" },
  { standard: "X12", code: "810", label: "Invoice", category: "invoice" },
  { standard: "X12", code: "820", label: "Payment Order / Remittance Advice", category: "other" },
  { standard: "X12", code: "830", label: "Planning Schedule", category: "other" },
  { standard: "X12", code: "846", label: "Inventory Inquiry/Advice", category: "other" },
  { standard: "X12", code: "852", label: "Product Activity Data", category: "other" },
  { standard: "X12", code: "940", label: "Warehouse Shipping Order", category: "other" },
  { standard: "X12", code: "997", label: "Functional Acknowledgment", category: "acknowledgment" },
  { standard: "X12", code: "864", label: "Text Message", category: "other" },
];

export function getEdiMessageTypeInfo(
  standard: EdiStandard,
  code: string,
): EdiMessageTypeInfo | undefined {
  return EDI_MESSAGE_TYPES.find((t) => t.standard === standard && t.code === code.toUpperCase());
}

export function getEdiMessageLabel(standard: EdiStandard, code: string): string {
  return getEdiMessageTypeInfo(standard, code)?.label ?? code;
}

export function getEdiMessageCategory(standard: EdiStandard, code: string): EdiMessageCategory {
  return getEdiMessageTypeInfo(standard, code)?.category ?? "other";
}

export interface EdiTypeCount {
  standard: EdiStandard;
  messageType: string;
  label: string;
  count: number;
}

export interface EdiPartnerCount {
  partnerId: string | null;
  partnerName: string;
  count: number;
}

export interface EdiStats {
  total: number;
  byStatus: Record<EdiParseStatus, number>;
  byDirection: Record<EdiDirection, number>;
  byType: EdiTypeCount[];
  byPartner: EdiPartnerCount[];
}

export type EdiExceptionKind = "parseError" | "orphanInvoice";

export interface EdiException {
  kind: EdiExceptionKind;
  message: EdiMessageSummary;
  detail: string;
}

export interface EdiPartnerFlowEntry {
  message: EdiMessageSummary;
  category: EdiMessageCategory;
  label: string;
}
