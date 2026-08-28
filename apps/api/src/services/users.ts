import type { AuthUser } from "@whitelabel/shared";
import { JsonCollection } from "./db.js";

export interface StoredUser extends AuthUser {
  passwordHash: string;
  createdAt: string;
}

export const usersCollection = new JsonCollection<StoredUser>("users.db.json");

export function toPublicUser(user: StoredUser): AuthUser {
  const { id, brandId, email, name } = user;
  return { id, brandId, email, name };
}

export function findUserByEmail(brandId: string, email: string): StoredUser | undefined {
  const normalized = email.trim().toLowerCase();
  return usersCollection.find((u) => u.brandId === brandId && u.email === normalized);
}

export function findUserById(brandId: string, id: string): StoredUser | undefined {
  return usersCollection.find((u) => u.brandId === brandId && u.id === id);
}
