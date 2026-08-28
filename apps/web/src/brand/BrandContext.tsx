import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BrandConfig, FeatureKey } from "@whitelabel/shared";
import { isFeatureEnabled } from "@whitelabel/shared";
import { apiFetch } from "../app/api.js";

interface BrandContextValue {
  brand: BrandConfig;
  hasFeature: (feature: FeatureKey) => boolean;
}

const BrandContext = createContext<BrandContextValue | null>(null);

function applyTheme(brand: BrandConfig) {
  const root = document.documentElement.style;
  root.setProperty("--color-primary", brand.theme.primaryColor);
  root.setProperty("--color-secondary", brand.theme.secondaryColor);
  root.setProperty("--color-background", brand.theme.backgroundColor);
  root.setProperty("--color-text", brand.theme.textColor);
  root.setProperty("--font-family", brand.theme.fontFamily);

  document.title = brand.displayName;

  const favicon = document.getElementById("favicon-link") as HTMLLinkElement | null;
  if (favicon) favicon.href = brand.theme.faviconUrl;

  const themeColorMeta = document.getElementById("theme-color-meta") as HTMLMetaElement | null;
  if (themeColorMeta) themeColorMeta.content = brand.manifest.themeColor;

  const manifestLink = document.getElementById("manifest-link") as HTMLLinkElement | null;
  if (manifestLink) manifestLink.href = `/api/brands/current/manifest.webmanifest?brand=${brand.id}`;
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<BrandConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BrandConfig>("/api/brands/current")
      .then((config) => {
        setBrand(config);
        applyTheme(config);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load brand"));
  }, []);

  const value = useMemo<BrandContextValue | null>(() => {
    if (!brand) return null;
    return { brand, hasFeature: (feature) => isFeatureEnabled(brand, feature) };
  }, [brand]);

  if (error) {
    return <div className="full-page-message">Could not load app configuration: {error}</div>;
  }
  if (!value) {
    return <div className="full-page-message">Loading…</div>;
  }

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): BrandContextValue {
  const ctx = useContext(BrandContext);
  if (!ctx) throw new Error("useBrand must be used within a BrandProvider");
  return ctx;
}
