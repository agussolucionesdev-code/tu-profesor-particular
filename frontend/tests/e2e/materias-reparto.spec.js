import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* LAS PORTADAS DE MATERIA SE REPARTEN COMO CARTAS.
 *
 * Elegís el nivel y aparecen ocho tarjetas de una sola vez, todas juntas, sin
 * que nada diga por dónde empezar a mirar. Es el momento MÁS visual del
 * recorrido —son ilustraciones, no una lista— y se resolvía como un cambio de
 * contenido cualquiera.
 *
 * Ahora entran escalonadas, en el orden en que se leen. No es decoración: el
 * escalonado es lo que convierte "apareció un bloque" en "se están repartiendo
 * opciones", y le da al ojo un recorrido en lugar de una pared.
 *
 * Lo que este archivo cuida no es que la animación exista —eso se ve en dos
 * segundos— sino las tres formas conocidas de que un escalonado arruine una
 * pantalla:
 *
 *   · que la última tarjeta tarde una eternidad en llegar,
 *   · que TODAS vuelvan a entrar cada vez que tocás una,
 *   · que siga moviéndose para quien pidió que no se mueva nada.
 */

const irAMaterias = async (page) => {
  await instalarBackendFalso(page);
  await page.goto("/reservar");
  await page.getByRole("button", { name: /Para otra persona/i }).click();
  await page.getByRole("button", { name: /Secundaria\. 1° a 6° año/i }).click();
  await expect(page.getByRole("button", { name: /Materia: Matemática/i })).toBeVisible();
};

const tarjetas = (page) =>
  page.$$eval(".kiosk-grid-subjects .kiosk-choice-subject", (nodos) =>
    nodos.map((n) => {
      const cs = getComputedStyle(n);
      return {
        nombre: n.getAttribute("aria-label"),
        animacion: cs.animationName,
        retardoMs: Math.round(Number.parseFloat(cs.animationDelay) * 1000),
        duracionMs: Math.round(Number.parseFloat(cs.animationDuration) * 1000),
      };
    }),
  );

