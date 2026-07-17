import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupTests.js"],
    include: ["tests/components/**/*.test.{js,jsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
