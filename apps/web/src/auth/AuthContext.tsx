import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from "@whitelabel/shared";
import { apiFetch } from "../app/api.js";
import { clearToken, getToken, setToken } from "./token.js";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (req: LoginRequest) => Promise<void>;
  register: (req: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    apiFetch<AuthUser>("/api/auth/me")
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(req: LoginRequest) {
    const { token, user: loggedInUser } = await apiFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(req),
    });
    setToken(token);
    setUser(loggedInUser);
  }

  async function register(req: RegisterRequest) {
    const { token, user: newUser } = await apiFetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(req),
    });
    setToken(token);
    setUser(newUser);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
