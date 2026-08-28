import type {
  CreateCustomerRequest,
  CreateProductRequest,
  CreatePurchaseOrderRequest,
  CreateSalesOrderRequest,
  CreateSupplierRequest,
  Customer,
  Product,
  PurchaseOrder,
  SalesOrder,
  Supplier,
  UpdateCustomerRequest,
  UpdatePurchaseOrderStatusRequest,
  UpdateProductRequest,
  UpdateSalesOrderStatusRequest,
  UpdateSupplierRequest,
} from "@whitelabel/shared";
import { apiFetch } from "../app/api.js";

export const productApi = {
  list: () => apiFetch<Product[]>("/api/products"),
  get: (id: string) => apiFetch<Product>(`/api/products/${id}`),
  create: (body: CreateProductRequest) =>
    apiFetch<Product>("/api/products", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateProductRequest) =>
    apiFetch<Product>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/products/${id}`, { method: "DELETE" }),
};

export const customerApi = {
  list: () => apiFetch<Customer[]>("/api/customers"),
  create: (body: CreateCustomerRequest) =>
    apiFetch<Customer>("/api/customers", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateCustomerRequest) =>
    apiFetch<Customer>(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/customers/${id}`, { method: "DELETE" }),
};

export const supplierApi = {
  list: () => apiFetch<Supplier[]>("/api/suppliers"),
  create: (body: CreateSupplierRequest) =>
    apiFetch<Supplier>("/api/suppliers", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: UpdateSupplierRequest) =>
    apiFetch<Supplier>(`/api/suppliers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  remove: (id: string) => apiFetch<void>(`/api/suppliers/${id}`, { method: "DELETE" }),
};

export const salesOrderApi = {
  list: () => apiFetch<SalesOrder[]>("/api/sales-orders"),
  get: (id: string) => apiFetch<SalesOrder>(`/api/sales-orders/${id}`),
  create: (body: CreateSalesOrderRequest) =>
    apiFetch<SalesOrder>("/api/sales-orders", { method: "POST", body: JSON.stringify(body) }),
  setStatus: (id: string, body: UpdateSalesOrderStatusRequest) =>
    apiFetch<SalesOrder>(`/api/sales-orders/${id}/status`, { method: "PUT", body: JSON.stringify(body) }),
};

export const purchaseOrderApi = {
  list: () => apiFetch<PurchaseOrder[]>("/api/purchase-orders"),
  get: (id: string) => apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}`),
  create: (body: CreatePurchaseOrderRequest) =>
    apiFetch<PurchaseOrder>("/api/purchase-orders", { method: "POST", body: JSON.stringify(body) }),
  setStatus: (id: string, body: UpdatePurchaseOrderStatusRequest) =>
    apiFetch<PurchaseOrder>(`/api/purchase-orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
