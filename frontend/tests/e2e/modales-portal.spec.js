import { expect, test } from "@playwright/test";

/* LOS DOS MODALES DEL PORTAL, MEDIDOS EN UN NAVEGADOR DE VERDAD.
 *
 * Cancelar y reprogramar son las dos únicas cosas que alguien hace en el portal
 * con apuro: se le complicó el día y quiere resolverlo desde el teléfono, parado
 * en cualquier lado. Todo lo que mide este archivo —que el botón entre en el
 * dedo, que se llegue a él sin que quede tapado, que el foco no se escape— sólo
 * existe con layout. En jsdom los dos modales pasan cualquier test: el DOM dice
 * que están ahí y que son visibles.
 *
 * El portal se abre con un backend interceptado. No alcanza con `/health`: la
 * sesión, el historial y el token por turno son lo que pone los modales en
 * pantalla.
 */

const AHORA = Date.now();
const EN_DOS_DIAS = new Date(AHORA + 2 * 24 * 60 * 60 * 1000);
EN_DOS_DIAS.setHours(15, 0, 0, 0);

const TURNO = {
  bookingCode: "A3K9PQ",
  studentName: "Camila Duarte",
  subject: "Matemática",
  level: "Secundaria",
  modality: "online",
  duration: 1,
  status: "confirmed",
  email: "familia@example.com",
  phone: "1123456789",
  timeSlot: EN_DOS_DIAS.toISOString(),
  endTime: new Date(EN_DOS_DIAS.getTime() + 60 * 60 * 1000).toISOString(),
};

const json = (route, body, status = 200) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

const instalarPortalFalso = async (page) => {
  await page.route("**/health", (route) =>
    json(route, { status: "success", database: { isConnected: true } }),
  );

  await page.route("**/api/settings", (route) =>
    json(route, {
      success: true,
      data: {
        "schedule.timeZone": "America/Argentina/Buenos_Aires",
        "schedule.slotDurationMinutes": 30,
        "schedule.advanceNoticeMinutes": 60,
        "schedule.maximumAdvanceDays": 120,
        "teacher.address": "Jujuy 414, Temperley, Buenos Aires",
      },
    }),
  );

  await page.route("**/api/bookings/portal/session", (route) =>
    json(route, { success: true, data: { managementToken: "token-de-prueba" } }),
  );

  await page.route("**/api/bookings/portal/history", (route) =>
    json(route, { success: true, data: { bookings: [TURNO], current: TURNO.bookingCode } }),
  );

  /* La disponibilidad se responde vacía a propósito: lo que se mide es el
     armado del modal, no el contrato del calendario —que tiene su propio spec
     contra el backend real—. Con cero horarios el diálogo es MÁS CORTO que en
     uso real, así que todo lo que acá no entre en pantalla, en la vida real
     tampoco. */
  await page.route("**/api/bookings/availability**", (route) =>
    json(route, {
      success: true,
      data: {
        slots: [],
        schedule: { timeZone: "America/Argentina/Buenos_Aires" },
        range: { from: new Date(AHORA).toISOString(), to: new Date(AHORA + 30 * 864e5).toISOString() },
      },
    }),
  );
};

const entrarAlPortal = async (page) => {
  await instalarPortalFalso(page);
  await page.goto("/portal");
  await page.getByLabel(/código de reserva/i).fill(TURNO.bookingCode);
  await page.getByLabel(/email o teléfono/i).fill(TURNO.email);
  await page.getByRole("button", { name: /entrar de forma segura/i }).click();
  await expect(page.getByRole("button", { name: /^Cancelar$/ })).toBeVisible();
};

/* 44 px de lado es el mínimo de WCAG 2.5.5 (AAA en 2.1, AA en 2.2). No es un
   número de diseño: es el ancho de la yema de un dedo adulto. Por debajo, el
   toque cae afuera y la persona vuelve a intentar sobre el mismo botón. */
const LADO_MINIMO = 44;

const medirBotones = (page, selector) =>
  page.$$eval(selector, (nodos) =>
    nodos
      .filter((n) => n.offsetParent !== null)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return {
          texto: n.textContent.trim().replace(/\s+/g, " ").slice(0, 28) || n.getAttribute("aria-label"),
          ancho: Math.round(r.width),
          alto: Math.round(r.height),
        };
      }),
  );

