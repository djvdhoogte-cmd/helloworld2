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
          {hasFeature("catalog") && <Link to="/products">Catalog</Link>}
          {hasFeature("customers") && <Link to="/customers">Customers</Link>}
          {hasFeature("purchasing") && <Link to="/suppliers">Suppliers</Link>}
          {hasFeature("purchasing") && <Link to="/purchase-orders">Purchase Orders</Link>}
          {hasFeature("orders") && <Link to="/sales-orders">Sales Orders</Link>}
          {hasFeature("processMapping") && <Link to="/process-maps">Process Maps</Link>}
          {hasFeature("ediInventory") && <Link to="/edi">EDI</Link>}
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
