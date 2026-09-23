import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* CADA RUTA DE TURNOS SE DECLARA ORIGINAL, CON SU PROPIA URL.
 *
 * El `index.html` declaraba `canonical` apuntando a la portada del sitio
 * institucional, y en una SPA ese <head> lo comparten todas las rutas: turnos
 * entero le decía a Google «soy un duplicado de la landing».
 *
 * El test unitario verifica que el código exista; éste, que funcione: navega
 * como una persona y lee el <head> que queda en cada pantalla. Hace falta el
 * navegador porque el canonical lo reescribe un efecto de React al cambiar de
 * ruta, y eso no pasa en ningún test sin DOM real.
 */

const HOST = "https://turnos.tuprofesorparticular.com.ar";
const canonical = (page) =>
  page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null);
const robots = (page) =>
  page.evaluate(() => document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null);

test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

test("la portada es la portada de turnos, no la de la landing", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  expect(await canonical(page)).toBe(`${HOST}/`);
});

test("/reservar declara su URL, sin la materia de la query", async ({ page }) => {
  /* /reservar?materia=Química no es otra página: es la misma con una materia
     preseleccionada. Si cada materia se declarara canónica, Google vería cinco
     copias del mismo formulario. */
  await page.goto("/reservar?materia=Qu%C3%ADmica");
  /* Se espera la condición misma y no un encabezado: la primera versión
     esperaba el primer h1 de la página, y `.first()` tomaba uno oculto. */
  await expect.poll(() => canonical(page)).toBe(`${HOST}/reservar`);
});

test("/portal declara su URL", async ({ page }) => {
  await page.goto("/portal");
  await expect.poll(() => canonical(page)).toBe(`${HOST}/portal`);
});

test("el 404 pide no ser indexado y no se declara original", async ({ page }) => {
  /* Pedir que no se indexe y a la vez nombrarse original son dos señales que se
     contradicen. */
  await page.goto("/ruta-que-no-existe");
  await expect.poll(() => robots(page)).toBe("noindex, follow");
  expect(await canonical(page)).toBeNull();
});

test("al salir del 404 vuelve la canónica de la ruta nueva", async ({ page }) => {
  /* El <head> es global: si la limpieza del 404 fallara, el resto de la visita
     quedaría sin canónica o con la equivocada. */
  await page.goto("/ruta-que-no-existe");
  await expect.poll(() => robots(page)).toBe("noindex, follow");
  await page.getByRole("link", { name: /inicio|volver/i }).first().click();
  await expect.poll(() => canonical(page)).toBe(`${HOST}/`);
  expect(await robots(page)).toBeNull();
});
