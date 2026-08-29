import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export function EdiLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page edi-page">
      <h1>EDI Flow Analyser</h1>
      <nav className="tab-nav">
        <NavLink to="/edi/messages" className={({ isActive }) => (isActive ? "active" : "")}>
          Inventory
        </NavLink>
        <NavLink to="/edi/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
          Dashboard
        </NavLink>
        <NavLink to="/edi/exceptions" className={({ isActive }) => (isActive ? "active" : "")}>
          Exceptions
        </NavLink>
        <NavLink to="/edi/partner-flow" className={({ isActive }) => (isActive ? "active" : "")}>
          Partner Flow
        </NavLink>
      </nav>
      <div className="tab-content">{children}</div>
    </div>
  );
}
