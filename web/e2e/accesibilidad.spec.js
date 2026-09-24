import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { MANCHAS, MEDIDOR, informe, informeManchas } from "../../frontend/tests/e2e/_medidores.js";
import { RUTAS, TEMAS, conTema, revelarTodo } from "./_comun.js";

/* ACCESIBILIDAD DEL SITIO, EN LOS DOS TEMAS.
 *
 * axe cubre las ~90 reglas que nadie escribe a mano (aria, roles, nombres,
 * encabezados). El contraste NO lo mide axe: con capas translúcidas y
 * gradientes lo devuelve como `incomplete` y el test pasaba sin haber medido
 * nada (está documentado en frontend/tests/e2e/axe.spec.js). Lo mide el
 * MEDIDOR compartido con turnos, que compone las capas a mano, y MANCHAS
 * busca recuadros claros en el modo oscuro.
 */

for (const tema of TEMAS) {
  for (const ruta of RUTAS) {
    test(`${ruta} en ${tema}: sin violaciones, contraste AA y sin manchas`, async ({ page }) => {
      await conTema(page, tema);
      await page.goto(ruta, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", tema);
      await revelarTodo(page);

      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze();
      expect(
        axe.violations,
        axe.violations.map((v) => `[${v.impact}] ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`).join("\n"),
      ).toEqual([]);

      const { medidos, fallas } = await page.evaluate(MEDIDOR);
      expect(medidos, `el medidor no midió nada en ${ruta}`).toBeGreaterThan(20);
      expect(fallas, `\n${informe(fallas)}\n`).toEqual([]);

      if (tema === "dark") {
        const { manchas } = await page.evaluate(MANCHAS);
        expect(manchas, `\n${informeManchas(manchas)}\n`).toEqual([]);
      }
    });
  }
}