test.describe("el reparto de las portadas", () => {
  test("cada tarjeta entra un poco después que la anterior", async ({ page }) => {
    await irAMaterias(page);
    const t = await tarjetas(page);

    expect(t.length).toBeGreaterThan(4);
    expect(t.every((x) => x.animacion === "kioskCartaEntra")).toBe(true);

    /* Escalonado de verdad: el retardo crece. Si todas entraran con el mismo
       retardo sería un bloque con pausa, no un reparto. */
    const retardos = t.map((x) => x.retardoMs);
    expect(retardos[0]).toBe(0);
    expect(new Set(retardos).size).toBeGreaterThan(3);
    expect(retardos).toEqual([...retardos].sort((a, b) => a - b));
  });

  test("la última no se hace esperar", async ({ page }) => {
    /* El error clásico del escalonado: multiplicar el retardo por el índice sin
       techo. Con ocho tarjetas a 60 ms la última llega a los 480; con las
       dieciocho que el panel de administración puede cargar, a los 1080 —y ahí
       ya no es una animación, es una pantalla que tarda en cargar—.

       320 ms de retardo más la duración deja todo puesto antes del medio
       segundo, que es el techo de lo que se percibe como respuesta inmediata. */
    await irAMaterias(page);
    const t = await tarjetas(page);

    const ultima = t[t.length - 1];
    expect(ultima.retardoMs).toBeLessThanOrEqual(320);
    expect(ultima.retardoMs + ultima.duracionMs).toBeLessThanOrEqual(700);
  });

  test("elegir una materia no vuelve a repartir todas", async ({ page }) => {
    /* Si la grilla se reanima con cada clic, la pantalla late cada vez que
       alguien se decide, y la tarjeta elegida se va de abajo justo cuando la
       persona quiere ver que eligió bien.

       Se mira la animación de ENTRADA y no "cualquier animación corriendo": la
       primera versión de este test prohibía lo segundo y fallaba señalando a
       Matemática, que es la que acababa de elegirse. Que la tarjeta elegida se
       mueva al elegirla no es el problema —es la respuesta al toque—; el
       problema sería que se repartieran las ocho de nuevo. */
    await irAMaterias(page);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Materia: Matemática/i }).click();
    await page.waitForTimeout(60);

    const repartidas = await page.$$eval(
      ".kiosk-grid-subjects .kiosk-choice-subject",
      (nodos) =>
        nodos
          .filter((n) =>
            n
              .getAnimations()
              .some((a) => a.animationName === "kioskCartaEntra" && a.playState === "running"),
          )
          .map((n) => n.getAttribute("aria-label")),
    );

    expect(repartidas, "tarjetas repartidas de nuevo al elegir").toEqual([]);
  });

  test("al volver al paso, las portadas ya están puestas", async ({ page }) => {
    /* Repartir quiere decir «acá están tus opciones, recién llegadas». Al
       volver al paso 1 esas ocho portadas NO son nuevas: ya las viste y ya
       elegiste una. Repartirlas otra vez miente sobre lo que pasó.

       Y se suma, porque volver ya trae su propio movimiento: medido, el panel
       entra desde la izquierda y el dock de la elección sube al mismo tiempo.
       Con el reparto encima son tres gestos compitiendo en el momento en que
       alguien vuelve PORQUE QUIERE CORREGIR algo, que es justo cuando menos
       paciencia tiene. */
    await irAMaterias(page);
    await page.getByRole("button", { name: /Materia: Matemática/i }).click();
    await page.getByRole("button", { name: /^Continuar$/ }).click();
    await page.waitForTimeout(900);

    await page.getByRole("button", { name: /Volver al paso 1: Materia/i }).click();
    await page.waitForTimeout(50);

    const repartidas = await page.$$eval(
      ".kiosk-grid-subjects .kiosk-choice-subject",
      (nodos) =>
        nodos.filter((n) =>
          n.getAnimations().some((a) => a.animationName === "kioskCartaEntra"),
        ).length,
    );

    expect(repartidas, "portadas repartidas de nuevo al volver").toBe(0);
  });

  test("cambiar de nivel sí vuelve a repartir", async ({ page }) => {
    /* La otra cara del test de arriba. Suprimir el reparto al volver es fácil
       de pasarse de rosca y dejarlo apagado para siempre: cambiar de nivel trae
       OTRAS materias, y ahí el reparto es exactamente lo que corresponde. */
    await irAMaterias(page);
    await page.waitForTimeout(800);

    await page.getByRole("button", { name: /Cambiar nivel/i }).click();
    await page.getByRole("button", { name: /Primaria\. 1° a 6° grado/i }).click();
    await page.waitForTimeout(40);

    const repartidas = await page.$$eval(
      ".kiosk-grid-subjects .kiosk-choice-subject",
      (nodos) =>
        nodos.filter((n) =>
          n.getAnimations().some((a) => a.animationName === "kioskCartaEntra"),
        ).length,
    );

    expect(repartidas).toBeGreaterThan(3);
  });

  test("con movimiento reducido las tarjetas no se desplazan", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await irAMaterias(page);
    const t = await tarjetas(page);

    expect(t.every((x) => x.animacion === "none")).toBe(true);
  });

  test("las portadas siguen visibles después de entrar", async ({ page }) => {
    /* Una animación con `backwards` que no termine deja las tarjetas en su
       estado inicial: invisibles. Es la forma más cara de romper un paso
       entero, y no la detecta ningún test que mire sólo el DOM. */
    await irAMaterias(page);
    await page.waitForTimeout(900);

    const invisibles = await page.$$eval(
      ".kiosk-grid-subjects .kiosk-choice-subject",
      (nodos) =>
        nodos
          .filter((n) => {
            const cs = getComputedStyle(n);
            return Number.parseFloat(cs.opacity) < 0.99 || cs.visibility === "hidden";
          })
          .map((n) => n.getAttribute("aria-label")),
    );

    expect(invisibles, "tarjetas que quedaron sin aparecer").toEqual([]);
  });
});
