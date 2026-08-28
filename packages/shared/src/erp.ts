export interface Product {
  id: string;
  brandId: string;
  sku: string;
  name: string;
  description: string;
  unitPrice: number;
  stockQty: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  sku: string;
  name: string;
  description?: string;
  unitPrice: number;
  stockQty?: number;
}

export interface UpdateProductRequest {
  sku?: string;
  name?: string;
  description?: string;
  unitPrice?: number;
  stockQty?: number;
  active?: boolean;
}

export interface Customer {
  id: string;
  brandId: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  pricingTier: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  pricingTier?: string;
  notes?: string;
}

export type UpdateCustomerRequest = Partial<CreateCustomerRequest>;

export interface Supplier {
  id: string;
  brandId: string;
  name: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierRequest {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
}

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderLineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export type SalesOrderStatus = "draft" | "submitted" | "fulfilled" | "cancelled";

export interface SalesOrder {
  id: string;
  brandId: string;
  customerId: string;
  ownerId: string;
  status: SalesOrderStatus;
  lines: OrderLine[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalesOrderRequest {
  customerId: string;
  lines: OrderLineInput[];
}

export interface UpdateSalesOrderStatusRequest {
  status: SalesOrderStatus;
}

export type PurchaseOrderStatus = "draft" | "submitted" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  brandId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: OrderLine[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: string;
  lines: OrderLineInput[];
}

export interface UpdatePurchaseOrderStatusRequest {
  status: PurchaseOrderStatus;
}
