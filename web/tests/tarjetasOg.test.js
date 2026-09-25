import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { IMAGEN_ALTO, IMAGEN_ANCHO, META_POR_RUTA, SITIO } from "../src/data/meta.js";

/* CADA PÁGINA SE COMPARTE CON SU PROPIA TARJETA.
 *
 * Todas mostraban la misma imagen (el logo sobre blanco) al pasar un enlace por
 * WhatsApp. Las tarjetas salen de scripts/generar-tarjetas-og.mjs; esto cuida
 * que cada ruta declare la suya, que el archivo exista y que las medidas
 * declaradas sean las que piden las redes. */

test("cada ruta tiene su tarjeta y el archivo existe", () => {
  const vistas = new Set();
  for (const [ruta, meta] of Object.entries(META_POR_RUTA)) {
    assert.ok(meta.imagen, `${ruta} no declara imagen para compartir`);
    assert.ok(meta.imagen.startsWith(`${SITIO}/og/`), `${ruta}: la tarjeta tiene que ser absoluta y de /og/`);
    assert.ok(meta.imagen.endsWith(".jpg"), `${ruta}: JPEG, porque varios bots no leen WebP`);
    const archivo = new URL(`../public${meta.imagen.slice(SITIO.length)}`, import.meta.url);
    assert.ok(existsSync(archivo), `${ruta}: falta ${meta.imagen}`);
    assert.ok(!vistas.has(meta.imagen), `${ruta} repite la tarjeta de otra página`);
    vistas.add(meta.imagen);
  }
});

test("las medidas declaradas son las de las redes", () => {
  assert.equal(IMAGEN_ANCHO, 1200);
  assert.equal(IMAGEN_ALTO, 630);
});
