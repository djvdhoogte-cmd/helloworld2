# Whitelabel PWA

A whitelabel progressive web app: one codebase, multiple brands. Each brand
gets its own theme, feature set, and PWA identity (name/icon/colors), resolved
at request time from domain, header, or (in dev) a query param.

The first supported brand is **International Wholesale** (`brands/international-wholesale`).

## Architecture

```
apps/
  web/      React + Vite PWA (frontend)
  api/      Express + TypeScript REST API (backend)
packages/
  shared/   Types shared between web and api (BrandConfig, auth, process maps)
brands/
  international-wholesale/
    brand.json   theme, feature flags, PWA manifest info
    assets/      logo, favicon, icons
```

### How whitelabeling works

1. **Tenant resolution** (`apps/api/src/middleware/tenant.ts`): every API
   request resolves a `BrandConfig` from, in order, an `X-Brand-Id` header,
   a `?brand=` query param (dev convenience), the `Host` header matched
   against each brand's `domains`, or a configured default brand.
2. **Theming**: the frontend fetches `/api/brands/current` on boot and
   applies the brand's colors/fonts as CSS custom properties, and swaps the
   favicon and document title (`apps/web/src/brand/BrandContext.tsx`).
3. **Dynamic manifest**: `/api/brands/current/manifest.webmanifest` is
   generated per-brand from `brand.json`, so each tenant is installable as
   its own named PWA with its own icons — no separate frontend build per
   brand.
4. **Feature flags**: `brand.json`'s `features` map turns whole feature
   areas on/off per brand, enforced on both the API (`requireFeature`
   middleware) and the frontend (`useBrand().hasFeature(...)`, gating both
   nav links and routes).
5. **Adding a new brand**: copy `brands/international-wholesale`, edit
   `brand.json` (id, domains, theme, manifest, features), drop in new
   assets. No code changes required for a purely visual/feature-flag
   whitelabel; new domains just need DNS + the `domains` array updated.

### International Wholesale (first brand) — current features

- **Auth**: email/password registration and login (JWT), scoped per brand
  so the same email can exist independently under different brands.
- **BPMN 2.0 process mapping**: authenticated users can create, edit and
  save business process diagrams (BPMN 2.0 XML) using an embedded
  [bpmn-js](https://bpmn.io) modeler, for mapping international wholesale
  operations. Diagrams are persisted per user via the API.

Catalog and orders are modeled in the shared feature-flag schema but are
disabled for this brand until built out.

## Running locally

Requires Node 20+.

```bash
npm install
npm run dev:api    # starts the API on http://localhost:4000
npm run dev:web    # in another terminal, starts the PWA on http://localhost:5173
```

The web dev server proxies `/api` and `/brand-assets` to the API, so open
`http://localhost:5173` directly.

To preview a different brand locally before you have real DNS/subdomains
set up, append `?brand=<brand-id>` to the URL.

## Data storage

The API currently persists users and process maps to JSON files under
`apps/api/data/` for simplicity. Swap `apps/api/src/services/db.ts` for a
real database by keeping the same `JsonCollection`-shaped interface.

## Building for production

```bash
npm run build
```

Builds `packages/shared`, `apps/api`, then `apps/web` in dependency order.
