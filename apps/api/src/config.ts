export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me";
export const JWT_EXPIRES_IN = "7d";
export const PORT = Number(process.env.PORT ?? 4000);
