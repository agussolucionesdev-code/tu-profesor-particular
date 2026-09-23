import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* LO QUE EL KIOSCO DE RESERVA LE DEBE A QUIEN NO LO VE O NO LO LEE CÓMODO.
 *
 * Este archivo se escribió para el wizard anterior —paneles deslizantes que
 * quedaban montados, una progressbar con botones adentro— y siguió apuntando a
 * él después de que el kiosco lo reemplazó: esperaba un encabezado que ya no
 * existe y fallaba siempre, así que nadie lo corría y no cuidaba nada.
 *
 * Se reescribió propiedad por propiedad contra el kiosco. Dos se sacaron porque
 * ya las cuida otro test, más cerca del código:
 *
 *   · Que los errores de validación queden asociados a su campo:
 *     `tests/components/CamposDelPaso4.test.jsx` (el error llega como
 *     descripción accesible, después de la ayuda) y
 *     `tests/unit/erroresDeCampoAccesibles.test.js` (texto, alerta y foco al
 *     primero que falla).
 *   · Que se sepa qué se contrata antes de entregar datos: la región «Antes de
 *     reservar» vivía en el formulario viejo y se borró con él (2216e8e). Lo que
 *     la reemplaza está cubierto en `tests/unit/commercialTrustContract.test.js`
 *     (modalidades con la dirección presencial, y el precio antes del paso 4) y
 *     en `tests/components/KioskVozAgustin.test.jsx` (la voz de Agustín antes del
 *     primer campo).
 */

const TITULO_PASO_1 = /¿Para quién es la clase\?/i;

const abrirKiosco = async (page) => {
  await instalarBackendFalso(page);
  await page.goto("/reservar");
  /* 30 s y no los 8 por defecto: el primer test de la corrida paga la
     compilación en frío de Vite del chunk del kiosco. */
  await expect(page.getByRole("heading", { level: 1, name: TITULO_PASO_1 })).toBeVisible({
    timeout: 30_000,
  });
};

/* Del paso 1 al 2 por el camino corto: sin calendario, que necesita
   disponibilidad real (ver `_backendFalso.js`). */
const avanzarAlPaso2 = async (page) => {
  await page.getByRole("button", { name: /Para otra persona/i }).click();
  await page.getByRole("button", { name: /Secundaria\. 1° a 6° año/i }).click();
  await page.getByRole("button", { name: /Materia: Matemática/i }).click();
  await page.getByRole("button", { name: /^Continuar$/ }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "¿Cómo preferís la clase?" }),
  ).toBeVisible();
};

