export interface AuthUser {
  id: string;
  brandId: string;
  email: string;
  name: string;
}

export interface AuthTokenPayload {
  sub: string;
  brandId: string;
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
