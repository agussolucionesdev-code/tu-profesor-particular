import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* EL PRIMER TEMA QUE SE PINTA ES EL CORRECTO.
 *
 * Lo que se mide no es el tema final —React termina aplicándolo igual— sino el
 * PRIMERO que toca <html>. Si el primero es «claro» y después cambia a
 * «oscuro», la persona ve un destello blanco: eso es exactamente lo que evita
 * `public/tema.js`.
 *
 * Un MutationObserver instalado antes de que cargue cualquier script de la
 * página anota cada valor que va tomando `data-theme`.
 */

/* Se observa `document` y no `document.documentElement`: el script de inicio
   corre ANTES de que el parser cree <html>, así que `documentElement` es null
   todavía. La primera versión observaba null, no registraba nada, y todos los
   tests fallaban con una lista vacía —con el código nuevo y con el viejo—. */
const registrarTemas = (page) =>
  page.addInitScript(() => {
    window.__temas = [];
    new MutationObserver(() => {
      const t = document.documentElement?.dataset.theme;
      if (t && window.__temas.at(-1) !== t) window.__temas.push(t);
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-theme"] });
  });

test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
  await registrarTemas(page);
});

test("con el sistema en oscuro, la página arranca oscura y no pasa por claro", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  const temas = await page.evaluate(() => window.__temas);
  expect(temas, "secuencia de temas aplicados a <html>").toEqual(["dark"]);
});

test("con el sistema en claro, arranca clara", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => window.__temas)).toEqual(["light"]);
});

test("quien ya entró antes, con «claro» guardado por el sistema, pasa a seguir al sistema", async ({ page }) => {
  /* Es la migración: el código anterior guardaba «claro» en cada visita. */
  await page.addInitScript(() =>
    localStorage.setItem(
      "ui_accessibility_preferences",
      JSON.stringify({ themePreference: "light", fontScale: "default" }),
    ),
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => window.__temas)).toEqual(["dark"]);
});

test("quien eligió «claro» a mano lo conserva aunque el sistema esté oscuro", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "ui_accessibility_preferences",
      JSON.stringify({ themePreference: "light", version: 2 }),
    ),
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(await page.evaluate(() => window.__temas)).toEqual(["light"]);
});
