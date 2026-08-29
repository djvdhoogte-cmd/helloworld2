import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import {
  getEdiMessageCategory,
  getEdiMessageLabel,
  type EdiException,
  type EdiMessage,
  type EdiPartnerCount,
  type EdiPartnerFlowEntry,
  type EdiPartnerKind,
  type EdiStats,
  type EdiTypeCount,
  type UploadEdiMessageRequest,
} from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { ediMessagesCollection, stripRawMessage } from "../services/ediMessages.js";
import { matchEdiPartner } from "../services/ediPartnerMatch.js";
import { parseEdiEnvelope } from "../services/ediParser.js";

export const ediRouter = Router();
ediRouter.use(requireFeature("ediInventory"));
ediRouter.use(requireAuth);

ediRouter.get("/messages", (req, res) => {
  let messages = ediMessagesCollection.filter((m) => m.brandId === req.brand.id);

  const { direction, standard, messageType, partnerId, status } = req.query;
  if (typeof direction === "string") messages = messages.filter((m) => m.direction === direction);
  if (typeof standard === "string") messages = messages.filter((m) => m.standard === standard);
  if (typeof messageType === "string") messages = messages.filter((m) => m.messageType === messageType);
  if (typeof partnerId === "string") messages = messages.filter((m) => m.partnerId === partnerId);
  if (typeof status === "string") messages = messages.filter((m) => m.parseStatus === status);

  messages.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json(messages.map(stripRawMessage));
});

ediRouter.post("/messages", (req, res) => {
  const body = req.body as Partial<UploadEdiMessageRequest>;
  const rawMessage = body.rawMessage?.trim();
  const direction = body.direction;

  if (!rawMessage) {
    res.status(400).json({ error: "rawMessage is required" });
    return;
  }
  if (direction !== "inbound" && direction !== "outbound") {
    res.status(400).json({ error: "direction must be 'inbound' or 'outbound'" });
    return;
  }

  const now = new Date().toISOString();
  let message: EdiMessage;

  try {
    const envelope = parseEdiEnvelope(rawMessage);
    const partnerCode = direction === "inbound" ? envelope.senderId : envelope.receiverId;
    const partner = matchEdiPartner(req.brand.id, partnerCode);

    message = {
      id: nanoid(),
      brandId: req.brand.id,
      direction,
      standard: envelope.standard,
      messageType: envelope.messageType,
      senderId: envelope.senderId,
      receiverId: envelope.receiverId,
      controlNumber: envelope.controlNumber,
      messageDate: envelope.messageDate ?? now,
      partnerId: partner?.partnerId ?? null,
      partnerKind: partner?.partnerKind ?? null,
      partnerName: partner?.partnerName ?? null,
      rawMessage,
      parseStatus: "ok",
      parseError: null,
      uploadedBy: req.auth!.sub,
      createdAt: now,
    };
  } catch (err) {
    message = {
      id: nanoid(),
      brandId: req.brand.id,
      direction,
      standard: "UNKNOWN",
      messageType: "UNKNOWN",
      senderId: "",
      receiverId: "",
      controlNumber: "",
      messageDate: now,
      partnerId: null,
      partnerKind: null,
      partnerName: null,
      rawMessage,
      parseStatus: "error",
      parseError: err instanceof Error ? err.message : "Failed to parse EDI message",
      uploadedBy: req.auth!.sub,
      createdAt: now,
    };
  }

  ediMessagesCollection.insert(message);
  res.status(201).json(message);
});

function findOwnedMessage(req: Request<{ id: string }>) {
  return ediMessagesCollection.find((m) => m.id === req.params.id && m.brandId === req.brand.id);
}

ediRouter.get("/messages/:id", (req, res) => {
  const message = findOwnedMessage(req);
  if (!message) {
    res.status(404).json({ error: "EDI message not found" });
    return;
  }
  res.json(message);
});

