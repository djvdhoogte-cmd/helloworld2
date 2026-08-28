import type { Customer } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const customersCollection = new JsonCollection<Customer>("customers.db.json");
