import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

/* TURNOS SIGUE EL TEMA DEL SISTEMA, DESDE LA PRIMERA PINTURA.
 *
 * El tema arrancaba siempre en claro —`themePreference: "light"` a mano—
 * aunque la opción «Sistema» existía en el panel de accesibilidad. Medido en el
 * navegador de Agustín: su sistema está en oscuro y el sitio se le servía
 * blanco.
 *
 * Cambiar el valor por defecto no alcanzaba, por dos motivos:
 *
 * 1. EL DESTELLO. React aplica el tema en un efecto, DESPUÉS de pintar. Con
 *    «Sistema», quien usa oscuro vería la página blanca un instante y después el
 *    salto a oscuro. La solución es un script en el <head> que fije el tema antes
 *    de la primera pintura: `public/tema.js`, sincrónico. En la plantilla
 *    (index.html) es un archivo; en el build, prerender.mjs lo pone en línea
 *    —como archivo costaba un viaje de red antes de pintar— y la CSP
 *    (`script-src 'self'`) lo autoriza por su hash. Lo cuida
 *    prerenderDeLaPortada.test.js.
 *
 * 2. LO QUE YA ESTABA GUARDADO. El código escribía las preferencias en
 *    `localStorage` en CADA visita, así que todo el que entró alguna vez tiene
 *    `"light"` guardado sin haberlo elegido nunca. Un `"light"` puesto por el
 *    sistema y uno elegido son indistinguibles. Se migra una vez: un `"light"`
 *    guardado SIN marca de versión se lee como «Sistema»; un `"dark"` sí se
 *    respeta, porque el valor por defecto nunca fue oscuro —si está, alguien lo
 *    eligió—. Desde ahora se guarda `version: 2`.
 */

const script = readFileSync(new URL("../../public/tema.js", import.meta.url), "utf8");

/* Ejecuta tema.js con un window falso y devuelve lo que dejó en <html>. */
const ejecutar = ({ guardado = {}, sistemaOscuro = false, storageRoto = false } = {}) => {
  const dataset = {};
  const storage = {
    getItem: (k) => {
      if (storageRoto) throw new Error("SecurityError");
      return k in guardado ? guardado[k] : null;
    },
  };
  const window = {
    localStorage: storage,
    matchMedia: (q) => ({ matches: q.includes("dark") ? sistemaOscuro : false }),
  };
  vm.runInNewContext(script, {
    window,
    localStorage: storage,
    matchMedia: window.matchMedia,
    document: { documentElement: { dataset, style: {} } },
  });
  return dataset;
};

const prefs = (obj) => ({ ui_accessibility_preferences: JSON.stringify(obj) });

test("sin nada guardado sigue al sistema", () => {
  assert.equal(ejecutar({ sistemaOscuro: true }).theme, "dark");
  assert.equal(ejecutar({ sistemaOscuro: false }).theme, "light");
  assert.equal(ejecutar({ sistemaOscuro: true }).themePreference, "system");
});

test("un «claro» guardado sin versión lo puso el sistema: se migra", () => {
  /* Es el caso de todos los que ya entraron alguna vez. */
  const d = ejecutar({ guardado: prefs({ themePreference: "light", fontScale: "default" }), sistemaOscuro: true });
  assert.equal(d.theme, "dark");
  assert.equal(d.themePreference, "system");
});

test("un «oscuro» guardado sin versión sí lo eligió alguien", () => {
  const d = ejecutar({ guardado: prefs({ themePreference: "dark" }), sistemaOscuro: false });
  assert.equal(d.theme, "dark");
  assert.equal(d.themePreference, "dark");
});

test("con versión 2, lo guardado se respeta tal cual", () => {
  const claro = ejecutar({ guardado: prefs({ themePreference: "light", version: 2 }), sistemaOscuro: true });
  assert.equal(claro.theme, "light", "si con versión dice claro, lo eligió la persona");
  const sistema = ejecutar({ guardado: prefs({ themePreference: "system", version: 2 }), sistemaOscuro: true });
  assert.equal(sistema.theme, "dark");
});

test("la clave vieja `theme` sola también se migra", () => {
  assert.equal(ejecutar({ guardado: { theme: "light" }, sistemaOscuro: true }).theme, "dark");
  assert.equal(ejecutar({ guardado: { theme: "dark" }, sistemaOscuro: false }).theme, "dark");
});

test("si el almacenamiento está bloqueado, igual sigue al sistema", () => {
  /* Navegación privada estricta o cookies bloqueadas: localStorage tira error.
     El script no puede romper la página; cae en el sistema. */
  assert.equal(ejecutar({ storageRoto: true, sistemaOscuro: true }).theme, "dark");
});

test("un valor guardado basura no rompe nada", () => {
  const d = ejecutar({ guardado: { ui_accessibility_preferences: "{no-es-json" }, sistemaOscuro: true });
  assert.equal(d.theme, "dark");
});

test("el script carga antes de la primera pintura (en la plantilla, desde un archivo)", () => {
  const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  const script = html.indexOf('<script src="/tema.js"></script>');
  assert.ok(script > 0, "index.html tiene que cargar /tema.js sincrónico: sin defer, sin async, sin type=module");
  assert.ok(script < html.indexOf("</head>"), "va en el <head>, antes de pintar el body");
});

test("React arranca con el mismo criterio que el script", () => {
  /* Si el script dijera «oscuro» y React arrancara en «claro», el efecto de
     React pisaría al script y volvería el destello. */
  const ctx = readFileSync(new URL("../../src/components/accessibility/UISettingsContext.jsx", import.meta.url), "utf8");
  assert.match(ctx, /themePreference:\s*"system"/);
  assert.match(ctx, /PREFERENCES_VERSION\s*=\s*2/);
});

test("preferencias sin tema válido caen a la clave vieja, igual que React", () => {
  /* Si el script y React decidieran distinto en este caso, React pisaría al
     script al montar y volvería el destello. */
  const d = ejecutar({ guardado: { ...prefs({ fontScale: "large", version: 2 }), theme: "dark" }, sistemaOscuro: false });
  assert.equal(d.theme, "dark");
});
