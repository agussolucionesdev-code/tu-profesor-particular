import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isConfiguredSocialUrl } from "../../src/utils/socialUrl.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

const navbarSource = readSource("../../src/layouts/Navbar.jsx");
const footerSource = readSource("../../src/layouts/Footer.jsx");
const homeSource = readSource("../../src/pages/HomePage.jsx");
const kioskSource = readSource("../../src/components/BookingKiosk.jsx");
const kioskConstants = readSource("../../src/constants/kioskWizard.js");

test("offers an explicit home destination and makes the brand return home", () => {
  assert.match(navbarSource, /title:\s*"Inicio",\s*path:\s*"\/"/);
  assert.match(navbarSource, /<Link\s+to="\/"\s+className="navbar-brand"/);
});

test("does not advertise the already-live principal website as upcoming", () => {
  assert.doesNotMatch(homeSource, /Próximamente:/i);
  assert.match(homeSource, /Sitio principal:/i);
});

test("renders only explicitly configured social profiles", () => {
  assert.doesNotMatch(footerSource, /\|\|\s*"https:\/\/(instagram|facebook|linkedin)\.com"/);
  assert.match(
    footerSource,
    /SOCIAL_LINKS\.filter\(\(item\)\s*=>[\s\S]*?isConfiguredSocialUrl\(item\.href\)/,
  );

  for (const href of [
    undefined,
    "",
    "not-a-url",
    "javascript:alert(1)",
    "https://facebook.com",
    "https://www.facebook.com/",
    "https://instagram.com?campaign=footer",
    "https://linkedin.com/#social",
  ]) {
    assert.equal(isConfiguredSocialUrl(href), false, `${href} must stay hidden`);
  }

  for (const href of [
    "https://facebook.com/tu-profesor-particular",
    "https://www.instagram.com/tu_profesor_particular/",
    "https://linkedin.com/in/agustin-sosa",
  ]) {
    assert.equal(isConfiguredSocialUrl(href), true, `${href} must stay visible`);
  }
});

test("states one consistent online and in-person offer", () => {
  assert.match(homeSource, /Clases online y presenciales/i);
  // La oferta online/presencial ahora es un paso del kiosco, con la ubicación
  // presencial explícita.
  assert.match(kioskConstants, /value: "online"/);
  assert.match(kioskConstants, /value: "presencial"/);
  assert.match(kioskConstants, /Temperley/i);
});

test("uses the secure management access and an honest unpublished-price state", () => {
  assert.match(homeSource, /enlace seguro/i);
  assert.doesNotMatch(homeSource, /Todo desde el portal con tu código/i);
  // Precio honesto: el kiosco muestra un estimado SOLO si hay precio publicado
  // (pricePerHour > 0); nunca renderiza "$0" ni un precio inventado.
  assert.match(kioskSource, /pricePerHour > 0 && formData\.duration/);
  assert.match(kioskSource, /\{priceLabel &&/);
});