ediRouter.delete("/messages/:id", (req, res) => {
  const existing = findOwnedMessage(req);
  if (!existing) {
    res.status(404).json({ error: "EDI message not found" });
    return;
  }
  ediMessagesCollection.remove((m) => m.id === existing.id);
  res.status(204).send();
});

ediRouter.get("/stats", (req, res) => {
  const messages = ediMessagesCollection.filter((m) => m.brandId === req.brand.id);

  const byStatus = { ok: 0, error: 0 };
  const byDirection = { inbound: 0, outbound: 0 };
  const typeCounts = new Map<string, EdiTypeCount>();
  const partnerCounts = new Map<string, EdiPartnerCount>();

  for (const m of messages) {
    byStatus[m.parseStatus]++;
    byDirection[m.direction]++;

    const typeKey = `${m.standard}:${m.messageType}`;
    const existingType = typeCounts.get(typeKey);
    if (existingType) {
      existingType.count++;
    } else {
      typeCounts.set(typeKey, {
        standard: m.standard,
        messageType: m.messageType,
        label: m.standard === "UNKNOWN" ? m.messageType : getEdiMessageLabel(m.standard, m.messageType),
        count: 1,
      });
    }

    const partnerKey = m.partnerId ?? "unmatched";
    const existingPartner = partnerCounts.get(partnerKey);
    if (existingPartner) {
      existingPartner.count++;
    } else {
      partnerCounts.set(partnerKey, {
        partnerId: m.partnerId,
        partnerName: m.partnerName ?? "Unmatched",
        count: 1,
      });
    }
  }

  const stats: EdiStats = {
    total: messages.length,
    byStatus,
    byDirection,
    byType: [...typeCounts.values()].sort((a, b) => b.count - a.count),
    byPartner: [...partnerCounts.values()].sort((a, b) => b.count - a.count),
  };
  res.json(stats);
});

ediRouter.get("/exceptions", (req, res) => {
  const messages = ediMessagesCollection.filter((m) => m.brandId === req.brand.id);
  const exceptions: EdiException[] = [];

  const partnersWithOrders = new Set(
    messages
      .filter((m) => m.standard !== "UNKNOWN" && getEdiMessageCategory(m.standard, m.messageType) === "order")
      .map((m) => m.partnerId)
      .filter((id): id is string => id !== null),
  );

  for (const m of messages) {
    if (m.parseStatus === "error") {
      exceptions.push({
        kind: "parseError",
        message: stripRawMessage(m),
        detail: m.parseError ?? "Failed to parse message",
      });
      continue;
    }

    if (
      m.partnerId &&
      getEdiMessageCategory(m.standard, m.messageType) === "invoice" &&
      !partnersWithOrders.has(m.partnerId)
    ) {
      exceptions.push({
        kind: "orphanInvoice",
        message: stripRawMessage(m),
        detail: `No purchase order on file for partner '${m.partnerName}' — invoice may be unexpected`,
      });
    }
  }

  exceptions.sort((a, b) => b.message.createdAt.localeCompare(a.message.createdAt));
  res.json(exceptions);
});

ediRouter.get("/partners/:kind/:id/flow", (req, res) => {
  const kind = req.params.kind as EdiPartnerKind;
  if (kind !== "customer" && kind !== "supplier") {
    res.status(400).json({ error: "kind must be 'customer' or 'supplier'" });
    return;
  }

  const messages = ediMessagesCollection
    .filter(
      (m) => m.brandId === req.brand.id && m.partnerId === req.params.id && m.partnerKind === kind,
    )
    .sort((a, b) => a.messageDate.localeCompare(b.messageDate));

  const flow: EdiPartnerFlowEntry[] = messages.map((m) => ({
    message: stripRawMessage(m),
    category: m.standard === "UNKNOWN" ? "other" : getEdiMessageCategory(m.standard, m.messageType),
    label: m.standard === "UNKNOWN" ? m.messageType : getEdiMessageLabel(m.standard, m.messageType),
  }));

  res.json(flow);
});
