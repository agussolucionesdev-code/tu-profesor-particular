import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const levelAssets = [
  "primaria.webp",
  "secundaria.webp",
  "secundaria-tecnica.webp",
  "terciario.webp",
  "universitario.webp",
];

const subjectAssets = [
  "biologia.webp",
  "fisica.webp",
  "fisicoquimica.webp",
  "ingles.webp",
  "lengua-literatura.webp",
  "matematica.webp",
  "otra-materia.webp",
  "quimica.webp",
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

test("ships the complete optimized 3D booking collection", () => {
  let totalBytes = 0;

  for (const [group, filenames] of [
    ["levels", levelAssets],
    ["subjects", subjectAssets],
  ]) {
    for (const filename of filenames) {
      const url = assetUrl(group, filename);
      const path = fileURLToPath(url);
      const bytes = readFileSync(path);
      const size = statSync(path).size;

      totalBytes += size;
      assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
      assert.ok(bytes.includes(Buffer.from("ALPH")), `${filename} debe conservar transparencia`);
      assert.ok(size > 8_000, `${filename} no puede estar vacío`);
      assert.ok(size < 140_000, `${filename} debe estar optimizado para web`);
    }
  }

  assert.ok(totalBytes < 1_200_000, "la colección completa debe pesar menos de 1,2 MB");
});

test("maps configured levels and subjects to resilient visual fallbacks", () => {
  for (const filename of [...levelAssets, ...subjectAssets]) {
    assert.match(visualMapSource, new RegExp(filename.replace(".", "\\.")));
  }
  assert.match(visualMapSource, /return SUBJECT_VISUALS\.otraMateria/);
  assert.match(visualMapSource, /Fisicoquímica debe resolverse antes/);
});

test("keeps visual cards semantic, responsive and motion-safe", () => {
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
