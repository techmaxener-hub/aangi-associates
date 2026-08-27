import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production deploys to aa.tmarinternational.com/app/ (a subpath of the
// existing Hostinger subdomain, alongside the static apps/website).
// Dev stays at the root so local testing URLs don't need the prefix.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/app/" : "/",
  plugins: [react()],
  server: {
    fs: {
      allow: ["../.."],
    },
  },
}));
