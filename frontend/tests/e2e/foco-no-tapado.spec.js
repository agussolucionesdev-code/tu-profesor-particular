import { expect, test } from "@playwright/test";

import { instalarBackendFalso } from "./_backendFalso.js";

/* WCAG 2.4.11 (AA): EL FOCO NO QUEDA TAPADO POR LA BARRA FIJA.
 *
 * Cuando alguien retrocede con Shift+Tab, el navegador desplaza lo justo para
 * que el elemento entre por arriba: lo deja pegado al borde superior, que es
 * justo donde está la barra fija. Sin `scroll-padding-top`, el elemento con foco
 * queda debajo de la barra, y quien navega con teclado no ve dónde está.
 *
 * El barrido recorre TODOS los elementos enfocables de cada página, de abajo
 * hacia arriba, y mide cuánto de cada uno queda debajo de la barra.
 *
 * `scroll-behavior: smooth` vuelve asíncrono todo desplazamiento: sin apagarlo,
 * `focus()` no mueve nada en el momento de medir y el barrido da cero sin haber
 * medido. Por eso se apaga. La cantidad de desplazamientos queda anotada en
 * cada test: una página que entra entera en la pantalla no se desplaza y su
 * cero es legítimo; una que es larga y da cero desplazamientos no midió nada.
 */

const barrer = () =>
  document.fonts.ready.then(() => {
    document.documentElement.style.scrollBehavior = "auto";
    const fijos = [...document.querySelectorAll("body *")].filter((n) => {
      const s = getComputedStyle(n);
      const b = n.getBoundingClientRect();
      return (
        (s.position === "fixed" || s.position === "sticky") &&
        b.top < 20 && b.height > 30 && b.height < 200 && b.width > 200
      );
    });
    /* Lo que tapa es lo que se VE, no la caja de posicionamiento. En turnos el
       <nav> fijo es un riel transparente de 0 a 105px; la cápsula visible,
       adentro, termina en 87. Medir el riel daba elementos «tapados» por aire.
       Se toma el elemento con fondo o desenfoque más grande dentro de cada fijo. */
    const pinta = (n) => {
      const s = getComputedStyle(n);
      return (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent") || s.backdropFilter !== "none";
    };
    const area = (n) => { const b = n.getBoundingClientRect(); return b.width * b.height; };
    const barra = fijos
      .flatMap((f) => [f, ...f.querySelectorAll("*")])
      .filter((n) => pinta(n) && n.getBoundingClientRect().top < 30 && n.getBoundingClientRect().width > 200)
      .sort((a, b) => area(b) - area(a))[0];
    if (!barra) return { sinBarra: true };

    const enfocables = [...document.querySelectorAll("a[href], button, input, select, textarea, summary")].filter(
      (e) => e.offsetParent && !fijos.some((f) => f.contains(e)) && !e.closest("[role=dialog], [aria-hidden=true]"),
    );
    window.scrollTo(0, document.documentElement.scrollHeight);
    let desplazamientos = 0;
    const tapados = [];
    for (const e of enfocables.reverse()) {
      const antes = window.scrollY;
      e.focus();
      if (document.activeElement !== e) continue;
      if (window.scrollY !== antes) desplazamientos += 1;
      const nb = barra.getBoundingClientRect();
      const b = e.getBoundingClientRect();
      const encima = Math.min(b.bottom, nb.bottom) - Math.max(b.top, nb.top);
      if (encima > 0 && b.left < nb.right && b.right > nb.left) {
        tapados.push(`${(e.innerText || e.getAttribute("aria-label") || e.tagName).trim().replace(/\s+/g, " ").slice(0, 40)} (${Math.round(encima)}px)`);
      }
    }
    document.documentElement.style.scrollBehavior = "";
    return { desplazamientos, enfocables: enfocables.length, tapados };
  });

test.beforeEach(async ({ page }) => {
  await instalarBackendFalso(page);
});

for (const ruta of ["/", "/portal", "/reservar"]) {
  test(`${ruta}: ningún elemento con foco queda debajo de la barra`, async ({ page }) => {
    await page.goto(ruta);
    await expect(page.locator("main")).toBeVisible({ timeout: 20_000 });
    await page.waitForLoadState("networkidle");
    const r = await page.evaluate(barrer);
    const alta = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 1.5);
    if (alta) expect(r.desplazamientos, "página larga sin desplazamientos: no midió").toBeGreaterThan(0);
    expect(r.sinBarra, "la página tiene que tener su barra fija").toBeUndefined();
    expect(r.enfocables, "el barrido tiene que encontrar elementos").toBeGreaterThan(0);
    expect(r.tapados).toEqual([]);
    test.info().annotations.push({ type: "barrido", description: `${r.enfocables} enfocables, ${r.desplazamientos} desplazamientos` });
  });
}
