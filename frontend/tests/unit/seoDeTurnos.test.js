import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

const robots = leer("../../public/robots.txt");
const sitemap = leer("../../public/sitemap.xml");
const notFound = leer("../../src/components/errors/NotFoundPage.jsx");
const metaHook = leer("../../src/hooks/useDocumentTitle.js");
const serverError = leer("../../src/components/errors/ServerErrorPage.jsx");
const maintenance = leer("../../src/components/errors/MaintenancePage.jsx");
const jsonLd = leer("../../src/components/seo/JsonLd.jsx");

const vercel = JSON.parse(leer("../../vercel.json"));

const HOST = "https://turnos.tuprofesorparticular.com.ar";

test("el robots.txt de turnos apunta a SU sitemap, no al del institucional", () => {
  /* Apuntaba a https://tuprofesorparticular.com.ar/sitemap.xml. Un buscador que
     entraba por este host se llevaba la lista de URLs del OTRO dominio y no
     descubría nunca las de turnos. */
  assert.match(robots, new RegExp(`Sitemap:\\s*${HOST}/sitemap\\.xml`));
  assert.doesNotMatch(
    robots,
    /Sitemap:\s*https:\/\/tuprofesorparticular\.com\.ar/,
    "ese es el sitemap del sitio institucional, no el de turnos",
  );
});

test("el robots.txt no ofrece a indexar lo que no es contenido", () => {
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, /^Disallow: \/m$/m);
});

test("el sitemap sólo lista URLs de este host", () => {
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, "el sitemap quedó vacío");
  for (const loc of locs) {
    assert.ok(loc.startsWith(HOST), `${loc} no pertenece a este host`);
  }
  // Lo que está en Disallow no puede estar a la vez en el sitemap.
  for (const prohibida of [`${HOST}/admin`, `${HOST}/m`]) {
    assert.ok(!locs.includes(prohibida), `${prohibida} está en Disallow`);
  }
});

test("el 404 no se deja indexar", () => {
  /* El catch-all de vercel.json responde 200 en cualquier ruta desconocida, así
     que sin esto un buscador puede indexar una URL rota como página del sitio.
     El porqué de resolverlo acá y no en el routing está en useDocumentTitle.js. */
  assert.match(notFound, /noindex:\s*true/);
  assert.match(metaHook, /content",\s*"noindex, follow"/);
  /* `follow` y no `nofollow`: la página no se indexa, pero los enlaces que
     ofrece —volver a reservar, ver mis turnos— sí se siguen. */
  assert.doesNotMatch(metaHook, /"noindex, nofollow"/);
});

test("el noindex se retira al salir del 404", () => {
  /* LA PARTE PELIGROSA. El `meta[name=robots]` vive en el <head>, que es global:
     si el efecto no lo limpia al desmontar, alcanza con que alguien entre una vez
     a una URL rota y navegue al inicio para que TODO el sitio quede sirviéndose
     con noindex mientras dure esa pestaña. Un buscador que pase en ese momento
     ve un sitio entero pidiendo no ser indexado.

     Verificado en el navegador: el meta existe en /ruta-que-no-existe y ya no
     está en /reservar ni en /. Este test cuida que el cleanup no se borre. */
  assert.match(
    metaHook,
    /setRobots\(noindex\);\s*return \(\) => \{\s*setRobots\(false\);/,
    "sin el cleanup, el noindex del 404 se queda pegado al resto del sitio",
  );
  // Y que setRobots(false) efectivamente saque el tag en vez de dejarlo vacío.
  assert.match(metaHook, /if \(!noindex\) \{\s*tag\?\.remove\(\);/);
});

test("las páginas de error están escritas en castellano y de vos", () => {
  const copy = [notFound, serverError, maintenance].join("\n");
  for (const falta of [
    /\bpagina\b/i,
    /\bsalio\b/i,
    /\bVolve\b/,
    /\bIntenta de nuevo\b/,
  ]) {
    assert.doesNotMatch(copy, falta, `falta de ortografía o tuteo: ${falta}`);
  }
  // Y que el voseo esté puesto, no sólo ausente el tuteo.
  assert.match(serverError, /Intentá de nuevo/);
  assert.match(maintenance, /Volvé en unos minutos/);
});

test("el JSON-LD que lee Google está bien escrito", () => {
  /* Esto es lo que un buscador puede llegar a mostrar como descripción del
     negocio. "matematica, fisica, quimica" sin tildes se lee como descuido. */
  for (const falta of [/matematica/i, /fisica/i, /quimica/i, /confirmacion/i, /Agustin /]) {
    assert.doesNotMatch(jsonLd, falta, `el JSON-LD tiene: ${falta}`);
  }
  assert.match(jsonLd, /Agustín Elías Sosa/);
});

test("www.turnos redirige al host real, y ningún redirect toca al host principal", () => {
  /* `www.turnos.tuprofesorparticular.com.ar` no existía en el DNS —NXDOMAIN—, así
     que ni siquiera llegaba a fallar el TLS como le pasaba a `www.` del apex:
     directamente no resolvía. Se agregó el CNAME a cname.vercel-dns.com en
     DonWeb y el dominio al proyecto en Vercel; esto es la última pieza.

     Nadie tipea un `www.` delante de un subdominio, así que esto no arregla un
     problema frecuente: cierra una puerta que estaba abierta y no llevaba a
     ningún lado. */
  const redirect = (vercel.redirects ?? []).find((r) =>
    (r.has ?? []).some(
      (c) =>
        c.type === "host" &&
        c.value === "www.turnos.tuprofesorparticular.com.ar",
    ),
  );
  assert.ok(redirect, "falta el redirect de www.turnos");
  assert.equal(redirect.destination, `${HOST}/$1`);
  assert.equal(redirect.permanent, true, "tiene que ser 308, no 307");

  /* LA PARTE QUE IMPORTA. Un redirect sin condición de host se aplicaría también
     a turnos.tuprofesorparticular.com.ar y lo dejaría redirigiéndose a sí mismo:
     la app de reservas entera en un bucle. */
  for (const r of vercel.redirects ?? []) {
    assert.ok(
      (r.has ?? []).length > 0,
      `el redirect ${r.source} no tiene condición de host: tumbaría el sitio`,
    );
  }
});

test("el título y la descripción por defecto están bien escritos", () => {
  for (const falta of [/Agustin Elias/, /matematica/i, /confirmacion/i]) {
    assert.doesNotMatch(metaHook, falta);
  }
});
