import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* EL BOTÓN DE ACCESIBILIDAD, CON TECLADO Y AL LADO DE «CONTINUAR».
 *
 * Este archivo se escribió para el wizard anterior: esperaba un encabezado
 * /asegur/i e inyectaba paneles `.form-slide-panel` con botones
 * `.field-flow-next`. El kiosco reemplazó todo eso, así que fallaba siempre y
 * nadie lo corría. Se reescribió contra el kiosco quedándose sólo con lo que no
 * cuida otro test:
 *
 *   · Que el panel retenga el foco y lo devuelva al cerrarse. Hasta acá sólo
 *     había una regex sobre el código de `useFocusTrap`
 *     (`tests/unit/modalAccessibilityContract.test.js`): dice que el código
 *     existe, no que el panel lo use ni que el Tab se quede adentro.
 *   · Que el levante de los flotantes se SUELTE cuando la fila de «Continuar» se
 *     va. Que se levanten cuando la fila les pasa por debajo ya lo cuida «los
 *     flotantes y el muelle de «Continuar»» en `booking-accessibility.spec.js`,
 *     en cuatro anchos y midiendo el efecto; acá no se repite.
 */

const abrirKiosco = async (page) => {
  await instalarBackendFalso(page);
  await page.goto("/reservar");
  /* 30 s y no los 8 por defecto: el primer test de la corrida paga la
     compilación en frío de Vite del chunk del kiosco. */
  await expect(
    page.getByRole("heading", { level: 1, name: /¿Para quién es la clase\?/i }),
  ).toBeVisible({ timeout: 30_000 });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test.describe("el panel de accesibilidad con teclado", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("el Tab no se escapa del panel y Escape devuelve el foco al botón", async ({ page }) => {
    /* Sin la trampa, el Tab sale del panel y sigue por el kiosco que quedó
       detrás: quien navega con teclado cambia de materia sin ver dónde está
       parado. Y si al cerrar el foco no vuelve al botón, cae al principio del
       documento y hay que recorrer toda la página para retomar. */
    await abrirKiosco(page);

    const lanzador = page.getByRole("button", { name: "Abrir panel de accesibilidad" });
    /* Se abre con Enter y no con un clic: es el camino de quien usa teclado, y
       el botón que tiene el foco al abrir es al que tiene que volver. */
    await lanzador.focus();
    await page.keyboard.press("Enter");

    const panel = page.getByRole("dialog", { name: /Ajusta la lectura/i });
    const cerrar = panel.getByRole("button", { name: "Cerrar panel de accesibilidad", exact: true });
    const restablecer = panel.getByRole("button", { name: "Restablecer" });
    await expect(panel).toBeVisible();
    await expect(cerrar).toBeFocused();

    /* Una vuelta entera hacia adelante: cada Tab tiene que caer adentro del
       panel, y después del último control el foco vuelve a «Cerrar». Sin contar
       cuántos controles hay: agregar una opción no debería romper este test. */
    const foco = async () =>
      page.evaluate(() => {
        const activo = document.activeElement;
        return {
          adentro: Boolean(activo?.closest("#a11y-panel")),
          nombre: activo?.getAttribute("aria-label") ?? activo?.textContent?.trim() ?? "",
        };
      });
    let pasos = 0;
    let actual;
    do {
      await page.keyboard.press("Tab");
      pasos += 1;
      actual = await foco();
      expect(actual.adentro, `el Tab ${pasos} sacó el foco del panel (fue a «${actual.nombre}»)`).toBe(true);
    } while (actual.nombre !== "Cerrar panel de accesibilidad" && pasos < 40);
    await expect(cerrar).toBeFocused();
    expect(pasos, "la vuelta no pasó por los controles del panel").toBeGreaterThan(2);

    /* Y hacia atrás desde el primero, al último. */
    await page.keyboard.press("Shift+Tab");
    await expect(restablecer).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(lanzador).toBeFocused();
    await expect(lanzador).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("los flotantes cuando se va el muelle de «Continuar»", () => {
  /* 360: el ancho más angosto que se soporta, y el único que no mide el test de
     los cuatro anchos. */
  test.use({ viewport: { width: 360, height: 844 } });

  test("al abrir «Otra materia» el muelle desaparece y el levante se suelta", async ({ page }) => {
    /* Si el levante no se suelta, los dos flotantes quedan a media pantalla
       tapando el campo de «Otra materia», que es justo lo que la persona está
       por escribir. En el paso 1 no hay otra fila de acciones: sin el muelle no
       queda nada que justifique el levante.

       Se mide la variable en <html> y no la posición del botón: el botón también
       sube cuando el pie entra en pantalla (`--a11y-footer-lift`), y eso
       mezclaría dos levantes en una misma medida. La variable es el canal que
       leen los dos flotantes (lo fija `tests/unit/botonesFlotantes.test.js`). */
    await abrirKiosco(page);
    await page.getByRole("button", { name: /Para otra persona/i }).click();
    await page.getByRole("button", { name: /Secundaria\. 1° a 6° año/i }).click();
    await page.getByRole("button", { name: /Materia: Matemática/i }).click();

    const muelle = page.locator(".kiosk-selection-dock");
    await expect(muelle).toBeVisible();

    const levante = () =>
      page.evaluate(
        () =>
          Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue("--acciones-lift"),
          ) || 0,
      );
    /* Sin esto el test pasaría aunque el levante no se hubiera activado nunca. */
    await expect.poll(levante).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Otra materia: escribirla a mano" }).click();
    await expect(muelle).toHaveCount(0);

    await expect.poll(levante).toBe(0);
  });
});
