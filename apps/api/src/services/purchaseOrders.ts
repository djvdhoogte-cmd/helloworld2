import type { PurchaseOrder } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const purchaseOrdersCollection = new JsonCollection<PurchaseOrder>(
  "purchase-orders.db.json",
);
