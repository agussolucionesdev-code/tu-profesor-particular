import { expect, test } from "@playwright/test";
import { RUTAS } from "./_comun.js";

/* EL PRERENDER SE VE SIN JAVASCRIPT, Y NADA CHOCA CON LA CSP.
 *
 * Medido en producción (septiembre de 2026): React 19.2 sacaba cada página a un
 * <div hidden> con scripts en línea para acomodarla, la CSP (`script-src
 * 'self'`) los bloqueaba y /sobre-mi mostraba sólo barra y pie hasta que
 * llegaba el bundle: CLS 1,0. `tests/prerenderVisible.test.js` cuida el
 * render; esto mira el resultado en un navegador, contra el build real.
 */

const esPrerender = async (request) => {
  const html = await (await request.get("/")).text();
  return /<div id="root">\s*<a class="skip-link"/.test(html);
};

test.describe("sin JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("cada página muestra su contenido tal como sale del servidor", async ({ page, request }) => {
    test.skip(!(await esPrerender(request)), "servidor de desarrollo: no hay prerender que mirar");
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await expect(page.locator("h1").first(), `${ruta}: sin h1 visible`).toBeVisible();
      expect(await page.locator('div[hidden][id^="S:"], template[id^="B:"]').count(), `${ruta}: quedó un Suspense sin resolver`).toBe(0);
      /* Sin JS no hay reveal: el contenido tiene que verse igual. */
      const invisibles = await page.locator("[data-reveal]").evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).opacity === "0").length,
      );
      expect(invisibles, `${ruta}: ${invisibles} elementos quedaron invisibles sin JS`).toBe(0);
    }
  });
});

test("ninguna página dispara errores de CSP ni de consola", async ({ page }) => {
  const errores = [];
  page.on("console", (m) => {
    /* La URL va aparte del texto: «Failed to load resource» no la nombra. */
    if (m.type() === "error") errores.push(`${m.text()} @ ${m.location()?.url ?? ""}`);
  });
  page.on("pageerror", (e) => errores.push(String(e)));
  for (const ruta of RUTAS) {
    await page.goto(ruta, { waitUntil: "networkidle" });
  }
  /* Dos ruidos del entorno de prueba, no del sitio:
     · Vercel Analytics sólo existe en Vercel: en `vite preview` su script da 404.
     · /materias pide los precios al backend, y el backend acepta sólo los
       orígenes de producción (CORS): desde 127.0.0.1 lo rechaza, y la página
       muestra los precios de respaldo, que es su comportamiento previsto. */
  const propios = errores.filter(
    (e) => !/_vercel\/(insights|speed-insights)/.test(e) && !/onrender\.com/.test(e),
  );
  expect(propios).toEqual([]);
});

/* Entrar DIRECTO a una página interna no puede mover la página.
 * Se medía CLS 1 en /sobre-mi y /materias: React vaciaba el contenido un
 * instante mientras llegaba el código de la página (ver src/paginas.js). Con la
 * CPU frenada, como en un celular medio, que es donde aparecía. */
for (const ruta of ["/sobre-mi", "/materias", "/como-trabajo", "/contacto"]) {
  test(`entrar directo a ${ruta} no hace saltar la página`, async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(ruta, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const cls = await page.evaluate(() => window.__cls);
    expect(cls, `CLS ${cls.toFixed(3)} en ${ruta}`).toBeLessThan(0.05);
  });
}
