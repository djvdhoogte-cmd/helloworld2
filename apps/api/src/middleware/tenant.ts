import type { NextFunction, Request, Response } from "express";
import {
  getBrandByDomain,
  getBrandById,
  getDefaultBrand,
} from "../services/brandRegistry.js";

/**
 * Resolves the tenant/brand for a request. Precedence:
 * 1. X-Brand-Id header (explicit override, used by non-browser clients)
 * 2. ?brand= query param (local dev convenience, no DNS setup needed)
 * 3. Host header matched against each brand's configured domains
 * 4. Fallback to the default brand
 */
export function tenantResolver(req: Request, res: Response, next: NextFunction) {
  const headerBrandId = req.header("x-brand-id");
  const queryBrandId = typeof req.query.brand === "string" ? req.query.brand : undefined;
  const host = req.header("host") ?? "";

  const brand =
    (headerBrandId && getBrandById(headerBrandId)) ||
    (queryBrandId && getBrandById(queryBrandId)) ||
    getBrandByDomain(host) ||
    getDefaultBrand();

  if (!brand) {
    res.status(500).json({ error: "No brand configured on this server" });
    return;
  }

  req.brand = brand;
  next();
}
