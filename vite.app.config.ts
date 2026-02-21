import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  root: "src",
  plugins: [react(), tailwindcss()],
  server: { port: 3100, open: true },
  build: { outDir: "../dist-app" },
  resolve: {
    alias: {
      "@data": "/data",
      "@components": "/resources/health-dashboard/components",
    },
  },
});
