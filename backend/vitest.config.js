import { defineConfig } from "vitest/config";

// La suite levanta mongodb-memory-server por archivo y corre flujos de reserva
// de extremo a extremo. En hardware lento, el default de 5s de vitest produce
// timeouts espurios cuando los 11 archivos compiten por CPU y disco a la vez
// (los tests pasan aislados). Un piso más alto elimina esa falsa alarma sin
// esconder cuelgues reales: 20s sigue siendo muy por debajo de cualquier test
// sano de este proyecto.
export default defineConfig({
  test: {
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
