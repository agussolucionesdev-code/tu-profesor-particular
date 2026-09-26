import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

/* EL CAMBIO DE FUENTE NO MUEVE LA PORTADA.
 *
 * La portada se pinta antes de que lleguen Fraunces e Inter; con red lenta el
 * titular salía en la fuente del sistema y, al llegar Fraunces, empujaba todo:
 * CLS 0,127 en Lighthouse con red y CPU limitados de verdad (septiembre de
 * 2026). Los respaldos están escalados para medir lo mismo que la marca. */

const respaldos = leer("../../src/styles/fuentes-de-respaldo.css");
const tokens = leer("../../src/styles/tokens.css");

const cara = (familia) => {
  const bloque = [...respaldos.matchAll(/@font-face\s*\{[^}]*\}/g)]
    .map((m) => m[0])
    .find((b) => b.includes(`font-family: "${familia}";`));
  assert.ok(bloque, `falta la cara ${familia}`);
  return bloque;
};

/* Los números salen de @capsizecss/metrics (ver el comentario de la hoja):
   si alguien los toca sin recalcular, se entera acá. */
const ESPERADO = {
  "Fraunces Respaldo": { local: "Georgia", size: "105.2%", ascent: "92.96%", descent: "24.24%" },
  "Fraunces Respaldo Android": { local: "Noto Serif", size: "97.51%", ascent: "100.3%", descent: "26.15%" },
  "Inter Respaldo": { local: "Arial", size: "107.12%", ascent: "90.44%", descent: "22.52%" },
  "Inter Respaldo Android": { local: "Roboto", size: "107.35%", ascent: "90.24%", descent: "22.47%" },
};

test("cada respaldo usa una fuente del sistema escalada a la de la marca", () => {
  for (const [familia, e] of Object.entries(ESPERADO)) {
    const bloque = cara(familia);
    assert.match(bloque, new RegExp(`local\\("${e.local}"\\)`), familia);
    assert.doesNotMatch(bloque, /url\(/, `${familia} no puede descargar nada`);
    assert.match(bloque, new RegExp(`size-adjust: ${e.size.replace(".", "\\.")};`), familia);
    assert.match(bloque, new RegExp(`ascent-override: ${e.ascent.replace(".", "\\.")};`), familia);
    assert.match(bloque, new RegExp(`descent-override: ${e.descent.replace(".", "\\.")};`), familia);
    assert.match(bloque, /line-gap-override: 0%;/, familia);
  }
});

test("las pilas de fuentes ponen los respaldos justo después de la marca", () => {
  assert.match(tokens, /--ui-font-family-base:\s*'Inter Variable', 'Inter Respaldo', 'Inter Respaldo Android',/);
  assert.match(tokens, /--ui-font-display:\s*'Fraunces Variable', 'Fraunces Respaldo', 'Fraunces Respaldo Android',/);
});

test("la hoja de respaldos viaja con la entrada, junto a las fuentes", () => {
  const main = leer("../../src/main.jsx");
  const inter = main.indexOf('import "@fontsource-variable/inter/wght.css";');
  const respaldo = main.indexOf('import "./styles/fuentes-de-respaldo.css";');
  assert.ok(inter > 0 && respaldo > inter, "fuentes-de-respaldo.css se importa en main.jsx, después de las fuentes");
});