test.describe("el kiosco de reserva", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("arranca siguiendo el tema del sistema y con la voz en silencio", async ({ page }) => {
    /* La voz apagada es la parte que no se negocia: un sitio que empieza a
       hablar solo pisa al lector de pantalla de quien ya usa uno (WCAG 1.4.2).
       Se enciende sólo si la persona la pide.

       «Sistema» y no «claro»: el tema sigue al teléfono o la computadora. Lo
       que eso significa en la primera pintura —sin destello, respetando lo que
       se eligió a mano— lo cuida `tests/e2e/tema-del-sistema.spec.js`, que
       mide en `/`; acá sólo se fija que el kiosco arranque con el mismo valor. */
    await abrirKiosco(page);

    const voz = page.getByRole("button", { name: /Activar guía por voz/i });
    await expect(voz).toBeVisible();
    await expect(voz).toHaveAttribute("aria-pressed", "false");

    await expect(page.locator("html")).toHaveAttribute("data-theme-preference", "system");
  });

  test("sólo el paso actual existe para el lector de pantalla", async ({ page }) => {
    /* El wizard anterior dejaba los cinco paneles montados y escondía los que
       no tocaban: si alguno se escapaba del `aria-hidden`, el lector anunciaba
       títulos de pasos que la persona no veía y el Tab caía en botones
       invisibles. El kiosco monta un paso por vez. Este test fija eso contando
       lo que expone el árbol de accesibilidad —no el DOM—: un paso escondido
       con opacidad o fuera de pantalla también cuenta, que es justamente el
       error que hay que atrapar. */
    await abrirKiosco(page);
    const main = page.locator("main");

    await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(main.getByRole("region")).toHaveCount(1);

    await avanzarAlPaso2(page);

    await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(main.getByRole("heading", { level: 1 })).toHaveText("¿Cómo preferís la clase?");
    await expect(main.getByRole("region")).toHaveCount(1);
  });

  test("el progreso dice en qué paso estás, también sin verlo", async ({ page }) => {
    /* Antes era una progressbar con botones adentro, y los hijos de una
       progressbar son presentacionales: los botones desaparecían para el
       lector. Ahora es una navegación con un botón por paso, y lo que importa
       es que el paso actual se ANUNCIE —el aviso en vivo— y esté MARCADO
       —`aria-current`—, porque el número resaltado sólo existe en el color. */
    await abrirKiosco(page);
    const progreso = page.getByRole("navigation", { name: "Progreso de la reserva" });

    await expect(progreso).toContainText("Paso 1 de 5: Materia");
    await expect(progreso.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(progreso.locator('[aria-current="step"]')).toContainText("Materia");

    await avanzarAlPaso2(page);

    await expect(progreso).toContainText("Paso 2 de 5: Modalidad");
    await expect(progreso.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(progreso.locator('[aria-current="step"]')).toContainText("Modalidad");
  });

  test("el panel de accesibilidad oscurece la página y agranda la letra", async ({ page }) => {
    /* Se mide el efecto, no sólo el atributo: un `data-theme="dark"` que no
       cambia ningún color, o un `data-font-scale` sin regla que lo lea, dejan
       el botón marcado y la página igual.
       El sistema en claro a propósito: el tema por defecto lo sigue, y hace
       falta partir de una página clara para ver que «Oscuro» la oscurece. */
    await page.emulateMedia({ colorScheme: "light" });
    await abrirKiosco(page);

    const medir = () =>
      page.evaluate(() => {
        const [r, g, b] = getComputedStyle(document.body)
          .backgroundColor.match(/\d+(\.\d+)?/g)
          .slice(0, 3)
          .map(Number);
        return {
          fondo: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
          letra: Number.parseFloat(getComputedStyle(document.documentElement).fontSize),
        };
      });
    const antes = await medir();

    await page.getByRole("button", { name: "Abrir panel de accesibilidad" }).click();
    const panel = page.getByRole("dialog", { name: /Ajusta la lectura/i });
    await expect(panel).toBeVisible();

    const oscuro = panel.getByRole("button", { name: "Oscuro" });
    const grande = panel.getByRole("button", { name: "Grande", exact: true });
    await oscuro.click();
    await grande.click();

    await expect(oscuro).toHaveAttribute("aria-pressed", "true");
    await expect(grande).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await expect.poll(async () => (await medir()).fondo).toBeLessThan(0.2);
    const despues = await medir();
    expect(antes.fondo).toBeGreaterThan(0.8);
    expect(despues.letra).toBeGreaterThan(antes.letra);
  });
});

test.describe("resiliencia y navegación", () => {
  test("la portada se muestra aunque el backend no responda", async ({ page }) => {
    /* Todas las rutas menos `/` esperan al health-check. La portada no: es lo
       primero que ve quien llega mientras Render despierta el backend, y no
       tiene nada que dependa de él. El cartel de mantenimiento ahí sería
       mentir que el sitio está caído. */
    await page.route("**/health", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
    );

    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1, name: /Entendé de verdad/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Los turnos vuelven en un rato")).toHaveCount(0);
  });

  test("al cambiar de página, el foco va al contenido principal", async ({ page }) => {
    /* En una SPA el navegador no mueve el foco al navegar: se queda en el link
       que se tocó, que ya no existe. El lector de pantalla no anuncia nada y el
       próximo Tab arranca desde el principio del documento.

       Se mide al VOLVER a la portada y no al entrar al kiosco: en desarrollo,
       StrictMode corre dos veces el efecto de montaje del kiosco y el foco
       termina en su título, así que ahí el test pasaría aunque `ScrollToTop`
       no hiciera nada. La portada no mueve el foco por su cuenta. */
    await instalarBackendFalso(page);
    await page.goto("/");
    await page.locator("main .hp-cta-main").first().click();
    await expect(page.getByRole("heading", { level: 1, name: TITULO_PASO_1 })).toBeVisible({
      timeout: 30_000,
    });

    await page.goBack();

    await expect(page.getByRole("heading", { level: 1, name: /Entendé de verdad/i })).toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();
  });
});

test.describe("el panel de administración en el teléfono", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("con letra muy grande, el botón de accesibilidad no tapa la navegación de abajo", async ({
    page,
  }) => {
    /* La barra de navegación del admin va fija abajo, y el botón flotante de
       accesibilidad también. Con la letra al máximo los dos crecen, y si el
       botón no se aparta tapa «Ajustes» justo a quien más lo necesita. */
    await page.addInitScript(() => {
      window.sessionStorage.setItem("adminToken", "e2e-token");
      window.localStorage.setItem(
        "ui_accessibility_preferences",
        JSON.stringify({ themePreference: "light", fontScale: "xlarge" }),
      );
    });
    await instalarBackendFalso(page);
    /* Por el path y no por glob: `**\/api/**` también atrapa los módulos de
       Vite en `/src/api/`, y la app no arranca. */
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, data: [] }),
        }),
    );

    await page.goto("/admin");
    await page.evaluate(() => {
      document.documentElement.style.setProperty("--safe-area-bottom", "24px");
    });
    const lanzador = page.getByRole("button", { name: "Abrir panel de accesibilidad" });
    const navegacion = page.locator(".admin-bottom-nav");
    await expect(navegacion).toBeVisible({ timeout: 30_000 });
    await expect(lanzador).toBeVisible();

    const [boton, barra] = await Promise.all([lanzador.boundingBox(), navegacion.boundingBox()]);
    expect(boton.y + boton.height).toBeLessThanOrEqual(barra.y - 8);
  });
});
