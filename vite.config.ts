import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed dev port; fail if it is taken instead of silently switching.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    hmr: {
      protocol: "ws",
      host: "localhost",
      port: 1421,
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 4000,
  },
});