import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

/* Pruebas en navegador del sitio institucional.
 *
 * Hasta ahora `web/` sólo tenía tests que leen el código fuente. Sirven, pero
 * no ven lo que ve una persona: un prerender que sale escondido, un contraste
 * que sólo falla sobre la portada azul, una barra que desborda a 375 px. Todo
 * eso pasó en este sitio y lo encontró una medición a mano.
 *
 * Contra QUÉ se corre importa: en CI, contra el build de producción servido con
 * `vite preview` —HTML prerenderizado incluido—, que es lo que publica Vercel.
 * Para probar a mano contra el servidor de desarrollo:
 *
 *   SITIO_URL=http://localhost:5180 npx playwright test
 *
 * (el spec del prerender se saltea solo ahí: en desarrollo no hay prerender).
 */
const BASE = process.env.SITIO_URL ?? "http://127.0.0.1:4180";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  use: { baseURL: BASE, trace: "retain-on-failure" },
  webServer: process.env.SITIO_URL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4180 --strictPort",
        url: BASE,
        reuseExistingServer: true,
        timeout: 60_000,
      },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
