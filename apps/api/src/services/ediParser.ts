import type { EdiStandard } from "@whitelabel/shared";

export interface ParsedEnvelope {
  standard: Exclude<EdiStandard, "UNKNOWN">;
  messageType: string;
  senderId: string;
  receiverId: string;
  controlNumber: string;
  messageDate: string | null;
}

export function detectEdiStandard(raw: string): EdiStandard {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("UNA") || trimmed.startsWith("UNB")) return "EDIFACT";
  if (trimmed.startsWith("ISA")) return "X12";
  return "UNKNOWN";
}

function escapeRegex(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toIsoDate(dateDigits: string, timeDigits: string): string | null {
  const d = dateDigits.trim();
  const t = timeDigits.trim().padEnd(4, "0");
  let year: string;
  let month: string;
  let day: string;
  if (d.length === 6) {
    year = `20${d.slice(0, 2)}`;
    month = d.slice(2, 4);
    day = d.slice(4, 6);
  } else if (d.length === 8) {
    year = d.slice(0, 4);
    month = d.slice(4, 6);
    day = d.slice(6, 8);
  } else {
    return null;
  }
  const hour = t.slice(0, 2) || "00";
  const minute = t.slice(2, 4) || "00";
  const iso = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function parseEdifact(raw: string): ParsedEnvelope {
  let body = raw.trim();
  let componentSep = ":";
  let elementSep = "+";
  let releaseChar = "?";
  let terminator = "'";

  if (body.startsWith("UNA")) {
    const control = body.slice(3, 9);
    if (control.length === 6) {
      [componentSep, elementSep, , releaseChar] = control;
      terminator = control[5];
    }
    body = body.slice(9);
  }

  const splitPattern = new RegExp(`(?<!${escapeRegex(releaseChar)})${escapeRegex(terminator)}`);
  const segments = body
    .split(splitPattern)
    .map((s) => s.replace(/[\r\n]+/g, "").trim())
    .filter(Boolean);

  const elementSepEscaped = escapeRegex(elementSep);
  const componentSepEscaped = escapeRegex(componentSep);

  const unb = segments.find((s) => s.startsWith("UNB"));
  const unh = segments.find((s) => s.startsWith("UNH"));

  if (!unb) throw new Error("Missing UNB interchange header segment");
  if (!unh) throw new Error("Missing UNH message header segment");

  const unbElements = unb.split(new RegExp(elementSepEscaped));
  const unhElements = unh.split(new RegExp(elementSepEscaped));

  const senderId = (unbElements[2] ?? "").split(new RegExp(componentSepEscaped))[0] ?? "";
  const receiverId = (unbElements[3] ?? "").split(new RegExp(componentSepEscaped))[0] ?? "";
  const dateTimeParts = (unbElements[4] ?? "").split(new RegExp(componentSepEscaped));
  const controlNumber = unbElements[5] ?? "";
  const messageType = (unhElements[2] ?? "").split(new RegExp(componentSepEscaped))[0] ?? "";

  if (!messageType) throw new Error("Could not determine message type from UNH segment");

  return {
    standard: "EDIFACT",
    messageType: messageType.toUpperCase(),
    senderId,
    receiverId,
    controlNumber,
    messageDate: toIsoDate(dateTimeParts[0] ?? "", dateTimeParts[1] ?? ""),
  };
}

function parseX12(raw: string): ParsedEnvelope {
  const normalized = raw.replace(/\r\n?/g, "\n").trim();
  if (normalized.length < 4) throw new Error("Message is too short to contain an ISA segment");

  const elementSep = normalized[3];
  const rawSegments = normalized.includes("~") ? normalized.split("~") : normalized.split("\n");
  const segments = rawSegments.map((s) => s.replace(/\n/g, "").trim()).filter(Boolean);

  const isa = segments.find((s) => s.startsWith("ISA"));
  const st = segments.find((s) => s.startsWith("ST" + elementSep));

  if (!isa) throw new Error("Missing ISA interchange header segment");
  if (!st) throw new Error("Missing ST transaction set header segment");

  const isaElements = isa.split(elementSep).map((e) => e.trim());
  const stElements = st.split(elementSep).map((e) => e.trim());

  const senderId = isaElements[6] ?? "";
  const receiverId = isaElements[8] ?? "";
  const messageType = stElements[1] ?? "";
  const controlNumber = stElements[2] || isaElements[13] || "";

  if (!messageType) throw new Error("Could not determine transaction set code from ST segment");

  return {
    standard: "X12",
    messageType: messageType.toUpperCase(),
    senderId,
    receiverId,
    controlNumber,
    messageDate: toIsoDate(isaElements[9] ?? "", isaElements[10] ?? ""),
  };
}

/**
 * Parses just enough of an EDI interchange to inventory it: standard,
 * message type, trading partner identifiers, control number and message
 * date. Does not validate or decode individual data segments/elements.
 */
export function parseEdiEnvelope(raw: string): ParsedEnvelope {
  const standard = detectEdiStandard(raw);
  if (standard === "EDIFACT") return parseEdifact(raw);
  if (standard === "X12") return parseX12(raw);
  throw new Error("Unrecognized EDI format — expected an EDIFACT (UNB/UNA) or X12 (ISA) interchange");
}
