import { Navigate, Route, Routes } from "react-router-dom";
import { BrandProvider, useBrand } from "../brand/BrandContext.js";
import { AuthProvider } from "../auth/AuthContext.js";
import { LoginPage } from "../auth/LoginPage.js";
import { RegisterPage } from "../auth/RegisterPage.js";
import { ProtectedRoute } from "../auth/ProtectedRoute.js";
import { ProcessMapListPage } from "../process-map/ProcessMapListPage.js";
import { ProcessMapEditorPage } from "../process-map/ProcessMapEditorPage.js";
import { ProductsPage } from "../erp/ProductsPage.js";
import { CustomersPage } from "../erp/CustomersPage.js";
import { SuppliersPage } from "../erp/SuppliersPage.js";
import { SalesOrdersPage } from "../erp/SalesOrdersPage.js";
import { PurchaseOrdersPage } from "../erp/PurchaseOrdersPage.js";
import { Layout } from "./Layout.js";

function HomePage() {
  const { brand } = useBrand();
  return (
    <div className="page">
      <h1>Welcome to {brand.displayName}</h1>
      <p>This is the whitelabel PWA shell for the {brand.id} tenant.</p>
    </div>
  );
}

function AppRoutes() {
  const { hasFeature } = useBrand();

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        {hasFeature("auth") && (
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </>
        )}
        {hasFeature("processMapping") && (
          <>
            <Route
              path="/process-maps"
              element={
                <ProtectedRoute>
                  <ProcessMapListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/process-maps/:id"
              element={
                <ProtectedRoute>
                  <ProcessMapEditorPage />
                </ProtectedRoute>
              }
            />
          </>
        )}
        {hasFeature("catalog") && (
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
        )}
        {hasFeature("customers") && (
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <CustomersPage />
              </ProtectedRoute>
            }
          />
        )}
        {hasFeature("purchasing") && (
          <>
            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <SuppliersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchase-orders"
              element={
                <ProtectedRoute>
                  <PurchaseOrdersPage />
                </ProtectedRoute>
              }
            />
          </>
        )}
        {hasFeature("orders") && (
          <Route
            path="/sales-orders"
            element={
              <ProtectedRoute>
                <SalesOrdersPage />
              </ProtectedRoute>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export function App() {
  return (
    <BrandProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrandProvider>
  );
}
