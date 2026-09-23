/* Medidores compartidos por los specs de contraste y de modo oscuro. */

/* Contraste de texto, medido en el navegador real.
 *
 * POR QUÉ NO LO HACE AXE. Sobre estas mismas páginas, axe devuelve la regla
 * `color-contrast` como **incomplete** en 68 elementos: "background color could
 * not be determined due to a background gradient" y "…because it is overlapped
 * by another element". Los `incomplete` no entran en `violations`, así que con
 * la regla activa el escaneo informaba "0 violaciones" sin haber podido medir.
 * Comprobado: con el día del calendario a 3.91:1 —una falla real— axe pasaba.
 *
 * Este medidor compone las capas a mano y por eso ve lo que axe no ve. Lleva
 * ocho guardas, y cada una existe porque su ausencia produjo alguna vez un
 * resultado falso en ESTE repo:
 *
 *  1. `data-reveal` vive en `opacity: 0` hasta que el IntersectionObserver
 *     dispara. Sin revelarlo, el subárbol entero se descarta y el barrido
 *     informa "0 fallas" habiendo medido cero elementos.
 *  2. Acumular TODAS las capas translúcidas hasta la raíz. Parar en la primera
 *     "bastante opaca" convirtió un 8.10 real en un 1.30 inventado.
 *  3. Forzar un reflow después de inyectar el kill-switch de transiciones: con
 *     la pestaña en segundo plano, el fondo se lee con el tema anterior.
 *  4. `checkVisibility` puede no existir; sin fallback explícito se saltea todo.
 *  5. `color(srgb 1 1 1 / .95)` viene en 0–1, no en 0–255. Un parser ingenuo lee
 *     el blanco como casi negro e inventa violaciones a mansalva.
 *  6. `background-clip: text` no es un fondo real.
 *  7. El texto translúcido se compone sobre su propio fondo antes de medirlo.
 *  8. Forzar `opacity` en los DESCENDIENTES de `[data-reveal]` también revela
 *     acordeones que se abren en `:hover` y los mide contra el fondo del estado
 *     cerrado. Eso produjo 36 fallas falsas de un saque. Se fuerza sólo en los
 *     portadores del atributo.
 */


export const MEDIDOR = () => {
  const P = (c) => {
    if (!c || c === "transparent") return [0, 0, 0, 0];
    if (/^color\(\s*srgb/i.test(c)) {
      const n = (c.match(/[\d.]+/g) || []).map(Number);
      return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1]; // guarda 5
    }
    const n = (c.match(/[\d.]+/g) || []).map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] ?? 1];
  };
  const fondo = (el) => {
    const capas = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      // guarda 6
      if (cs.backgroundClip !== "text" && cs.webkitBackgroundClip !== "text") {
        const b = P(cs.backgroundColor);
        if (b[3] > 0) capas.push(b); // guarda 2: se acumulan todas
      }
      n = n.parentElement;
    }
    capas.push([255, 255, 255, 1]);
    let r = capas[capas.length - 1].slice(0, 3);
    for (let i = capas.length - 2; i >= 0; i--) {
      const [a, b, c, d] = capas[i];
      r = [a * d + r[0] * (1 - d), b * d + r[1] * (1 - d), c * d + r[2] * (1 - d)];
    }
    return r;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const visible = (el) => {
    // guarda 4
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    }
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    let n = el.parentElement;
    while (n) {
      const p = getComputedStyle(n);
      if (p.display === "none" || p.visibility === "hidden" || parseFloat(p.opacity) === 0) return false;
      n = n.parentElement;
    }
    return true;
  };

  const fallas = [];
  let medidos = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest('.sr-only, [aria-hidden="true"]')) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    if (!visible(el)) continue;
    const rc = el.getBoundingClientRect();
    if (!rc.width || !rc.height) continue;
    const cs = getComputedStyle(el);
    const fg = P(cs.color);
    if (fg[3] === 0) continue;
    const bg = fondo(el);
    const a = fg[3]; // guarda 7
    const fc = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
    const px = parseFloat(cs.fontSize);
    const peso = parseInt(cs.fontWeight) || 400;
    // WCAG 1.4.3: 3:1 para ≥24px o ≥18.66px en negrita; 4.5:1 para el resto.
    const minimo = px >= 24 || (px >= 18.66 && peso >= 700) ? 3 : 4.5;
    const r = ratio(fc, bg);
    medidos++;
    if (r < minimo - 0.005) {
      fallas.push({
        txt: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
        cls: String(el.className).slice(0, 36),
        color: cs.color,
        fondo: `rgb(${bg.map(Math.round).join(",")})`,
        px: Math.round(px),
        ratio: +r.toFixed(2),
        minimo,
      });
    }
  }
  return { medidos, fallas };
};

