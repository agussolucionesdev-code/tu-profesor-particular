import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const portalSource = await readFile(
  new URL("../../src/components/ClientPortal.jsx", import.meta.url),
  "utf8",
);
const apiSource = await readFile(
  new URL("../../src/api/bookingApi.js", import.meta.url),
  "utf8",
);

test("portal access asks for code plus contact", () => {
  assert.match(portalSource, /Email o teléfono cargado/);
  assert.match(portalSource, /onEntrar\(codigo, contactoLimpio\)/);
  assert.match(portalSource, /createPortalSession\(codigo, contacto\)/);
});

test("portal session API sends both access fields", () => {
  assert.match(
    apiSource,
    /createPortalSession = \(bookingCode, contact\)[\s\S]*\{ bookingCode, contact \}/,
  );
});

test("portal does not persist the management token in browser storage", () => {
  assert.doesNotMatch(portalSource, /(?:localStorage|sessionStorage)\.setItem/);
});
