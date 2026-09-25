import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

import { BOOKING_RESERVE_URL, enlaceDeReserva } from "../src/data/site.js";

/* TODO BOTÓN DE RESERVAR DICE DE DÓNDE VIENE.
 *
 * El sitio y turnos son dos proyectos de Vercel: sin los `utm_*` no había forma
 * de saber qué botón trae las reservas (el navegador sólo manda el dominio como
 * referencia). */

test("arma la URL de la reserva con el origen y, si la hay, la materia", () => {
  const url = new URL(enlaceDeReserva("materia", { materia: "Matemática" }));
  assert.equal(`${url.origin}${url.pathname}`, BOOKING_RESERVE_URL);
  assert.equal(url.searchParams.get("materia"), "Matemática");
  assert.equal(url.searchParams.get("utm_source"), "sitio");
  assert.equal(url.searchParams.get("utm_content"), "materia");
  assert.equal(new URL(enlaceDeReserva("barra")).searchParams.get("materia"), null);
});

test("ningún componente arma el enlace a mano", () => {
  const raiz = new URL("../src/", import.meta.url);
  const aMano = readdirSync(raiz, { recursive: true, encoding: "utf8" })
    .filter((r) => r.endsWith(".jsx"))
    .filter((r) => /href=\{BOOKING_RESERVE_URL|\$\{BOOKING_RESERVE_URL\}/.test(readFileSync(new URL(r, raiz), "utf8")));
  assert.deepEqual(aMano, [], "usá enlaceDeReserva(origen) para que el origen quede registrado");
});
