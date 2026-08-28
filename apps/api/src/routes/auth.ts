import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import type {
  AuthResponse,
  AuthTokenPayload,
  LoginRequest,
  RegisterRequest,
} from "@whitelabel/shared";
import { requireFeature } from "../middleware/requireFeature.js";
import { requireAuth } from "../middleware/auth.js";
import { JWT_EXPIRES_IN, JWT_SECRET } from "../config.js";
import {
  findUserByEmail,
  findUserById,
  toPublicUser,
  usersCollection,
  type StoredUser,
} from "../services/users.js";

export const authRouter = Router();
authRouter.use(requireFeature("auth"));

function issueToken(user: StoredUser): string {
  const payload: AuthTokenPayload = { sub: user.id, brandId: user.brandId, email: user.email };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

authRouter.post("/register", async (req, res) => {
  const body = req.body as Partial<RegisterRequest>;
  const email = body.email?.trim().toLowerCase();
  const { password, name } = body;

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password and name are required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "password must be at least 8 characters" });
    return;
  }

  if (findUserByEmail(req.brand.id, email)) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: StoredUser = {
    id: nanoid(),
    brandId: req.brand.id,
    email,
    name,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  usersCollection.insert(user);

  const response: AuthResponse = { token: issueToken(user), user: toPublicUser(user) };
  res.status(201).json(response);
});

authRouter.post("/login", async (req, res) => {
  const body = req.body as Partial<LoginRequest>;
  const email = body.email?.trim().toLowerCase();
  const { password } = body;

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = findUserByEmail(req.brand.id, email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const response: AuthResponse = { token: issueToken(user), user: toPublicUser(user) };
  res.json(response);
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = findUserById(req.brand.id, req.auth!.sub);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(toPublicUser(user));
});
