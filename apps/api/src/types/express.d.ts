import type { BrandConfig, AuthTokenPayload } from "@whitelabel/shared";

declare global {
  namespace Express {
    interface Request {
      brand: BrandConfig;
      auth?: AuthTokenPayload;
    }
  }
}

export {};
