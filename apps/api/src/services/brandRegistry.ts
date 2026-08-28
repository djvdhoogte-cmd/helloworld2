import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrandConfig } from "@whitelabel/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = join(__dirname, "../../../../brands");

function loadBrands(): Map<string, BrandConfig> {
  const brands = new Map<string, BrandConfig>();
  let entries: string[] = [];
  try {
    entries = readdirSync(BRANDS_DIR);
  } catch {
    return brands;
  }
  for (const entry of entries) {
    const brandFile = join(BRANDS_DIR, entry, "brand.json");
    try {
      const raw = readFileSync(brandFile, "utf-8");
      const config = JSON.parse(raw) as BrandConfig;
      brands.set(config.id, config);
    } catch {
      // not a brand directory, skip
    }
  }
  return brands;
}

const brandsById = loadBrands();
const DEFAULT_BRAND_ID = process.env.DEFAULT_BRAND_ID ?? "international-wholesale";

export function getAllBrands(): BrandConfig[] {
  return Array.from(brandsById.values());
}

export function getBrandById(id: string): BrandConfig | undefined {
  return brandsById.get(id);
}

export function getBrandByDomain(domain: string): BrandConfig | undefined {
  const host = domain.split(":")[0];
  for (const brand of brandsById.values()) {
    if (brand.domains.includes(host)) return brand;
  }
  return undefined;
}

export function getDefaultBrand(): BrandConfig | undefined {
  return brandsById.get(DEFAULT_BRAND_ID) ?? getAllBrands()[0];
}
