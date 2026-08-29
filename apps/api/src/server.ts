import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { PORT } from "./config.js";
import { tenantResolver } from "./middleware/tenant.js";
import { authRouter } from "./routes/auth.js";
import { brandRouter } from "./routes/brand.js";
import { customerRouter } from "./routes/customers.js";
import { ediRouter } from "./routes/edi.js";
import { processMapRouter } from "./routes/processMaps.js";
import { productRouter } from "./routes/products.js";
import { purchaseOrderRouter } from "./routes/purchaseOrders.js";
import { salesOrderRouter } from "./routes/salesOrders.js";
import { supplierRouter } from "./routes/suppliers.js";
import { getAllBrands } from "./services/brandRegistry.js";

const app = express();

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRANDS_DIR = join(__dirname, "../../../brands");

app.use(cors());
app.use(express.json());
app.use("/brand-assets", express.static(BRANDS_DIR));
app.use(tenantResolver);

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/brands", brandRouter);
app.use("/api/auth", authRouter);
app.use("/api/process-maps", processMapRouter);
app.use("/api/products", productRouter);
app.use("/api/customers", customerRouter);
app.use("/api/suppliers", supplierRouter);
app.use("/api/purchase-orders", purchaseOrderRouter);
app.use("/api/sales-orders", salesOrderRouter);
app.use("/api/edi", ediRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
});

const brands = getAllBrands();
if (brands.length === 0) {
  console.warn("No brands found under /brands — the app will not resolve a tenant.");
}

app.listen(PORT, () => {
  console.log(`Whitelabel API listening on http://localhost:${PORT}`);
  console.log(`Brands loaded: ${brands.map((b) => b.id).join(", ") || "(none)"}`);
});
