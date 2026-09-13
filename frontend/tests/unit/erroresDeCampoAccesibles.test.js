import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), "utf8");

/* Quita comentarios de bloque y de línea. Las aserciones que prohíben algo fallan
   si el texto prohibido sobrevive dentro del comentario que explica por qué se
   dejó de usar. */
const sinComentarios = (fuente) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const kioskSource = readSource("../../src/components/BookingKiosk.jsx");
const kioskCss = readSource("../../src/components/BookingKiosk.css");
const wizardHook = readSource("../../src/hooks/useBookingWizard.js");

/* Por qué existe este archivo.
   Un barrido del paso 4 en producción encontró que un campo obligatorio vacío se
   avisaba SÓLO con un borde rojo más un toast que decía «revisá los campos
   resaltados». "Resaltado" es información que existe únicamente en el color:
   quien no lo distingue escucha el toast y no tiene manera de saber cuáles son
   (WCAG 1.4.1), y el motivo nunca se escribe en ningún lado (WCAG 3.3.1).

   Las cuatro piezas que lo arreglan son fáciles de sacar sin querer en un
   refactor del formulario, porque ninguna se ve mirando la pantalla con ojos que
   funcionan. Por eso están acá. */

test("cada campo obligatorio del paso 4 dice su error en texto, no sólo en rojo", () => {
  const camposObligatorios = [
    "studentName",
    "phone",
    "yearGrade",
    "responsibleName",
    "responsibleRelationship",
    "objective",
  ];

  for (const campo of camposObligatorios) {
    assert.match(
      kioskSource,
      /* Admite un segundo argumento: el id de la ayuda del campo, que también se
         cuelga de aria-describedby. */
      new RegExp(`propsDeError\\("${campo}"[,)]`),
      `${campo} tiene que recibir aria-invalid y aria-describedby vía propsDeError`,
    );
    assert.match(
      kioskSource,
      new RegExp(`mensajeDeError\\("${campo}"\\)`),
      `${campo} tiene que renderizar su motivo en texto vía mensajeDeError`,
    );
  }
});

test("el motivo sale del hook y llega marcado como alerta", () => {
  assert.match(wizardHook, /const getFieldError = useCallback\(/);
  assert.match(wizardHook, /getFieldError,/, "el hook tiene que exportarlo");
  /* El texto se cuelga de aria-describedby y se anuncia al aparecer. Comparte el
     atributo con la ayuda del campo, si la tiene: primero la ayuda y después el
     error, que es el orden en que se leen en pantalla. */
  assert.match(kioskSource, /const errorId = erroresDeCampo\[campo\] \? `kiosk-err-\$\{campo\}` : null;/);
  assert.match(kioskSource, /\[ayudaId, errorId\]\.filter\(Boolean\)\.join\(" "\)/);
  assert.match(kioskSource, /"aria-invalid": true/);
  assert.match(kioskSource, /id=\{`kiosk-err-\$\{campo\}`\}[\s\S]{0,80}role="alert"/);
});

test("el aviso general no manda a mirar colores", () => {
  /* «Revisá los campos resaltados» le pide a la persona que use una información
     que puede no estar recibiendo. El texto tiene que mandarla a LEER. */
  assert.doesNotMatch(sinComentarios(kioskSource), /campos resaltados/i);
});

test("el foco va al primer campo que falla, después del re-render", () => {
  assert.match(kioskSource, /setIntentosFallidos\(\(n\) => n \+ 1\)/);
  assert.match(
    kioskSource,
    /useEffect\(\(\) => \{\s*if \(!intentosFallidos\) return;\s*cardRef\.current\?\.querySelector\('\[aria-invalid="true"\]'\)\?\.focus\(\);/,
    "buscar el campo fuera de un efecto lo busca antes de que el re-render lo pinte",
  );
});

test("el mensaje de error se puede leer", () => {
  assert.match(kioskCss, /\.kiosk-field-error \{/);
  /* Un mensaje de error por debajo de 0.85rem no es un mensaje de error. */
  const bloque = kioskCss.match(/\.kiosk-field-error \{[^}]*\}/)[0];
  assert.match(bloque, /font-size: 0\.8[5-9]rem|font-size: 0\.9\d*rem|font-size: 1/);
  assert.match(bloque, /color: var\(--error-color\)/);
});
