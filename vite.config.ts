import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/transports/web/client", import.meta.url)),
    },
  },
  build: {
    outDir: "dist/client",
    rollupOptions: {
      input: "src/transports/web/client/main.tsx",
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/app.[ext]",
      },
    },
  },
});
