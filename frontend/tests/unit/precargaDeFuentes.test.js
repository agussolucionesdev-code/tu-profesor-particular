import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { enlacesDePrecarga } from "../../precargaDeFuentes.js";

/* La precarga de fuentes encuentra los archivos con hash y falla fuerte si no.
 * El porqué está en precargaDeFuentes.js. */

const BUILD = [
  "assets/index-Cg3al9FJ.js",
  "assets/fraunces-latin-opsz-normal-DihXLNYH.woff2",
  "assets/fraunces-latin-ext-opsz-normal-AbCd1234.woff2",
  "assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
  "assets/inter-cyrillic-wght-normal-Zz9.woff2",
];

test("precarga sólo las dos latinas del primer pliegue", () => {
  const hrefs = enlacesDePrecarga(BUILD).map((t) => t.attrs.href);
  assert.deepEqual(hrefs, [
    "/assets/fraunces-latin-opsz-normal-DihXLNYH.woff2",
    "/assets/inter-latin-wght-normal-Dx4kXJAl.woff2",
  ]);
});

test("cada enlace es un preload de fuente válido (con crossorigin, o se baja dos veces)", () => {
  for (const { tag, attrs } of enlacesDePrecarga(BUILD)) {
    assert.equal(tag, "link");
    assert.equal(attrs.rel, "preload");
    assert.equal(attrs.as, "font");
    assert.equal(attrs.type, "font/woff2");
    assert.ok("crossorigin" in attrs);
  }
});

test("si la fuente no está en el build, falla en vez de precargar la nada", () => {
  assert.throws(() => enlacesDePrecarga(["assets/index.js"]), /no encontré/);
});

test("el plugin está enchufado en vite.config", () => {
  const config = readFileSync(new URL("../../vite.config.js", import.meta.url), "utf8");
  assert.match(config, /precargaDeFuentes\(\)/);
});
