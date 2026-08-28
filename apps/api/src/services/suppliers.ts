import type { Supplier } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const suppliersCollection = new JsonCollection<Supplier>("suppliers.db.json");
