import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hayBackend, instalarBackendFalso } from "./_backendFalso.js";

/* Un escáner automático, sobre el navegador de verdad.
 *
 * Hasta acá la accesibilidad de este proyecto se verificaba a mano: los specs
 * vecinos afirman contratos concretos (que ninguna imagen quede sin alt, que
 * todo control tenga nombre, que no haya scroll horizontal) y eso funciona
 * bien, pero sólo cubre lo que alguien se acordó de escribir.
 *
 * axe-core cubre la otra mitad: las ~90 reglas que nadie va a escribir a mano
 * —aria inválido, roles mal anidados, ids duplicados, tablas sin encabezado,
 * campos sin etiqueta, orden de encabezados— y sobre todo el CONTRASTE, que
 * necesita layout real y por eso no se puede medir en jsdom.
 *
 * Lo que motivó el archivo: un barrido manual de 1.356 elementos encontró un
 * solo texto por debajo del mínimo —el número del día elegido en el calendario,
 * 3.91:1 contra el 4.5 que pide AA— y para encontrarlo hubo que escribir un
 * medidor de contraste a mano, esquivando ocho formas distintas de medir mal.
 * Nada de eso queda si depende de que alguien lo repita.
 *
 * Se corre con `npm run test:e2e`. Es deliberado que falle el build si aparece
 * una violación: una regresión de accesibilidad no se ve mirando la pantalla.
 */

/* Las rutas públicas. `/admin` queda afuera porque pide login, y `/m` porque
   sin el token en el fragmento no tiene contenido propio. */
const RUTAS = ["/", "/reservar", "/portal"];
const TEMAS = ["light", "dark"];

const analizar = (page) =>
  new AxeBuilder({ page })
    /* WCAG 2.1 nivel A y AA, que es el objetivo declarado del proyecto.
       `best-practice` queda afuera a propósito: mezcla recomendaciones con
       incumplimientos y vuelve ruidoso un resultado que tiene que ser
       accionable. */
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    /* EL CONTRASTE NO SE MIDE ACÁ, Y NO ES UNA CONCESIÓN.
     *
     * Medido sobre esta misma página: axe devuelve la regla `color-contrast`
     * como **incomplete** en 68 elementos, con dos motivos que se repiten:
     *
     *   "background color could not be determined due to a background gradient"
     *   "could not be determined because it is overlapped by another element"
     *
     * Este sitio usa gradientes y capas superpuestas por todos lados, así que
     * axe queda ciego justo donde hay que mirar. Y los `incomplete` NO entran
     * en `violations`: dejar la regla activa hacía que el test dijera
     * "0 violaciones" habiendo sido incapaz de medir.
     *
     * Lo comprobé: con la falla real puesta —el día del calendario a 3.91:1—
     * este test pasaba igual. Un guardián que mira para otro lado es peor que
     * no tenerlo, porque además da confianza.
     *
     * El contraste lo cubre `contraste.spec.js`, que compone las capas a mano.
     * Acá quedan las ~90 reglas que axe sí evalúa bien y que nadie va a
     * escribir a mano. */
    .disableRules(["color-contrast"])
    .analyze();

/* Un informe que diga dónde está el problema. El volcado crudo de axe son
   cientos de líneas por violación y hace que nadie lo lea. */
const describir = (violaciones) =>
  violaciones
    .map((v) => {
      const nodos = v.nodes
        .slice(0, 4)
        .map((n) => `        ${n.target.join(" ")}\n          ${(n.failureSummary || "").split("\n").slice(0, 2).join(" ")}`)
        .join("\n");
      const resto = v.nodes.length > 4 ? `\n        …y ${v.nodes.length - 4} más` : "";
      return `  [${v.impact}] ${v.id}: ${v.help}\n${nodos}${resto}\n      ${v.helpUrl}`;
    })
    .join("\n\n");

test.describe.configure({ mode: "serial" });

/* Sin esto, todo lo que no sea `/` mide la pantalla de mantenimiento —que no
   tiene fallas— y el spec pasa por no haber mirado la página real. */
test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

for (const ruta of RUTAS) {
  for (const tema of TEMAS) {
    test(`sin violaciones de accesibilidad en ${ruta} (${tema})`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem("theme", t);
      }, tema);
      await page.goto(ruta);
      await expect(page.locator("main")).toBeVisible();

      /* Las animaciones de entrada dejan elementos en `opacity: 0` hasta que el
         IntersectionObserver dispara. axe descarta lo invisible, así que sin
         esto el escaneo mide de menos y pasa por no haber mirado. */
      await page.addStyleTag({
        content: `*{transition:none!important;animation:none!important}
          [data-reveal],[data-reveal-group],.reveal{opacity:1!important;visibility:visible!important;transform:none!important;clip-path:none!important}`,
      });
      await page.waitForTimeout(400);

      const { violations } = await analizar(page);
      expect(
        violations.length,
        violations.length ? `\n\n${describir(violations)}\n` : "",
      ).toBe(0);
    });
  }
}

test("sin violaciones en el paso del calendario, que es donde vivía la única falla", async ({
  page,
}) => {
  /* El único que necesita disponibilidad real: el calendario se la pide al
     backend, y esa respuesta no se simula a propósito (ver `_backendFalso.js`).
     Sin backend se saltea en vez de fallar, para que el CI no quede en rojo por
     algo que no es una regresión. */
  test.skip(!(await hayBackend()), "necesita el backend en :4100 (npm run dev en backend/)");

  await page.goto("/reservar");
  await expect(page.locator("main")).toBeVisible();

  const porNombre = (nombre) => page.getByRole("button", { name: nombre, exact: true });
  await page.getByRole("button", { name: /Ahora no/ }).click({ timeout: 3000 }).catch(() => {});
  await porNombre("Para otra persona. Un hijo, un hermano, un nieto, alguien a tu cargo").click();
  await porNombre("Secundaria. 1° a 6° año").click();
  await porNombre("Materia: Matemática").click();
  await page.getByRole("button", { name: /^Continuar/ }).click();
  await page.getByRole("button", { name: /^Online. Videollamada/ }).click();
  await page.getByRole("button", { name: /^Continuar/ }).click();

  /* El calendario carga la disponibilidad del backend. */
  await expect(page.locator(".react-datepicker__day--selected")).toBeVisible({
    timeout: 20_000,
  });

  const { violations } = await analizar(page);
  expect(
    violations.length,
    violations.length ? `\n\n${describir(violations)}\n` : "",
  ).toBe(0);
});
