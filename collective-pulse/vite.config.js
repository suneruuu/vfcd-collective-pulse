import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { fs: { deny: ["**/.pulse-data/**", "**/.git/**", "**/server/**", "**/server.js"] } },
  build: { outDir: "dist", emptyOutDir: true },
});