export const prepararYMedir = async (page) => {
  // guardas 1, 3 y 8
  await page.addStyleTag({
    content: `*{transition:none!important;animation:none!important}
      [data-reveal],[data-reveal-group],.reveal{opacity:1!important;visibility:visible!important;transform:none!important;clip-path:none!important}
      [data-reveal] *,[data-reveal-group] *{visibility:visible!important;transform:none!important;clip-path:none!important}`,
  });
  await page.evaluate(() => void document.body.offsetHeight);
  await page.waitForTimeout(400);
  return page.evaluate(MEDIDOR);
};

export const informe = (fallas) =>
  fallas
    .map((f) => `  ${f.ratio}:1 (mínimo ${f.minimo}) — "${f.txt}"\n      .${f.cls} · ${f.px}px · ${f.color} sobre ${f.fondo}`)
    .join("\n");


/* MANCHAS CLARAS EN MODO OSCURO.
 *
 * El contraste de texto no alcanza para ver el problema que reportó Agustín:
 * un recuadro claro en medio de la página oscura. A veces su texto también
 * falla (blanco sobre menta), pero la mancha es un defecto aunque el texto se
 * lea: rompe el tema.
 *
 * Se marca todo elemento visible cuyo PROPIO fondo, compuesto sobre lo que
 * tiene detrás, es claro (luminancia > 0,4). Se admiten a propósito los
 * controles chicos: en oscuro el botón principal es verde claro con tinta
 * oscura, por diseño. Un control grande y claro sí es una mancha.
 */
export const MANCHAS = () => {
  const P = (c) => {
    if (!c || c === "transparent") return [0, 0, 0, 0];
    const n = (c.match(/[\d.]+/g) || []).map(Number);
    if (/^color\(\s*srgb/i.test(c)) return [n[0] * 255, n[1] * 255, n[2] * 255, n[3] ?? 1];
    return [n[0] || 0, n[1] || 0, n[2] || 0, n[3] ?? 1];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const detras = (el) => {
    const capas = [];
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const b = P(getComputedStyle(n).backgroundColor);
      if (b[3] > 0) capas.push(b);
    }
    capas.push([0, 0, 0, 1]);
    let r = capas[capas.length - 1].slice(0, 3);
    for (let i = capas.length - 2; i >= 0; i--) {
      const [a, b, c, d] = capas[i];
      r = [a * d + r[0] * (1 - d), b * d + r[1] * (1 - d), c * d + r[2] * (1 - d)];
    }
    return r;
  };
  const CONTROL = "button, a, [role=button], [role=option], [role=tab], [role=switch], input, select, textarea, summary, label";
  /* Los pares sólidos (botón verde, píldora navy) se INVIERTEN en oscuro a
     propósito: fondo claro con tinta oscura. Un distintivo chico con esos
     colores —el día elegido, el paso actual, el sello UBA— es el diseño, no
     una mancha. Su texto igual pasa por el medidor de contraste. */
  const aRgb = (valor) => {
    const t = document.createElement("i");
    t.style.color = valor;
    document.body.append(t);
    const c = getComputedStyle(t).color;
    t.remove();
    return c;
  };
  const raiz = getComputedStyle(document.documentElement);
  const PARES = new Set(["--cta-solid-bg", "--navy-solid-bg"].map((v) => aRgb(raiz.getPropertyValue(v).trim())));
  const manchas = [];
  let medidos = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (/^(IMG|SVG|PICTURE|VIDEO|CANVAS|PATH|IFRAME)$/i.test(el.tagName)) continue;
    const cs = getComputedStyle(el);
    const b = P(cs.backgroundColor);
    if (b[3] < 0.35) continue;
    const vis = typeof el.checkVisibility === "function"
      ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      : cs.display !== "none" && cs.visibility !== "hidden";
    if (!vis) continue;
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < 400 || Math.min(r.width, r.height) < 6) continue;
    medidos++;
    const bajo = detras(el);
    const compuesto = [0, 1, 2].map((i) => b[i] * b[3] + bajo[i] * (1 - b[3]));
    if (lum(compuesto) <= 0.4) continue;
    const esControl = el.matches(CONTROL) || el.closest(CONTROL) !== null;
    if (esControl && area < 40_000) continue;
    if ((area < 12_000 || r.height <= 64) && PARES.has(cs.backgroundColor)) continue;
    manchas.push({
      cls: `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join(".")}`.slice(0, 50),
      txt: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 40),
      fondo: cs.backgroundColor,
      px: `${Math.round(r.width)}×${Math.round(r.height)}`,
    });
  }
  return { medidos, manchas };
};

export const informeManchas = (manchas) =>
  manchas.map((m) => `  ${m.cls} (${m.px}) fondo ${m.fondo} — "${m.txt}"`).join("\n");
