import { Router } from "express";

export const brandRouter = Router();

// Public brand config for the resolved tenant: theme, feature flags, locale.
// The web app fetches this once on boot to render itself.
brandRouter.get("/current", (req, res) => {
  res.json(req.brand);
});

// Dynamically generated Web App Manifest per brand, so each whitelabel
// tenant gets its own installable PWA name/icons/colors without a build step.
brandRouter.get("/current/manifest.webmanifest", (req, res) => {
  const { manifest, displayName, locale } = req.brand;
  res.type("application/manifest+json").json({
    id: `/?brand=${req.brand.id}`,
    name: displayName,
    short_name: manifest.shortName,
    description: `${displayName} progressive web app`,
    start_url: `/?brand=${req.brand.id}`,
    scope: "/",
    display: "standalone",
    lang: locale,
    theme_color: manifest.themeColor,
    background_color: manifest.backgroundColor,
    icons: [
      { src: manifest.icon192, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: manifest.icon512, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  });
});
