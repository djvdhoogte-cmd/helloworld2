import type { Product } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export const productsCollection = new JsonCollection<Product>("products.db.json");

export function findProductById(brandId: string, id: string): Product | undefined {
  return productsCollection.find((p) => p.brandId === brandId && p.id === id);
}
