import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { comprobarServidor } from "../../src/utils/comprobarServidor.js";

/* EL CHEQUEO DEL SERVIDOR NO BLOQUEA NI SE RINDE ANTES DE TIEMPO.
 *
 * Antes: toda ruta menos la portada esperaba detrás de un cargador y, a los
 * 12 s, mostraba «mantenimiento». El backend vive en Render, que tarda de 30 a
 * 50 s en despertar: el cartel aparecía con el servidor sano.
 */

const respuesta = (ok) => ({ ok });
const sinPausa = { pausa: 0, tiempoPorIntento: 50, base: "https://api" };

test("si contesta bien, está vivo, y pregunta por /health", async () => {
  const pedidos = [];
  const pedir = async (url) => {
    pedidos.push(url);
    return respuesta(true);
  };
  assert.equal(await comprobarServidor({ ...sinPausa, pedir }), "ok");
  assert.deepEqual(pedidos, ["https://api/health"]);
});

test("un servidor que tarda en despertar NO se declara caído", async () => {
  /* Dos intentos fallan (Render arrancando), el tercero contesta. */
  let n = 0;
  const pedir = async () => {
    n += 1;
    if (n < 3) throw new Error("todavía durmiendo");
    return respuesta(true);
  };
  assert.equal(await comprobarServidor({ ...sinPausa, pedir }), "ok");
  assert.equal(n, 3);
});

test("sólo se declara caído si fallan todos los intentos", async () => {
  let n = 0;
  const pedir = async () => {
    n += 1;
    return respuesta(false);
  };
  assert.equal(await comprobarServidor({ ...sinPausa, pedir }), "caido");
  assert.equal(n, 3);
});

test("un intento que no contesta se corta por tiempo y se reintenta", async () => {
  let n = 0;
  const pedir = (url, { signal }) =>
    new Promise((resolver, rechazar) => {
      n += 1;
      if (n === 2) return resolver(respuesta(true));
      signal.addEventListener("abort", () => rechazar(new Error("tiempo agotado")));
    });
  assert.equal(await comprobarServidor({ ...sinPausa, pedir }), "ok");
  assert.equal(n, 2);
});

test("la app no bloquea las rutas mientras comprueba", () => {
  const app = readFileSync(new URL("../../src/App.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(app, /=== "loading"\) return <BrandLoader/, "volvió el cargador que bloqueaba las rutas");
  assert.match(app, /useEstadoDelServidor\(\)/);
  assert.match(app, /estadoDelServidor === "caido"\) return <MaintenancePage/);
});
