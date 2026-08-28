import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type {
  CreateSalesOrderRequest,
  OrderLine,
  SalesOrder,
  UpdateSalesOrderStatusRequest,
} from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { customersCollection } from "../services/customers.js";
import { findProductById, productsCollection } from "../services/products.js";
import { salesOrdersCollection } from "../services/salesOrders.js";

export const salesOrderRouter = Router();
salesOrderRouter.use(requireFeature("orders"));
salesOrderRouter.use(requireAuth);

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["fulfilled", "cancelled"],
  fulfilled: [],
  cancelled: [],
};

salesOrderRouter.get("/", (req, res) => {
  res.json(salesOrdersCollection.filter((so) => so.brandId === req.brand.id));
});

salesOrderRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateSalesOrderRequest>;
  const customerId = body.customerId;
  if (!customerId || !customersCollection.find((c) => c.id === customerId && c.brandId === req.brand.id)) {
    res.status(400).json({ error: "A valid customerId is required" });
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
  const order: SalesOrder = {
    id: nanoid(),
    brandId: req.brand.id,
    customerId,
    ownerId: req.auth!.sub,
    status: "draft",
    lines,
    totalAmount: lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    createdAt: now,
    updatedAt: now,
  };
  salesOrdersCollection.insert(order);
  res.status(201).json(order);
});

function findOwnedOrder(req: Request<{ id: string }>) {
  return salesOrdersCollection.find((so) => so.id === req.params.id && so.brandId === req.brand.id);
}

salesOrderRouter.get("/:id", (req, res) => {
  const order = findOwnedOrder(req);
  if (!order) {
    res.status(404).json({ error: "Sales order not found" });
    return;
  }
  res.json(order);
});

salesOrderRouter.put("/:id/status", (req, res) => {
  const existing = findOwnedOrder(req);
  if (!existing) {
    res.status(404).json({ error: "Sales order not found" });
    return;
  }
  const { status } = req.body as UpdateSalesOrderStatusRequest;
  if (!VALID_TRANSITIONS[existing.status]?.includes(status)) {
    res.status(400).json({ error: `Cannot move sales order from '${existing.status}' to '${status}'` });
    return;
  }

  if (status === "fulfilled") {
    for (const line of existing.lines) {
      const product = findProductById(req.brand.id, line.productId);
      if (!product || product.stockQty < line.quantity) {
        res.status(409).json({
          error: `Insufficient stock for '${line.productName}' (have ${product?.stockQty ?? 0}, need ${line.quantity})`,
        });
        return;
      }
    }
    for (const line of existing.lines) {
      productsCollection.update(
        (p) => p.id === line.productId,
        (p) => ({ ...p, stockQty: p.stockQty - line.quantity, updatedAt: new Date().toISOString() }),
      );
    }
  }

  const updated = salesOrdersCollection.update(
    (so) => so.id === existing.id,
    (so) => ({ ...so, status, updatedAt: new Date().toISOString() }),
  );
  res.json(updated);
});
