import type { SalesOrder } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const salesOrdersCollection = new JsonCollection<SalesOrder>("sales-orders.db.json");
