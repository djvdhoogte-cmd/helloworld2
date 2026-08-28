import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type { CreateSupplierRequest, Supplier, UpdateSupplierRequest } from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { suppliersCollection } from "../services/suppliers.js";

export const supplierRouter = Router();
supplierRouter.use(requireFeature("purchasing"));
supplierRouter.use(requireAuth);

supplierRouter.get("/", (req, res) => {
  res.json(suppliersCollection.filter((s) => s.brandId === req.brand.id));
});

supplierRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateSupplierRequest>;
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const now = new Date().toISOString();
  const supplier: Supplier = {
    id: nanoid(),
    brandId: req.brand.id,
    name,
    contactEmail: body.contactEmail?.trim() ?? "",
    contactPhone: body.contactPhone?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  };
  suppliersCollection.insert(supplier);
  res.status(201).json(supplier);
});

function findOwnedSupplier(req: Request<{ id: string }>) {
  return suppliersCollection.find((s) => s.id === req.params.id && s.brandId === req.brand.id);
}

supplierRouter.get("/:id", (req, res) => {
  const supplier = findOwnedSupplier(req);
  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  res.json(supplier);
});

supplierRouter.put("/:id", (req, res) => {
  const existing = findOwnedSupplier(req);
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  const body = req.body as UpdateSupplierRequest;
  const updated = suppliersCollection.update(
    (s) => s.id === existing.id,
    (s) => ({
      ...s,
      name: body.name?.trim() || s.name,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail.trim() : s.contactEmail,
      contactPhone: body.contactPhone !== undefined ? body.contactPhone.trim() : s.contactPhone,
      notes: body.notes !== undefined ? body.notes.trim() : s.notes,
      updatedAt: new Date().toISOString(),
    }),
  );
  res.json(updated);
});

supplierRouter.delete("/:id", (req, res) => {
  const existing = findOwnedSupplier(req);
  if (!existing) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }
  suppliersCollection.remove((s) => s.id === existing.id);
  res.status(204).send();
});
