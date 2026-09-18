import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  if (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY)
      throw new Error("Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
    if (!env.VITE_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_"))
      throw new Error(
        "Use a Supabase publishable key. Secret/service-role keys must never enter a frontend build.",
      );
    const url = new URL(env.VITE_SUPABASE_URL);
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))
      throw new Error("The Supabase project URL must use HTTPS.");
  }
  return {
    base: env.VITE_BASE_PATH || "/",
    plugins: [react()],
    server: {
      fs: {
        deny: ["**/.pulse-data/**", "**/.git/**", "**/server/**", "**/server.js", "**/supabase/**"],
      },
    },
    build: { outDir: "dist", emptyOutDir: true },
  };
});
