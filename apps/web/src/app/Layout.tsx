import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useBrand } from "../brand/BrandContext.js";
import { useAuth } from "../auth/AuthContext.js";

export function Layout({ children }: { children: ReactNode }) {
  const { brand, hasFeature } = useBrand();
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <img src={brand.theme.logoUrl} alt={brand.displayName} className="brand-logo" />
        <nav>
          {hasFeature("processMapping") && <Link to="/process-maps">Process Maps</Link>}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="muted">{user.name}</span>
              <button className="link-button" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login">Sign in</Link>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
