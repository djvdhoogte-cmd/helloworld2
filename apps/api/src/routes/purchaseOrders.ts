import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type {
  CreatePurchaseOrderRequest,
  OrderLine,
  PurchaseOrder,
  UpdatePurchaseOrderStatusRequest,
} from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { findProductById, productsCollection } from "../services/products.js";
import { purchaseOrdersCollection } from "../services/purchaseOrders.js";
import { suppliersCollection } from "../services/suppliers.js";

export const purchaseOrderRouter = Router();
purchaseOrderRouter.use(requireFeature("purchasing"));
purchaseOrderRouter.use(requireAuth);

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["received", "cancelled"],
  received: [],
  cancelled: [],
};

purchaseOrderRouter.get("/", (req, res) => {
  res.json(purchaseOrdersCollection.filter((po) => po.brandId === req.brand.id));
});

purchaseOrderRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreatePurchaseOrderRequest>;
  const supplierId = body.supplierId;
  if (!supplierId || !suppliersCollection.find((s) => s.id === supplierId && s.brandId === req.brand.id)) {
    res.status(400).json({ error: "A valid supplierId is required" });
    return;
  }
  if (!body.lines || body.lines.length === 0) {
    res.status(400).json({ error: "At least one order line is required" });
    return;
  }

  const lines: OrderLine[] = [];
  for (const line of body.lines) {
    const product = findProductById(req.brand.id, line.productId);
    if (!product) {
      res.status(400).json({ error: `Unknown product '${line.productId}'` });
      return;
    }
    if (!line.quantity || line.quantity <= 0) {
      res.status(400).json({ error: "Each line requires a positive quantity" });
      return;
    }
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice ?? product.unitPrice,
    });
  }

  const now = new Date().toISOString();
  const order: PurchaseOrder = {
    id: nanoid(),
    brandId: req.brand.id,
    supplierId,
    status: "draft",
    lines,
    totalAmount: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    createdAt: now,
    updatedAt: now,
  };
  purchaseOrdersCollection.insert(order);
  res.status(201).json(order);
});

function findOwnedOrder(req: Request<{ id: string }>) {
  return purchaseOrdersCollection.find((po) => po.id === req.params.id && po.brandId === req.brand.id);
}

purchaseOrderRouter.get("/:id", (req, res) => {
  const order = findOwnedOrder(req);
  if (!order) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }
  res.json(order);
});

purchaseOrderRouter.put("/:id/status", (req, res) => {
  const existing = findOwnedOrder(req);
  if (!existing) {
    res.status(404).json({ error: "Purchase order not found" });
    return;
  }
  const { status } = req.body as UpdatePurchaseOrderStatusRequest;
  if (!VALID_TRANSITIONS[existing.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot move purchase order from '${existing.status}' to '${status}'` });
    return;
  }

  if (status === "received") {
    for (const line of existing.lines) {
      productsCollection.update(
        (p) => p.id === line.productId,
        (p) => ({ ...p, stockQty: p.stockQty + line.quantity, updatedAt: new Date().toISOString() }),
      );
    }
  }

  const updated = purchaseOrdersCollection.update(
    (po) => po.id === existing.id,
    (po) => ({ ...po, status, updatedAt: new Date().toISOString() }),
  );
  res.json(updated);
});
