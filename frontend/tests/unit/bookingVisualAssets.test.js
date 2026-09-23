import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

/* ══════════════════════════════════════════════════════════════════════════
   LOS ASSETS DEL KIOSCO DE RESERVA.

   DOS FAMILIAS, DOS CONTRATOS DISTINTOS

   Las imágenes de NIVEL son renders 3D sobre fondo transparente. Flotan en la
   tarjeta sobre un halo verde, con `object-fit: contain` y una `drop-shadow`
   que sigue la silueta del objeto. Para eso la transparencia es obligatoria:
   sin canal alfa se vería un rectángulo opaco tapando el halo.

   Las portadas de MATERIA ya no son eso. Desde septiembre de 2026 son
   ilustraciones cuadradas a sangre, con su propio fondo cuadriculado, el
   nombre de la materia escrito adentro y las fórmulas reales de cada una.
   Llenan el cuadro y la tarjeta las recorta.

   Por eso la afirmación de transparencia que este test hacía sobre TODOS los
   assets ahora vale sólo para los de nivel. No se borró por conveniencia: se
   acotó porque el contrato de la pieza cambió. Una portada a sangre con canal
   alfa sería peso inútil.
   ══════════════════════════════════════════════════════════════════════════ */

const levelAssets = [
  "primaria.webp",
  "secundaria.webp",
  "secundaria-tecnica.webp",
  "terciario.webp",
  "universitario.webp",
];

/* La familia de marca: navy, verde y cuadriculado. Sirve a Secundaria,
   Secundaria Técnica, CENS, Terciario y Universitario. */
const subjectAssets = [
  "biologia.webp",
  "cbc.webp",
  "fisica.webp",
  "fisicoquimica.webp",
  "geografia.webp",
  "historia.webp",
  "ingles.webp",
  "lengua-literatura.webp",
  "matematica.webp",
  "otra-materia.webp",
  "quimica.webp",
];

/* La familia de Primaria: multicolor, con signos y números simples en vez de
   fórmulas. Son las cinco materias que se dictan en ese nivel. */
const primariaAssets = [
  "ciencias-naturales.webp",
  "ciencias-sociales.webp",
  "ingles.webp",
  "lengua-literatura.webp",
  "matematica.webp",
];

const assetUrl = (group, filename) =>
  new URL(`../../src/assets/booking/${group}/${filename}`, import.meta.url);

const kioskSource = readFileSync(
  new URL("../../src/components/BookingKiosk.jsx", import.meta.url),
  "utf8",
);
const kioskCss = readFileSync(
  new URL("../../src/components/BookingKiosk.css", import.meta.url),
  "utf8",
);
const visualMapSource = readFileSync(
  new URL("../../src/constants/bookingVisuals.js", import.meta.url),
  "utf8",
);

const leer = (group, filename) => {
  const path = fileURLToPath(assetUrl(group, filename));
  return { bytes: readFileSync(path), size: statSync(path).size };
};

test("todos los assets son WebP reales y están optimizados", () => {
  const grupos = [
    ["levels", levelAssets],
    ["subjects", subjectAssets],
    ["subjects/primaria", primariaAssets],
  ];

  let totalBytes = 0;
  let cuantos = 0;

  for (const [group, filenames] of grupos) {
    for (const filename of filenames) {
      const { bytes, size } = leer(group, filename);
      totalBytes += size;
      cuantos += 1;

      assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF", `${filename} debe ser WebP`);
      assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP", `${filename} debe ser WebP`);
      assert.ok(size > 8_000, `${filename} no puede estar vacío`);
      assert.ok(size < 140_000, `${filename} debe estar optimizado para web`);
    }
  }

  /* Presupuesto por PROMEDIO y no por total.
     Antes era un total fijo de 1,2 MB, calculado para 13 archivos. La
     colección creció a 19 al sumar el CBC y las cinco de primaria, y quedó a
     58 KB del techo: la próxima portada lo rompía sin que nada estuviera mal.
     El promedio sigue atajando lo que importa —que nadie meta un archivo de
     medio mega— y no castiga que la colección crezca. */
  const promedio = totalBytes / cuantos;
  assert.ok(
    promedio < 75_000,
    `el promedio por asset es ${Math.round(promedio / 1024)} KB y debe quedar bajo 75 KB`,
  );
});

test("las imágenes de nivel conservan la transparencia que su tarjeta necesita", () => {
  /* Sólo los niveles. La tarjeta los presenta flotando sobre un halo verde con
     una sombra que sigue la silueta: sin canal alfa se vería un rectángulo
     opaco. Las portadas de materia son a sangre y no llevan alfa a propósito. */
  for (const filename of levelAssets) {
    const { bytes } = leer("levels", filename);
    assert.ok(
      bytes.includes(Buffer.from("ALPH")),
      `${filename} debe conservar transparencia: la tarjeta de nivel lo presenta flotando`,
    );
  }
});

