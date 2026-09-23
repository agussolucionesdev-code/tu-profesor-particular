import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SOCIAL_PROFILES, SOCIAL_PROFILES_PROXIMOS } from "../../src/constants/contactChannels.js";

/* LAS TRES REDES EN EL PIE: INSTAGRAM, LINKEDIN Y FACEBOOK.
 *
 * Agustín las pidió las tres. La página de Facebook se va a llamar «Tu Profesor
 * Particular» pero todavía no existe, y una URL inventada puede terminar en la
 * página de un desconocido si ese nombre de usuario lo tiene otro. Entonces
 * Facebook se muestra con su logo oficial y «Próximamente», sin enlace, hasta
 * que haya una URL real. */

const pie = readFileSync(new URL("../../src/layouts/Footer.jsx", import.meta.url), "utf8");

test("el pie muestra las tres redes", () => {
  const ids = [...SOCIAL_PROFILES, ...SOCIAL_PROFILES_PROXIMOS].map((p) => p.id).sort();
  assert.deepEqual(ids, ["facebook", "instagram", "linkedin"]);
  assert.match(pie, /SOCIAL_PROFILES_PROXIMOS\.map\(/, "el pie no pinta las redes que están por venir");
});

test("una red sin URL no es un enlace", () => {
  for (const p of SOCIAL_PROFILES_PROXIMOS) assert.equal(p.href, undefined, `${p.id} no debería tener href`);
  /* El bloque de las próximas no puede tener un <a>. */
  const bloque = pie.slice(pie.indexOf("SOCIAL_PROFILES_PROXIMOS.map("), pie.indexOf("SOCIAL_PROFILES_PROXIMOS.map(") + 900);
  assert.doesNotMatch(bloque, /<a\b/);
  assert.match(bloque, /Próximamente/);
});

test("cuando Facebook tenga URL, deja de estar entre las próximas", () => {
  /* Una sola fuente: si se carga la URL en PERFILES, la de «próximamente» se
     retira sola y no aparecen dos Facebook. */
  const configuradas = new Set(SOCIAL_PROFILES.map((p) => p.id));
  for (const p of SOCIAL_PROFILES_PROXIMOS) assert.ok(!configuradas.has(p.id));
});
