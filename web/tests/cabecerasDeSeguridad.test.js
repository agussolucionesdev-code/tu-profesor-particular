import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

const vercel = JSON.parse(leer("../vercel.json"));
const contactForm = leer("../src/components/ContactForm.jsx");

const cabecerasGlobales = () => {
  const bloque = vercel.headers.find((h) => h.source === "/(.*)");
  assert.ok(bloque, "falta el bloque de cabeceras que aplica a todo el sitio");
  return Object.fromEntries(bloque.headers.map((h) => [h.key, h.value]));
};

/* Por qué existe este archivo.
   Medido contra producción: el sitio institucional servía una sola cabecera de
   seguridad —la HSTS que pone Vercel— mientras la app de turnos, en el mismo
   proyecto y con el mismo público, servía seis. La asimetría no era una decisión:
   turnos las tenía desde su primer deploy y acá nunca se agregaron.

   Un CSP es fácil de romper sin que se note en el momento: el sitio sigue
   cargando y lo que falla es una petición suelta. Por eso, además de exigir que
   estén, este archivo ata el `connect-src` al backend al que el formulario de
   contacto realmente postea. */

test("el institucional sirve las mismas cabeceras de seguridad que turnos", () => {
  const h = cabecerasGlobales();
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(h["Permissions-Policy"], /camera=\(\)/);
  assert.ok(h["Content-Security-Policy"], "falta el Content-Security-Policy");
});

test("el CSP deja pasar el POST del formulario de contacto", () => {
  const csp = cabecerasGlobales()["Content-Security-Policy"];
  const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] ?? "";

  /* El backend al que postea el formulario, leído de su propio código: si algún
     día se muda, este test falla antes de que el formulario deje de andar en
     producción sin que nadie se entere. */
  const backend = contactForm.match(/"(https:\/\/[a-z0-9.-]+\.onrender\.com)"/)?.[1];
  assert.ok(backend, "no pude leer el backend desde ContactForm.jsx");
  assert.ok(
    connectSrc.includes(backend),
    `connect-src no permite ${backend}: el formulario de contacto va a fallar`,
  );
});

test("el CSP no afloja lo que no hace falta aflojar", () => {
  const csp = cabecerasGlobales()["Content-Security-Policy"];
  /* Las fuentes son self-hosted (@fontsource-variable) y no hay un solo iframe
     en el sitio, así que no hay motivo para permitir scripts de terceros. */
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(csp, /script-src[^;]*'unsafe-eval'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /base-uri 'self'/);
});

test("el rewrite sigue dejando pasar /_vercel", () => {
  /* Mismo motivo que en turnos: un catch-all que se come /_vercel deja la
     analítica sin poder cargar su script, y la petición devuelve 200 así que
     nadie lo nota. */
  const catchAll = vercel.rewrites.at(-1);
  const atrapa = (ruta) => new RegExp(`^${catchAll.source}$`).test(ruta);
  assert.equal(atrapa("/_vercel/insights/script.js"), false);
  assert.equal(atrapa("/_vercel/speed-insights/script.js"), false);
  assert.equal(atrapa("/sobre-mi"), true);
  assert.equal(atrapa("/contacto"), true);
});
