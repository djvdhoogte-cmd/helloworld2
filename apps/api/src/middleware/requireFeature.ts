import type { NextFunction, Request, Response } from "express";
import { isFeatureEnabled, type FeatureKey } from "@whitelabel/shared";

export function requireFeature(feature: FeatureKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!isFeatureEnabled(req.brand, feature)) {
      res.status(404).json({ error: `Feature '${feature}' is not enabled for this brand` });
      return;
    }
    next();
  };
}
