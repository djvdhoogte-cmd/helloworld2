import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type { CreateProductRequest, Product, UpdateProductRequest } from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { productsCollection } from "../services/products.js";

export const productRouter = Router();
productRouter.use(requireFeature("catalog"));
productRouter.use(requireAuth);

productRouter.get("/", (req, res) => {
  res.json(productsCollection.filter((p) => p.brandId === req.brand.id));
});

productRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateProductRequest>;
  const sku = body.sku?.trim();
  const name = body.name?.trim();
  if (!sku || !name || typeof body.unitPrice !== "number") {
    res.status(400).json({ error: "sku, name and unitPrice are required" });
    return;
  }
  if (productsCollection.find((p) => p.brandId === req.brand.id && p.sku === sku)) {
    res.status(409).json({ error: `A product with SKU '${sku}' already exists` });
    return;
  }

  const now = new Date().toISOString();
  const product: Product = {
    id: nanoid(),
    brandId: req.brand.id,
    sku,
    name,
    description: body.description?.trim() ?? "",
    unitPrice: body.unitPrice,
    stockQty: body.stockQty ?? 0,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  productsCollection.insert(product);
  res.status(201).json(product);
});

function findOwnedProduct(req: Request<{ id: string }>) {
  return productsCollection.find((p) => p.id === req.params.id && p.brandId === req.brand.id);
}

productRouter.get("/:id", (req, res) => {
  const product = findOwnedProduct(req);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(product);
});

productRouter.put("/:id", (req, res) => {
  const existing = findOwnedProduct(req);
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  const body = req.body as UpdateProductRequest;
  const updated = productsCollection.update(
    (p) => p.id === existing.id,
    (p) => ({
      ...p,
      sku: body.sku?.trim() || p.sku,
      name: body.name?.trim() || p.name,
      description: body.description !== undefined ? body.description.trim() : p.description,
      unitPrice: body.unitPrice ?? p.unitPrice,
      stockQty: body.stockQty ?? p.stockQty,
      active: body.active ?? p.active,
      updatedAt: new Date().toISOString(),
    }),
  );
  res.json(updated);
});

productRouter.delete("/:id", (req, res) => {
  const existing = findOwnedProduct(req);
  if (!existing) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  productsCollection.remove((p) => p.id === existing.id);
  res.status(204).send();
});
