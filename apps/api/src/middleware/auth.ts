import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthTokenPayload } from "@whitelabel/shared";
import { JWT_SECRET } from "../config.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    if (payload.brandId !== req.brand.id) {
      res.status(401).json({ error: "Token does not belong to this brand" });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
