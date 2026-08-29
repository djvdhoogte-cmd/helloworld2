import { Router, type Request } from "express";
import { nanoid } from "nanoid";
import type { CreateCustomerRequest, Customer, UpdateCustomerRequest } from "@whitelabel/shared";
import { requireAuth } from "../middleware/auth.js";
import { requireFeature } from "../middleware/requireFeature.js";
import { customersCollection } from "../services/customers.js";

function normalizeEdiIdentifiers(ids: string[] | undefined): string[] {
  if (!ids) return [];
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

export const customerRouter = Router();
customerRouter.use(requireFeature("customers"));
customerRouter.use(requireAuth);

customerRouter.get("/", (req, res) => {
  res.json(customersCollection.filter((c) => c.brandId === req.brand.id));
});

customerRouter.post("/", (req, res) => {
  const body = req.body as Partial<CreateCustomerRequest>;
  const name = body.name?.trim();
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const now = new Date().toISOString();
  const customer: Customer = {
    id: nanoid(),
    brandId: req.brand.id,
    name,
    contactEmail: body.contactEmail?.trim() ?? "",
    contactPhone: body.contactPhone?.trim() ?? "",
    pricingTier: body.pricingTier?.trim() ?? "standard",
    notes: body.notes?.trim() ?? "",
    ediIdentifiers: normalizeEdiIdentifiers(body.ediIdentifiers),
    createdAt: now,
    updatedAt: now,
  };
  customersCollection.insert(customer);
  res.status(201).json(customer);
});

function findOwnedCustomer(req: Request<{ id: string }>) {
  return customersCollection.find((c) => c.id === req.params.id && c.brandId === req.brand.id);
}

customerRouter.get("/:id", (req, res) => {
  const customer = findOwnedCustomer(req);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(customer);
});

customerRouter.put("/:id", (req, res) => {
  const existing = findOwnedCustomer(req);
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const body = req.body as UpdateCustomerRequest;
  const updated = customersCollection.update(
    (c) => c.id === existing.id,
    (c) => ({
      ...c,
      name: body.name?.trim() || c.name,
      contactEmail: body.contactEmail !== undefined ? body.contactEmail.trim() : c.contactEmail,
      contactPhone: body.contactPhone !== undefined ? body.contactPhone.trim() : c.contactPhone,
      pricingTier: body.pricingTier?.trim() || c.pricingTier,
      notes: body.notes !== undefined ? body.notes.trim() : c.notes,
      ediIdentifiers: body.ediIdentifiers !== undefined ? normalizeEdiIdentifiers(body.ediIdentifiers) : c.ediIdentifiers,
      updatedAt: new Date().toISOString(),
    }),
  );
  res.json(updated);
});

customerRouter.delete("/:id", (req, res) => {
  const existing = findOwnedCustomer(req);
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  customersCollection.remove((c) => c.id === existing.id);
  res.status(204).send();
});
