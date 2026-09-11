import { expect, test } from "@playwright/test";
import { instalarBackendFalso } from "./_backendFalso.js";

/* WCAG 2.5.5 — Target Size: 44×44 CSS px como mínimo para cualquier control.
 *
 * Este proyecto ya pagó el precio de no medirlo: el botón «Abrir menú» llegó a
 * producción con 14px de ancho porque era un flex item y el contenedor lo
 * encogía pese a tener un `width` fijo. Un `width` que un flex container puede
 * ignorar no es una garantía, y eso no se ve mirando la pantalla en un monitor.
 *
 * DOS EXCEPCIONES, ambas legítimas, y ambas descubiertas midiendo:
 *
 *  · Enlaces en línea dentro de un bloque de texto. WCAG los exime
 *    explícitamente ("Inline: The target is in a sentence or block of text").
 *    Sin esta excepción el informe se llena de fallas que no lo son: en el
 *    inicio del sitio institucional eran tres, del tipo "Escribime y lo vemos
 *    juntos" dentro de un párrafo.
 *
 *  · Lo que cuelga de un ancestro con `aria-hidden="true"`. El honeypot del
 *    formulario de contacto mide 223×32 y aparece en cualquier consulta por
 *    controles enfocables, pero vive en un contenedor `aria-hidden` a
 *    `left: -9999px` y con `tabindex="-1"`. Mirar el `aria-hidden` sólo en el
 *    elemento y no en sus ancestros lo convierte en una falla inventada.
 */

const RUTAS = ["/", "/reservar", "/portal"];
const MINIMO = 44;

const CONTROLES =
  'a[href],button,input,select,textarea,[role="button"],[role="link"],[tabindex]:not([tabindex="-1"])';

const medirChicos = ([minimo, selector]) => {
  const enProsa = (el) => {
    const p = el.parentElement;
    if (!p) return false;
    const texto = [...p.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join("");
    return texto.length > 12;
  };

  const chicos = [];
  for (const el of document.querySelectorAll(selector)) {
    if (el.closest('.sr-only, [aria-hidden="true"]')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.height >= minimo && r.width >= minimo) continue;
    if (el.tagName === "A" && enProsa(el)) continue;
    chicos.push({
      txt: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 34),
      cls: String(el.className).slice(0, 34),
      tag: el.tagName,
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  }
  return chicos;
};

const informe = (chicos) =>
  chicos.map((c) => `  ${c.w}×${c.h} — <${c.tag.toLowerCase()} class="${c.cls}"> "${c.txt}"`).join("\n");

test.describe.configure({ mode: "serial" });

/* Sin esto, todo lo que no sea `/` mide la pantalla de mantenimiento —que no
   tiene fallas— y el spec pasa por no haber mirado la página real. */
test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

for (const ruta of RUTAS) {
  test(`blancos táctiles de 44px en ${ruta} (375px)`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(ruta);
    await expect(page.locator("main")).toBeVisible();

    await page.addStyleTag({
      content: `*{transition:none!important;animation:none!important}
        [data-reveal],[data-reveal-group],.reveal{opacity:1!important;visibility:visible!important;transform:none!important}`,
    });
    await page.waitForTimeout(400);

    const chicos = await page.evaluate(medirChicos, [MINIMO, CONTROLES]);

    expect(chicos.length, chicos.length ? `\n\n${informe(chicos)}\n` : "").toBe(0);
  });
}
