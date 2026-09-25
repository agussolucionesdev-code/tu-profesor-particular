import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const apiClientSource = await readFile(
  new URL("../../src/api/apiClient.js", import.meta.url),
  "utf8",
);
const vercelConfig = JSON.parse(
  await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
);

test("Vercel deployments use their own origin as the API base", () => {
  assert.match(apiClientSource, /hostname\?\.endsWith\("\.vercel\.app"\)/);
  assert.match(
    apiClientSource,
    /const API_BASE = isVercelDeployment\s*\? globalThis\.location\.origin/,
  );
});

test("Vercel proxies health and API requests before the SPA fallback", () => {
  assert.deepEqual(vercelConfig.rewrites.slice(0, 2), [
    {
      source: "/health",
      destination:
        "https://tu-profesor-particular-backend.onrender.com/health",
    },
    {
      source: "/api/(.*)",
      destination: "/api/preview-proxy?__proxy_path=$1",
    },
  ]);
  /* app.html y no index.html: el index.html ya trae la portada dibujada
     (prerender.mjs), y /reservar la mostraría un instante antes de su paso 1. */
  assert.equal(vercelConfig.rewrites.at(-1).destination, "/app.html");
});

/* EL CATCH-ALL NO SE PUEDE COMER /_vercel.
 *
 * La analítica de Vercel se sirve desde `/_vercel/insights/script.js`. Con el
 * catch-all anterior —`/(.*)` → `/index.html`— el navegador pedía el script y
 * recibía el index.html de la SPA con content-type `text/html`, así que lo
 * rechazaba: «Refused to execute script … MIME type is not executable».
 *
 * La petición devolvía 200, y por eso nadie lo notó: la analítica que se instaló
 * en la etapa 2 estuvo meses sin registrar un solo dato en los dos dominios.
 *
 * Este test existe porque el arreglo NO se puede verificar de otra forma antes
 * de mergear: los deployments de preview de este equipo están detrás del login
 * de Vercel, así que pedir el script ahí devuelve la pantalla de autenticación
 * en lugar del script. Lo único comprobable sin desplegar es el patrón.
 */

const catchAll = vercelConfig.rewrites.at(-1);

/* Reproduce cómo Vercel evalúa el `source`: lo ancla a toda la ruta.
   No usa path-to-regexp para no depender de una librería que la app no tiene;
   el patrón acá ya es una expresión regular pura. */
const atrapa = (ruta) => new RegExp(`^${catchAll.source}$`).test(ruta);

test("el catch-all deja pasar /_vercel y sigue atrapando las rutas de la SPA", () => {
  // Lo que NO tiene que atrapar: si lo atrapa, la analítica no funciona.
  for (const ruta of [
    "/_vercel/insights/script.js",
    "/_vercel/speed-insights/script.js",
    "/_vercel/insights/view",
  ]) {
    assert.equal(atrapa(ruta), false, `el catch-all se está comiendo ${ruta}`);
  }

  // Y lo que SÍ: excluir de más dejaría la SPA sin rutas.
  for (const ruta of ["/", "/reservar", "/portal", "/admin", "/m", "/lo-que-sea"]) {
    assert.equal(atrapa(ruta), true, `el catch-all dejó de atrapar ${ruta}`);
  }
});

test("el lookahead va envuelto en un grupo de captura", () => {
  /* Requisito de path-to-regexp, documentado por Vercel: `/(?!_vercel).*` sin el
     grupo es un patrón inválido y el deploy falla. La diferencia es un paréntesis
     y no se ve leyendo por encima. */
  assert.match(catchAll.source, /^\/\(\(\?!_vercel\)\.\*\)$/);
});
