import type { ProcessMap } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const processMapsCollection = new JsonCollection<ProcessMap>("process-maps.db.json");
