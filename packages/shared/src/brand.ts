export type FeatureKey =
  | "auth"
  | "processMapping"
  | "catalog"
  | "orders"
  | "customers"
  | "purchasing";

export interface BrandTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  logoUrl: string;
  faviconUrl: string;
  fontFamily: string;
}

export interface BrandManifestConfig {
  shortName: string;
  themeColor: string;
  backgroundColor: string;
  icon192: string;
  icon512: string;
}

export interface BrandConfig {
  id: string;
  displayName: string;
  domains: string[];
  locale: string;
  theme: BrandTheme;
  manifest: BrandManifestConfig;
  features: Partial<Record<FeatureKey, boolean>>;
}

export function isFeatureEnabled(
  brand: Pick<BrandConfig, "features">,
  feature: FeatureKey,
): boolean {
  return brand.features[feature] === true;
}
