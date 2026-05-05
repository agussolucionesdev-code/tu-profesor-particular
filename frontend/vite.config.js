import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

export default defineConfig({
  plugins: [
    react(),
    ViteImageOptimizer({
      png: { quality: 80 },
      jpg: { quality: 82 },
      jpeg: { quality: 82 },
      webp: { lossless: false, quality: 82 },
      svg: { plugins: [{ name: "removeViewBox", active: false }] },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 4174,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-datepicker": ["react-datepicker", "date-fns"],
          "vendor-icons": ["react-icons"],
        },
      },
    },
  },
});
