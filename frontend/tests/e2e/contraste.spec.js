import { expect, test } from "@playwright/test";
import { hayBackend, instalarBackendFalso } from "./_backendFalso.js";
import { informe, prepararYMedir } from "./_medidores.js";

/* Contraste de texto medido en el navegador real. El medidor y sus ocho guardas
   viven en _medidores.js, compartidos con modo-oscuro.spec.js. */

const RUTAS = ["/", "/reservar", "/portal"];
const TEMAS = ["light", "dark"];

test.describe.configure({ mode: "serial" });

/* Sin esto, todo lo que no sea `/` mide la pantalla de mantenimiento —que no
   tiene fallas— y el spec pasa por no haber mirado la página real. */
test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

for (const ruta of RUTAS) {
  for (const tema of TEMAS) {
    test(`contraste AA en ${ruta} (${tema})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), tema);
      await page.goto(ruta);
      await expect(page.locator("main")).toBeVisible();

      const { medidos, fallas } = await prepararYMedir(page);

      /* Que haya medido algo. Sin esta afirmación, cualquiera de las ocho
         trampas de arriba convierte este test en un sello de goma que aprueba
         sin mirar. */
      expect(medidos, `el barrido no midió ningún elemento en ${ruta}`).toBeGreaterThan(20);
      expect(fallas.length, fallas.length ? `\n\n${informe(fallas)}\n` : "").toBe(0);
    });
  }
}

test("contraste AA en el calendario, que es donde estaba la única falla", async ({ page }) => {
  /* Este es el único que necesita disponibilidad real: el calendario la pide al
     backend y no se simula a propósito (ver `_backendFalso.js`). Sin backend se
     saltea en vez de fallar, para que el CI no quede en rojo por algo que no es
     una regresión. */
  test.skip(!(await hayBackend()), "necesita el backend en :4100 (npm run dev en backend/)");
  await page.goto("/reservar");
  await expect(page.locator("main")).toBeVisible();

  const porNombre = (n) => page.getByRole("button", { name: n, exact: true });
  await page.getByRole("button", { name: /Ahora no/ }).click({ timeout: 3000 }).catch(() => {});
  await porNombre("Para otra persona. Un hijo, un hermano, un nieto, alguien a tu cargo").click();
  await porNombre("Secundaria. 1° a 6° año").click();
  await porNombre("Materia: Matemática").click();
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await page.getByRole("button", { name: /^Online. Videollamada/ }).click();
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await expect(page.locator(".react-datepicker__day--selected")).toBeVisible({ timeout: 20_000 });

  /* El número del día elegido daba 3.91:1 con `--brand-green` de fondo, contra
     el 4.5 que pide AA para 14.4px: era el único texto de los dos sitios por
     debajo del mínimo, y justo el que confirma qué día reservaste. Ahora usa el
     par `--cta-solid-bg`/`--cta-solid-ink` y da 6.55:1. */
  const { medidos, fallas } = await prepararYMedir(page);
  expect(medidos, "el barrido no midió ningún elemento en el calendario").toBeGreaterThan(50);
  expect(fallas.length, fallas.length ? `\n\n${informe(fallas)}\n` : "").toBe(0);
});
