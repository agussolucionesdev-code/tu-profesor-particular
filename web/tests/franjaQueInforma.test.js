import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { BRAND, LEVELS, SUBJECTS } from "../src/data/site.js";

/* LA FRANJA DEBAJO DEL HERO INFORMA, NO HACE TEATRO.
 *
 * Eran cuatro números que contaban desde cero al aparecer: «+9 años», «5+
 * materias», «5 niveles», «2 modalidades». ChatGPT (GPT-6 Astra) lo marcó en la
 * revisión del rediseño: se leían como indicadores de éxito sin serlo. Contar
 * hasta 2 no dice nada que la frase no diga mejor.
 *
 * Y además dos de los cuatro estaban mal:
 *   · «5+ materias principales» listaba exactamente cinco. El «+» sobraba.
 *   · «5 niveles educativos» dejaba afuera CENS, que tiene tarifa y se reserva
 *     en turnos (backend/src/services/pricingMatrix.js). Un adulto que termina
 *     la secundaria no encontraba su nivel nombrado en ningún texto del sitio.
 *
 * Ahora cada ítem es una etiqueta y una respuesta concreta. Los textos se
 * contrastan contra los datos: si mañana se suma una materia o un nivel y la
 * franja no se entera, falla acá.
 */

const fuente = readFileSync(new URL("../src/components/Credentials.jsx", import.meta.url), "utf8");
/* El .jsx no se importa desde node sin compilar: los textos se leen del
   arreglo `ITEMS` en la fuente. */
const valorDe = (etiqueta) => {
  const m = fuente.match(new RegExp(`label: "${etiqueta}",\\s*value: (\`[^\`]*\`|"[^"]*")`));
  assert.ok(m, `la franja tiene que tener el ítem «${etiqueta}»`);
  return m[1].slice(1, -1).replace("${BRAND.yearsTeaching}", String(BRAND.yearsTeaching));
};

test("no queda ningún contador animado", () => {
  assert.doesNotMatch(fuente, /CountUp|requestAnimationFrame|IntersectionObserver/);
  assert.doesNotMatch(fuente, /materias principales|niveles educativos/);
});

test("las materias son las del sitio, todas y sin «+»", () => {
  const materias = valorDe("Materias");
  for (const { label } of SUBJECTS) {
    assert.match(materias, new RegExp(label), `falta ${label}`);
  }
  assert.doesNotMatch(materias, /\+/);
});

test("los niveles nombran CENS y cada nivel del sitio", () => {
  const niveles = valorDe("Niveles").toLowerCase();
  assert.match(niveles, /cens/);
  for (const { label } of LEVELS) {
    /* «Terciario / Superior» → «terciario»; «Secundaria Técnica» → «técnica». */
    const clave = label.split(/[ /]+/).at(label.startsWith("Secundaria ") ? -1 : 0).toLowerCase();
    assert.ok(niveles.includes(clave), `falta «${clave}» (de ${label})`);
  }
});

test("la experiencia sale de BRAND, sin «+» ni «más de»", () => {
  const experiencia = valorDe("Experiencia");
  assert.match(experiencia, new RegExp(`^${BRAND.yearsTeaching} años`));
  assert.match(fuente, /\$\{BRAND\.yearsTeaching\}/, "el número no puede estar escrito a mano");
});

test("la modalidad dice dónde es lo presencial", () => {
  assert.match(valorDe("Modalidad"), /online.*presencial en Temperley/i);
});