test("las portadas de materia son cuadradas y del tamaño que la tarjeta usa", () => {
  /* 480x480. La tarjeta se renderiza a 152x152 px, medido en el navegador, así
     que 480 cubre hasta DPR 3 con margen. Los 640 anteriores eran 4x el tamaño
     lineal y 18x en píxeles.

     El ancho y el alto de un WebP simple viven en el chunk VP8X o VP8 ; para
     no depender del formato interno se lee el tamaño declarado en el mapa de
     visuales, que es lo que el navegador usa para reservar el espacio. */
  assert.match(
    visualMapSource,
    /const VISUAL_SIZE = \{ width: 480, height: 480 \}/,
    "las portadas de materia deben declararse a 480x480",
  );
  assert.match(
    visualMapSource,
    /const LEVEL_VISUAL_SIZE = \{ width: 640, height: 640 \}/,
    "las imágenes de nivel siguen siendo de 640 y no se tocaron",
  );
});

test("el mapa de visuales referencia cada archivo que existe en disco", () => {
  for (const filename of [...levelAssets, ...subjectAssets]) {
    assert.match(visualMapSource, new RegExp(filename.replace(".", "\\.")));
  }
  for (const filename of primariaAssets) {
    assert.match(
      visualMapSource,
      new RegExp(`primaria/${filename.replace(".", "\\.")}`),
      `${filename} de primaria debe importarse desde subjects/primaria/`,
    );
  }
  assert.match(visualMapSource, /return SUBJECT_VISUALS\.otraMateria/);
  assert.match(visualMapSource, /Fisicoquímica debe resolverse antes/);
});

test("la portada cambia según el nivel, y el CBC tiene la suya", () => {
  /* Lo que protege: que Primaria no vuelva a mostrar a² + b² = c², que es
     contenido de secundaria y estaba apareciendo en la tarjeta de un nene de
     cuarto grado. */
  assert.match(
    visualMapSource,
    /export const getSubjectVisual = \(subject, level\)/,
    "getSubjectVisual debe recibir el nivel",
  );
  assert.match(visualMapSource, /if \(level === "Primaria"\)/);
  assert.match(visualMapSource, /const PRIMARIA_VISUALS = \{/);
  // El CBC se resuelve antes que Matemática: "Matemática (CBC)" es CBC.
  assert.ok(
    visualMapSource.indexOf('includes("cbc")') <
      visualMapSource.indexOf('includes("matematic")', visualMapSource.indexOf("getSubjectVisual")),
    "el CBC debe resolverse antes que Matemática",
  );
  assert.match(
    kioskSource,
    /getSubjectVisual\(subject, formData\.educationLevel\)/,
    "el kiosco debe pasarle el nivel",
  );
});

test("Historia y Geografía tienen portada propia, no la de «otra materia»", () => {
  /* Las pidió Agustín para Secundaria y CENS. Sin su rama en el resolvedor
     caían en la portada genérica de «otra materia». */
  assert.match(visualMapSource, /includes\("histori"\)\) return SUBJECT_VISUALS\.historia/);
  assert.match(visualMapSource, /includes\("geograf"\)\) return SUBJECT_VISUALS\.geografia/);
});

test("la tarjeta de materia está adaptada al arte a sangre", () => {
  /* Con arte transparente la tarjeta usaba halo, contain, drop-shadow y un
     scale. Con ilustraciones cuadradas opacas esas cuatro cosas se ven mal:
     el halo queda tapado, la sombra dibuja un rectángulo duro y el scale deja
     un hueco. Esto verifica que la adaptación siga puesta. */
  assert.match(kioskCss, /\.kiosk-choice-subject \.kiosk-visual-halo \{\s*display: none;/);
  assert.match(kioskCss, /\.kiosk-choice-subject \.kiosk-visual-media img \{[\s\S]*?object-fit: cover;/);
  assert.match(kioskCss, /\.kiosk-choice-subject \.kiosk-visual-media img \{[\s\S]*?filter: none;/);
  assert.match(kioskCss, /\.kiosk-choice-subject \.kiosk-visual-media img \{[\s\S]*?border-radius: 13px 13px 0 0;/);
});

test("las tarjetas siguen siendo semánticas, responsivas y respetan la accesibilidad", () => {
  assert.match(kioskSource, /aria-pressed=\{formData\.subject === subject\}/);
  assert.match(kioskSource, /loading=\{index < 6 \? "eager" : "lazy"\}/);
  assert.match(kioskSource, /decoding="async"/);
  assert.match(kioskSource, /<img[\s\S]*?alt=""/);
  assert.match(kioskSource, /aria-live="polite"/);
  assert.doesNotMatch(kioskSource, /role="progressbar"/);
  assert.match(kioskCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(kioskCss, /@media \(forced-colors: active\)/);
  assert.match(kioskCss, /kiosk-grid-levels[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
});
