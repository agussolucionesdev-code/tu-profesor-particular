import { expect, test } from "@playwright/test";
import { TEMAS, conTema } from "./_comun.js";

/* LA BARRA DE VIDRIO: QUE ENTRE, QUE SE LEA Y QUE EL BOTÓN DE TEMA RECUERDE.
 *
 * Todo lo que acá se prueba se encontró midiendo a mano mientras se diseñaba:
 * desbordes de 19 a 120 px en cinco anchos, un panel pegado al borde por usar
 * 100vw, y el vidrio claro que sobre la portada azul bajaba el subtítulo de la
 * marca a ~3,5:1. El medidor de contraste no ve ese último caso —compone contra
 * el fondo de la página, no contra lo que pasa por detrás del vidrio—, así que
 * acá se mide sobre los píxeles reales de una captura.
 */

const ANCHOS = [1440, 1280, 1100, 1024, 768, 600, 430, 390, 375, 360, 340, 320];

test.describe("desborde", () => {
  test.skip(({ isMobile }) => isMobile, "los anchos se recorren desde escritorio");

  for (const ancho of ANCHOS) {
    test(`a ${ancho}px nada sale de la isla ni de la pantalla`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto("/sobre-mi", { waitUntil: "networkidle" });
      const r = await page.evaluate(() => {
        const isla = document.querySelector(".snav-capsule").getBoundingClientRect();
        const piezas = [...document.querySelectorAll(".snav-capsule > *, .snav-actions > *, .snav-links > li")]
          .filter((e) => e.offsetParent && getComputedStyle(e.closest(".snav-right") || e).position !== "fixed");
        const derecha = Math.max(...piezas.map((e) => e.getBoundingClientRect().right));
        return { sobra: Math.round(derecha - isla.right), scroll: document.documentElement.scrollWidth - innerWidth };
      });
      expect(r.sobra, "algo de la barra sale de la isla").toBeLessThanOrEqual(0);
      expect(r.scroll, "la página tiene scroll horizontal").toBeLessThanOrEqual(0);
    });
  }
});

test.describe("menú del celular", () => {
  test.skip(({ isMobile }) => !isMobile, "sólo existe en el celular");

  test("abre, deja tocar cada opción y cierra con Escape devolviendo el foco", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const boton = page.getByRole("button", { name: "Abrir menú" });
    await boton.click();
    const menu = page.locator("#snav-menu");
    await expect(menu).toBeVisible();
    for (const nombre of ["Inicio", "Sobre mí", "Materias", "Cómo trabajo", "Contacto"]) {
      await expect(menu.getByRole("link", { name: nombre })).toBeVisible();
    }
    await expect(menu.getByRole("button", { name: /Cambiar a modo/ })).toBeVisible();
    /* El panel no se pega al borde: el margen de la isla de los dos lados. */
    const caja = await menu.boundingBox();
    const ancho = page.viewportSize().width;
    expect(caja.x).toBeGreaterThanOrEqual(8);
    expect(ancho - (caja.x + caja.width)).toBeGreaterThanOrEqual(8);

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Abrir menú" })).toBeFocused();
  });
});

test("el botón de tema cambia, se recuerda y el tema está puesto antes de pintar", async ({ page, isMobile }) => {
  test.skip(isMobile, "en el celular el botón vive dentro del menú; se prueba en escritorio");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Cambiar a modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Cambiar a modo claro" })).toBeVisible();

  /* Al recargar, el tema ya está puesto cuando aparece el <body>: sin destello. */
  await page.addInitScript(() => {
    new MutationObserver((_, obs) => {
      if (document.body) {
        window.__temaAlPintar = document.documentElement.dataset.theme;
        obs.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload({ waitUntil: "networkidle" });
  expect(await page.evaluate(() => window.__temaAlPintar)).toBe("dark");
});

/* Contraste del texto de la barra contra lo que REALMENTE hay detrás del
   vidrio: la portada es azul también en modo claro. */
for (const tema of TEMAS) {
  test(`el texto de la barra se lee sobre la portada azul (${tema})`, async ({ page }) => {
    await conTema(page, tema);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "*{transition:none!important;animation:none!important}" });

    const cajas = await page.evaluate(() =>
      [...document.querySelectorAll(".snav-brand-name, .snav-brand-person, .snav-link:not(.is-active)")]
        .filter((e) => e.offsetParent && getComputedStyle(e.closest(".snav-right") || e).position !== "fixed")
        .map((e) => {
          const r = e.getBoundingClientRect();
          const [cr, cg, cb] = getComputedStyle(e).color.match(/[\d.]+/g).map(Number);
          return { clase: e.className, x: r.x, y: r.y, w: r.width, h: r.height, color: [cr, cg, cb] };
        }),
    );
    expect(cajas.length).toBeGreaterThan(0);

    /* Se esconde el texto y se fotografía lo que queda detrás: vidrio + portada. */
    await page.addStyleTag({ content: ".snav-capsule *{color:transparent!important}.snav-capsule svg,.snav-capsule img{visibility:hidden!important}" });
    const captura = (await page.screenshot({ clip: { x: 0, y: 0, width: page.viewportSize().width, height: 110 } })).toString("base64");

    const peor = await page.evaluate(
      async ({ png, cajas }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const lienzo = document.createElement("canvas");
        lienzo.width = img.width;
        lienzo.height = img.height;
        const ctx = lienzo.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const escala = img.width / window.innerWidth;
        const lum = ([r, g, b]) => {
          const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const ratio = (a, b) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
          return (x + 0.05) / (y + 0.05);
        };
        let minimo = { ratio: 99 };
        for (const c of cajas) {
          for (let i = 1; i < 6; i++) {
            for (let j = 1; j < 4; j++) {
              const px = ctx.getImageData(Math.round((c.x + (c.w * i) / 6) * escala), Math.round((c.y + (c.h * j) / 4) * escala), 1, 1).data;
              const r = ratio(c.color, [px[0], px[1], px[2]]);
              if (r < minimo.ratio) minimo = { ratio: r, clase: c.clase };
            }
          }
        }
        return minimo;
      },
      { png: captura, cajas },
    );
    expect(peor.ratio, `«${peor.clase}» da ${peor.ratio.toFixed(2)}:1 sobre el vidrio`).toBeGreaterThanOrEqual(4.5);
  });
}
