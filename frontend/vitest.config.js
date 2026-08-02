import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setupTests.js"],
    /* Sólo los de componentes. Los 19 archivos de `tests/unit/` están escritos
       para el runner nativo de Node (`node:test`), no para Vitest, y corren con
       `npm run test:unit`.

       Esto NO es una exclusión deliberada de tests que deberían correr acá: es
       que son dos runners distintos. Durante mucho tiempo no hubo ningún script
       que ejecutara los de `tests/unit/`, así que 98 tests existían y nadie los
       corría. `npm test` ahora corre los dos grupos; usá ese. */
    include: ["tests/components/**/*.test.{js,jsx}"],
    clearMocks: true,
    restoreMocks: true,
  },
});
