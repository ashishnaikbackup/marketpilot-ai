import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/marketpilot-ai/" : "/",
  plugins: [react()],
  resolve: { alias: { "@assistant": fileURLToPath(new URL("../cloudflare-worker/src/assistant.js", import.meta.url)) } },
  server: { fs: { allow: [".."] }, host: "0.0.0.0", port: 5173 },
});