test.describe("el modal de cancelar", () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPortal(page);
    await page.getByRole("button", { name: /^Cancelar$/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("sus botones entran en un dedo", async ({ page }) => {
    const botones = await medirBotones(page, ".cancel-dialog button");
    expect(botones.length).toBeGreaterThan(0);

    const chicos = botones.filter((b) => b.alto < LADO_MINIMO);
    expect(chicos, `botones por debajo de ${LADO_MINIMO} px de alto`).toEqual([]);
  });

  test("se llega a confirmar sin que el diálogo se salga de la pantalla", async ({ page }) => {
    /* Un diálogo más alto que la ventana y con `overflow: hidden` no deja
       llegar al botón de ninguna manera: no hay scroll interno y el de la
       página está bloqueado. La persona queda mirando un cartel que no puede
       responder. */
    const medida = await page.evaluate(() => {
      const d = document.querySelector(".cancel-dialog");
      const r = d.getBoundingClientRect();
      return {
        sobresale: Math.round(Math.max(0, r.bottom - window.innerHeight) + Math.max(0, -r.top)),
        seDesborda: d.scrollHeight > d.clientHeight + 1,
        puedeDesplazarse: getComputedStyle(d).overflowY !== "hidden",
      };
    });

    expect(medida.sobresale, "el diálogo se sale de la ventana").toBe(0);
    if (medida.seDesborda) {
      expect(medida.puedeDesplazarse, "el contenido no entra y no se puede desplazar").toBe(true);
    }
  });

  test("el foco entra al diálogo al abrirlo", async ({ page }) => {
    const dentro = await page.evaluate(() =>
      document.querySelector(".cancel-dialog").contains(document.activeElement),
    );
    expect(dentro).toBe(true);
  });
});

test.describe("el modal de reprogramar", () => {
  test.beforeEach(async ({ page }) => {
    await entrarAlPortal(page);
    await page.getByRole("button", { name: /cambiar horario/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("sus botones entran en un dedo", async ({ page }) => {
    const botones = await medirBotones(page, ".reschedule-dialog button");
    expect(botones.length).toBeGreaterThan(0);

    const chicos = botones.filter((b) => b.alto < LADO_MINIMO || b.ancho < LADO_MINIMO);
    expect(chicos, `botones por debajo de ${LADO_MINIMO} px`).toEqual([]);
  });

  test("se llega al final del diálogo sin que se salga de la pantalla", async ({ page }) => {
    const medida = await page.evaluate(() => {
      const d = document.querySelector(".reschedule-dialog");
      const r = d.getBoundingClientRect();
      return {
        sobresale: Math.round(Math.max(0, r.bottom - window.innerHeight) + Math.max(0, -r.top)),
        seDesborda: d.scrollHeight > d.clientHeight + 1,
        puedeDesplazarse: getComputedStyle(d).overflowY !== "hidden",
      };
    });

    expect(medida.sobresale, "el diálogo se sale de la ventana").toBe(0);
    if (medida.seDesborda) {
      expect(medida.puedeDesplazarse, "el contenido no entra y no se puede desplazar").toBe(true);
    }
  });

  test("los días del calendario se pueden tocar", async ({ page }) => {
    /* Este test nació de una sospecha EQUIVOCADA: la hoja del modal declara
       `width: 2rem; line-height: 2rem` para el día, o sea 32 px, y di por hecho
       que ése era el tamaño real. Medido en el navegador, el día mide 44 × 44:
       reglas globales de la app lo agrandan después.

       Queda igual, y por eso: el día es el control más tocado de un calendario,
       su tamaño real NO se deduce de la hoja que lo declara, y hoy está bien.
       Lo que este test cuida es que siga estándolo cuando alguien toque una de
       esas reglas globales creyendo que sólo afecta a otra pantalla.

       38 y no 44 porque lo que se mide es la caja real, y el navegador redondea
       medios píxeles cuando la grilla reparte el ancho disponible. */
    const dias = await page.$$eval(".reschedule-datepicker .react-datepicker__day", (nodos) =>
      nodos
        .filter((n) => getComputedStyle(n).visibility !== "hidden")
        .map((n) => {
          const r = n.getBoundingClientRect();
          return { ancho: Math.round(r.width), alto: Math.round(r.height) };
        }),
    );

    expect(dias.length).toBeGreaterThan(20);
    const chicos = dias.filter((d) => d.alto < 38 || d.ancho < 38);
    expect(chicos.length, "días del calendario por debajo de 38 px").toBe(0);
  });

  test("el calendario entra entero en el diálogo", async ({ page }) => {
    /* Medido a 393 px: el diálogo llegaba hasta x=377 y la grilla del mes hasta
       x=399. La columna de los domingos quedaba FUERA, cortada por el borde
       redondeado, y con ella un día de cada semana —incluido el último del mes,
       que es cuando más falta hace mirar adelante—.

       La causa es de manual: react-datepicker le pone a cada día un ancho fijo
       más su margen y los suma, sin preguntar cuánto espacio hay. Siete por
       cincuenta son 350 en una caja de 323. El calendario del wizard de reserva
       ya reparte el ancho disponible en vez de sumarlo; éste no se había
       enterado.

       Se mide contra el borde del diálogo y no contra la ventana a propósito: un
       día que asoma por fuera de la tarjeta ya está perdido, aunque técnicamente
       siga dentro de la pantalla. */
    const desbordes = await page.evaluate(() => {
      const caja = document.querySelector(".reschedule-dialog").getBoundingClientRect();
      return [...document.querySelectorAll(".reschedule-datepicker .react-datepicker__week")]
        .map((semana) => {
          const r = semana.getBoundingClientRect();
          return {
            dias: semana.textContent,
            porDerecha: Math.round(r.right - caja.right),
            porIzquierda: Math.round(caja.left - r.left),
          };
        })
        .filter((s) => s.porDerecha > 0 || s.porIzquierda > 0);
    });

    expect(desbordes, "semanas que se salen del diálogo").toEqual([]);
  });

  test("no aparece scroll horizontal", async ({ page }) => {
    const ancho = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      ventana: window.innerWidth,
    }));
    expect(ancho.documento).toBeLessThanOrEqual(ancho.ventana);
  });
});

/* LOS DOS MODALES APARECÍAN DE GOLPE.
 *
 * Sin animación de entrada, el diálogo se materializa sobre la pantalla y no se
 * ve DE DÓNDE vino: la página de atrás sigue ahí, oscurecida, y el ojo tiene que
 * reconstruir solo qué pasó. Medio segundo de desconcierto en la pantalla donde
 * alguien viene a cancelar una clase.
 *
 * No se mide el fotograma —eso sería medir el reloj— sino la regla: qué
 * animación le toca al diálogo cuando se abre. Y con `prefers-reduced-motion`
 * le toca OTRA, la que aparece sin desplazarse: se conserva la aparición porque
 * sin ella no queda ninguna señal de que la pantalla cambió, que es justamente
 * el problema que se está arreglando.
 */
const animacionDe = (page, selector) =>
  page.evaluate((sel) => {
    const estilo = getComputedStyle(document.querySelector(sel));
    return { nombre: estilo.animationName, duracion: estilo.animationDuration };
  }, selector);

for (const caso of [
  { nombre: "cancelar", abrir: /^Cancelar$/, dialogo: ".cancel-dialog", overlay: ".cancel-overlay" },
  {
    nombre: "reprogramar",
    abrir: /cambiar horario/i,
    dialogo: ".reschedule-dialog",
    overlay: ".reschedule-overlay",
  },
]) {
  test.describe(`la entrada del modal de ${caso.nombre}`, () => {
    test("el diálogo entra con una animación, y el fondo con otra", async ({ page }) => {
      await entrarAlPortal(page);
      await page.getByRole("button", { name: caso.abrir }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const dialogo = await animacionDe(page, caso.dialogo);
      const overlay = await animacionDe(page, caso.overlay);

      expect(dialogo.nombre).toBe("modalEntra");
      expect(overlay.nombre).toBe("modalFondoEntra");
      /* Más de 300 ms en algo que se abre a mano se siente lento: la persona ya
         movió el dedo y la pantalla sigue acomodándose. */
      expect(Number.parseFloat(dialogo.duracion)).toBeLessThanOrEqual(0.3);
    });

    test("con movimiento reducido aparece sin desplazarse", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await entrarAlPortal(page);
      await page.getByRole("button", { name: caso.abrir }).click();
      await expect(page.getByRole("dialog")).toBeVisible();

      const dialogo = await animacionDe(page, caso.dialogo);
      expect(dialogo.nombre).toBe("modalAparece");
    });
  });
}
