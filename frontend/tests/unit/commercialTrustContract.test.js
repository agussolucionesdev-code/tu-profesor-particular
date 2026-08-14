import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isConfiguredSocialUrl } from "../../src/utils/socialUrl.js";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

/* Quita comentarios de bloque y de línea. Sirve para las aserciones que prohíben algo:
   sin esto, explicar en un comentario qué se dejó de usar hace fallar el test que
   verifica que ya no se usa. */
const sinComentarios = (fuente) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const navbarSource = readSource("../../src/layouts/Navbar.jsx");
const footerSource = readSource("../../src/layouts/Footer.jsx");
const homeSource = readSource("../../src/pages/HomePage.jsx");
const kioskSource = readSource("../../src/components/BookingKiosk.jsx");
const kioskConstants = readSource("../../src/constants/kioskWizard.js");
const channelsSource = readSource("../../src/constants/contactChannels.js");
const precioSource = readSource("../../src/utils/precio.js");

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
  /* El filtro se movió de Footer.jsx a constants/contactChannels.js con el rediseño del
     pie. La DECISIÓN que este test protege no cambió —no se publica un enlace a una red
     sin perfil— así que se afirma en su ubicación nueva en lugar de borrar la
     protección. */
  assert.match(
    channelsSource,
    /PERFILES\.filter\(\(perfil\)\s*=>\s*isConfiguredSocialUrl\(perfil\.href\)\)/,
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

test("keeps public profile URLs in code, not in environment variables", () => {
  /* Las URLs de los perfiles se leían de `import.meta.env.VITE_INSTAGRAM_URL` y
     compañía. No son secretos —son perfiles públicos— y lo único que aportaba esa
     indirección era una forma de equivocarse invisible. Se materializó: producción
     estuvo apuntando a `instagram.com/agustinsosa.profe`, que no es el perfil de
     Agustín. No falló el build, no falló ningún test y no hubo aviso, porque el valor
     vivía en un panel que nadie mira en un code review.

     Este test es el que hace que un perfil equivocado sea un diff que alguien lee. */
  /* Se afirma sobre el CÓDIGO, no sobre los comentarios. Ambos archivos explican en
     prosa de qué variable de entorno venían estas URLs, y una aserción sobre el texto
     crudo fallaba por la explicación misma: castigaba documentar el motivo del cambio,
     que es justo lo que queremos que quede escrito. */
  assert.doesNotMatch(sinComentarios(channelsSource), /import\.meta\.env/);
  assert.doesNotMatch(sinComentarios(footerSource), /import\.meta\.env/);

  // El perfil real, verificado con Agustín.
  assert.match(channelsSource, /https:\/\/www\.instagram\.com\/tuprofesor\.ar\//);
  assert.doesNotMatch(channelsSource, /agustinsosa\.profe["']/);
});

test("keeps one source of truth for the WhatsApp number", () => {
  /* El número estaba escrito a mano en 7 archivos de este proyecto. La última vez que
     cambió hubo que tocarlos todos, y alcanzaba con olvidarse de uno para dejar un
     teléfono viejo en producción. El pie ahora lo lee de la constante. */
  assert.doesNotMatch(footerSource, /wa\.me\/\d/);
  assert.match(footerSource, /waLink\(/);
  assert.match(channelsSource, /WHATSAPP_NUMBER = "5491133365937"/);
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
  /* Precio honesto: se muestra un estimado SÓLO si hay tarifa publicada; nunca "$0" ni
     un precio inventado. La comprobación se movió de `pricePerHour > 0 && ...` en el
     kiosco a `utils/precio.js`, que ahora es dueño de la regla y lo hace con `null` en
     lugar de con un string vacío. La DECISIÓN es la misma, así que se afirma en su
     ubicación nueva en lugar de borrar la protección. */
  assert.match(precioSource, /numero > 0 \? numero : null/);
  assert.match(kioskSource, /\{priceLabel &&/);
  // Y el bloque del paso 3 sólo existe cuando hay desglose.
  assert.match(kioskSource, /\{precio && \(/);
  assert.match(kioskSource, /\{!precio && \(/);
});

test("shows the price before asking for personal data", () => {
  /* El estimado vivía SÓLO en el paso 5, o sea después de entregar nombre, teléfono,
     email, año, curso y objetivo. El dato que más pesa para decidir llegaba último,
     cuando la persona ya había invertido cuatro pasos.

     Un costo que aparece al final no genera un reclamo: genera una pestaña cerrada, y
     deja la sensación de que estaba escondido. Este test fija que el bloque de precio
     aparezca ANTES del paso de datos. */
  const posPrecio = kioskSource.indexOf('className="kiosk-precio"');
  const posDatos = kioskSource.indexOf("kiosk-s4-title");
  assert.ok(posPrecio > -1, "falta el bloque de precio en el kiosco");
  assert.ok(
    posPrecio < posDatos,
    "el precio quedó después del paso de datos personales",
  );
});
