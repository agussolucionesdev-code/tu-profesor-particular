import { expect, test } from "@playwright/test";
import { instalarBackendFalso } from "./_backendFalso.js";

/* EL MENÚ DE CELULAR TIENE QUE VERSE Y TOCARSE.
 *
 * Corre en el proyecto `mobile` porque el bug que lo trae sólo existe ahí, y
 * ningún test de unidad podía verlo: el menú estaba en el DOM, con
 * `aria-expanded="true"`, visible según `getComputedStyle`, con sus ítems
 * midiendo 54 px de alto. Todo lo que un test sin layout puede mirar daba bien.
 *
 * Lo que pasaba de verdad, medido en 375 × 812:
 *
 *   .navbar-container tiene `backdrop-filter` —el vidrio esmerilado de la
 *   barra— y `overflow: hidden`. Un elemento con backdrop-filter se vuelve el
 *   contenedor de sus descendientes `position: fixed`, así que el menú dejaba
 *   de medirse contra la ventana y pasaba a estar recortado por la barra: 66 px
 *   de alto. `elementFromPoint` sobre cada ítem devolvía el contenido de la
 *   página, no el ítem.
 *
 *   O sea: en un teléfono, abrir el menú no mostraba nada. Se bloqueaba el
 *   scroll, se oscurecía la barra, y no había a dónde ir salvo tocar afuera.
 *
 * Por eso el test hace clic de verdad en un ítem y espera navegar: un `click()`
 * de Playwright comprueba que el elemento reciba el evento, que es exactamente
 * lo que fallaba.
 */

const abrirMenu = async (page) => {
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

test("cada opción del menú se ve y recibe el toque", async ({ page }) => {
  await page.goto("/");
  await abrirMenu(page);

  const sheet = page.locator("#nav-menu-sheet");
  await expect(sheet).toBeVisible();

  for (const nombre of ["Inicio", "Mis Turnos", "Reservar"]) {
    const opcion = sheet.getByRole("link", { name: nombre });
    await expect(opcion).toBeVisible();
    /* El ítem tiene que ser el que recibe el toque en su propio centro. Sin
       esto, un menú tapado por la página pasaría el `toBeVisible`. */
    const loRecibe = await opcion.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const encima = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return el === encima || el.contains(encima);
    });
    expect(loRecibe, `«${nombre}» está tapado por otro elemento`).toBe(true);
  }
});

test("tocar una opción navega", async ({ page }) => {
  await page.goto("/");
  await abrirMenu(page);

  await page.locator("#nav-menu-sheet").getByRole("link", { name: "Mis Turnos" }).click();

  await expect(page).toHaveURL(/\/portal/);
});

test("el foco entra al menú y vuelve al botón al cerrarlo", async ({ page }) => {
  /* Un panel que se abre y deja el foco afuera obliga a recorrer toda la página
     con el teclado para llegar a lo que se acaba de abrir. Y al cerrarlo, el
     foco tiene que volver de donde salió. */
  await page.goto("/");
  await abrirMenu(page);

  await expect(page.locator("#nav-menu-sheet").getByRole("link", { name: "Inicio" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(page.locator("#nav-menu-sheet")).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
});
