import { getToken } from "../auth/token.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function withBrandOverride(path: string): string {
  const params = new URLSearchParams(window.location.search);
  const brand = params.get("brand");
  if (!brand) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}brand=${encodeURIComponent(brand)}`;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(withBrandOverride(path), { ...init, headers });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
