import type { EdiPartnerKind } from "@whitelabel/shared";
import { customersCollection } from "./customers.js";
import { suppliersCollection } from "./suppliers.js";

export interface MatchedPartner {
  partnerId: string;
  partnerKind: EdiPartnerKind;
  partnerName: string;
}

/**
 * Looks up a Customer or Supplier in this brand whose ediIdentifiers
 * includes the given code (the interchange sender/receiver id off the
 * message envelope). Customers are checked first; a code should not
 * realistically appear on both, but if it does the customer wins.
 */
export function matchEdiPartner(brandId: string, code: string): MatchedPartner | null {
  const needle = code.trim().toLowerCase();
  if (!needle) return null;

  const customer = customersCollection.find(
    (c) => c.brandId === brandId && c.ediIdentifiers.some((id) => id.toLowerCase() === needle),
  );
  if (customer) return { partnerId: customer.id, partnerKind: "customer", partnerName: customer.name };

  const supplier = suppliersCollection.find(
    (s) => s.brandId === brandId && s.ediIdentifiers.some((id) => id.toLowerCase() === needle),
  );
  if (supplier) return { partnerId: supplier.id, partnerKind: "supplier", partnerName: supplier.name };

  return null;
}
