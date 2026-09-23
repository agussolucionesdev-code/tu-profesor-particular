import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

const calendario = leer("../../src/components/KioskSlotCalendar.css");
const pulido = leer("../../src/styles/final-polish.css");

/* Blancos táctiles de los controles que más importan.
 *
 * LA LECCIÓN QUE ESTOS TESTS PROTEGEN, y que costó un rato entender:
 *
 *   `width: 48px !important` NO garantiza una caja de 48 px en un flex item.
 *
 * El botón que abre la navegación medía **14 px de ancho** en producción, a 375 px de
 * viewport, teniendo `width: 48px !important` declarado. `.navbar-right-zone` queda en
 * 51 px y sus hijos piden 503, así que con `flex-shrink: 1` —el default— el navegador
 * los aplasta: `width` fija la BASE del flex item, no su tamaño final. El alto sí
 * quedaba en 48 porque el eje vertical no se encoge, y de ahí lo desconcertante del
 * síntoma: la misma declaración se cumplía a medias.
 *
 * Por eso las aserciones piden `flex-shrink: 0` y no sólo el `width`: sin eso, el
 * tamaño declarado es una intención, no un hecho.
 *
 * Son tests de texto sobre CSS, con lo que eso implica: no prueban el render. La
 * medición real se hace en el navegador y quedó en el PR. Lo que fijan es que nadie
 * vuelva a sacar la línea que hace que el tamaño se cumpla.
 */

const bloqueDe = (css, selector) => {
  /* El cuerpo de la primera regla que menciona ESE selector, no uno que lo contenga.
     La distinción no es teórica: buscar `.react-datepicker__day` con una coincidencia
     laxa encontraba `.react-datepicker__day-name` —el guion es un carácter válido de
     selector— y el test leía el bloque equivocado. Por eso se exige que después del
     selector no venga otro carácter de nombre. */
  const bloques = bloquesDe(css, selector);
  return bloques.length > 0 ? bloques[0] : null;
};

/* TODOS los cuerpos de regla para ese selector, no sólo el primero.
   Hace falta porque un mismo selector suele aparecer varias veces: los días del
   calendario tienen una regla con sólo `font-size` y el tamaño táctil vive dentro de un
   `@media (max-width: 480px)`. Buscando el primero se leía el bloque equivocado. */
const bloquesDe = (css, selector) => {
  const escapado = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`[^{}]*${escapado}(?![-\\w])[^{}]*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[1]);
};

/* LA BARRA SE REESCRIBIÓ DESDE CERO (Navbar.css) y estos tests la siguen a ella.
   Lo que protegen no cambió: cada control táctil declara 44 px como MÍNIMO —el
   requisito de WCAG 2.5.5 es un piso, no un número exacto— y `flex-shrink: 0`,
   que es lo que hace que el tamaño declarado se cumpla. */
const barra = leer("../../src/layouts/Navbar.css");
const CONTROLES_DE_LA_BARRA = [".tpp-nav-tool", ".tpp-nav-cta", ".tpp-nav-menu"];

test("los controles de la barra no se pueden encoger", () => {
  for (const sel of CONTROLES_DE_LA_BARRA) {
    const cuerpo = bloqueDe(barra, sel);
    assert.ok(cuerpo, `no encontré regla para ${sel}`);
    assert.match(cuerpo, /flex-shrink:\s*0/, `falta flex-shrink: 0 en ${sel}: sin eso el width es una intención`);
  }
});

test("el botón del menú declara 48px", () => {
  const cuerpo = bloqueDe(barra, ".tpp-nav-menu");
  assert.match(cuerpo, /(?:^|;|\s)width:\s*48px/);
  assert.match(cuerpo, /(?:^|;|\s)height:\s*48px/);
});

test("ningún control táctil de la barra queda declarado por debajo de 44", () => {
  /* Barrido sobre TODAS las reglas de cada control, no sólo la primera: el
     tamaño puede vivir en un @media. */
  /* Sin los pseudoelementos: la línea de 2 px bajo el enlace activo es un
     `::after` decorativo, no el blanco táctil. */
  const reglasSinPseudo = (css, sel) => {
    const escapado = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`${escapado}(?![-\\w])`);
    return [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)]
      .filter(([, selector]) => re.test(selector) && !selector.includes("::"))
      .map(([, , cuerpo]) => cuerpo);
  };
  for (const sel of [...CONTROLES_DE_LA_BARRA, ".tpp-nav-link", ".tpp-nav-invite-yes"]) {
    const bloques = reglasSinPseudo(barra, sel);
    assert.ok(bloques.length > 0, `no encontré reglas para ${sel}`);
    const declara = bloques.some((b) => /(?:min-)?(?:width|height):\s*(4[4-9]|[5-9]\d)px/.test(b));
    assert.ok(declara, `${sel} no declara ningún tamaño táctil de 44 o más`);
    for (const b of bloques) {
      for (const m of b.matchAll(/(?:^|;|\s)(?:min-width|min-height|width|height):\s*(\d+)px/g)) {
        assert.ok(Number(m[1]) >= 44, `${sel} declara ${m[1]}px, por debajo del mínimo táctil de 44`);
      }
    }
  }
});

test("las flechas de mes del calendario llegan a 44 y no se encogen", () => {
  /* Los días ya estaban en 44. Dejar las flechas en 32 movía el problema: de nada sirve
     acertar el día si no se puede llegar al mes. */
  const cuerpo = bloqueDe(calendario, ".ksc-month-nav");
  assert.ok(cuerpo, "no encontré regla para .ksc-month-nav");
  assert.match(cuerpo, /width:\s*44px/);
  assert.match(cuerpo, /height:\s*44px/);
  assert.match(cuerpo, /flex-shrink:\s*0/);
});

test("los días del calendario siguen en 44 en mobile", () => {
  /* Ya se había arreglado de 34 a 44 y este test evita que vuelva: es el control que hay
     que acertar para reservar, y 10 px son la diferencia entre elegir el 15 o el 16. */
  const bloques = bloquesDe(pulido, ".react-datepicker__day");
  assert.ok(bloques.length > 0, "no encontré regla para los días del calendario");
  // El tamaño vive en el bloque de mobile; otro bloque sólo ajusta la tipografía.
  const conTamaño = bloques.filter((b) => /width:\s*44px\s*!important/.test(b));
  assert.equal(
    conTamaño.length,
    1,
    `esperaba exactamente un bloque con el tamaño táctil, hay ${conTamaño.length}`,
  );
  assert.match(conTamaño[0], /height:\s*44px\s*!important/);
});

