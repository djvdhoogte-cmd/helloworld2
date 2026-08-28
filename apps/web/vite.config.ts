import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// The manifest itself is generated per-brand by the API (see
// apps/api/src/routes/brand.ts) so a whitelabel deploy gets its own name,
// icons and colors without a frontend rebuild. This plugin only adds the
// service worker for offline support; manifest generation is disabled.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      injectRegister: "auto",
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/brand-assets\//],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/brand-assets": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
