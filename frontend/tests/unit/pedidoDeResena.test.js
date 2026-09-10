import assert from "node:assert/strict";
import test from "node:test";
import {
  URL_RESENA_GOOGLE,
  enlaceDePedidoDeResena,
  hayCanalDeResenaPublico,
  mensajeDePedidoDeResena,
} from "../../src/constants/pedidoDeResena.js";

/* EL MENSAJE CON EL QUE SE PIDEN LAS RESEÑAS.
 *
 * De todo lo que se construyó para la etapa 6 —la sección del sitio, el endpoint,
 * la pantalla del panel—, esta es la única pieza que decide si funciona. Lo demás
 * puede estar perfecto: si el mensaje suena a plantilla, nadie contesta y la
 * sección de testimonios queda vacía para siempre.
 *
 * Por eso los tests de acá no comprueban que "el texto exista": comprueban las
 * cuatro decisiones de escritura que lo hacen convertir, que son justamente las
 * que se pierden la primera vez que alguien lo "mejora" con apuro.
 */

const datosMadre = {
  nombreContacto: "Carolina Álvarez",
  nombreAlumno: "Tomás Álvarez",
  esResponsable: true,
  materias: ["Matemática"],
};

test("saluda por el nombre de pila de quien lo recibe", () => {
  /* Un mensaje que nombra el caso concreto no se puede confundir con un envío
     masivo. Y no serlo no alcanza: tiene que no parecerlo. */
  assert.match(mensajeDePedidoDeResena(datosMadre), /^Hola Carolina, ¿cómo va\?/);
});

test("a la madre le habla del hijo; al alumno adulto, de él", () => {
  /* Misma regla que gobierna el wizard de reserva: quien LEE es quien recibe. Si
     le escribe a la madre en segunda persona sobre "tus clases", el mensaje delata
     que lo armó un sistema que no sabe con quién habla. */
  assert.match(mensajeDePedidoDeResena(datosMadre), /con Tomás/);

  const adulto = mensajeDePedidoDeResena({
    nombreContacto: "Juan Pérez",
    nombreAlumno: "Juan Pérez",
    esResponsable: false,
    materias: ["Física"],
  });
  assert.match(adulto, /juntos/);
  assert.doesNotMatch(adulto, /con Juan/);
});

test("pide un favor CHICO Y CONCRETO, no «una reseña»", () => {
  /* «¿Me dejarías una reseña?» le pasa a la otra persona el problema de decidir
     qué escribir, y esa fricción es donde muere la mayoría de los pedidos. */
  const mensaje = mensajeDePedidoDeResena(datosMadre);
  assert.match(mensaje, /dos o tres renglones/i);
  assert.match(mensaje, /antes de que empezáramos/i);
  assert.match(mensaje, /cómo están ahora/i);
  assert.match(mensaje, /no hace falta nada largo/i);
});

test("da la salida antes de que la pidan", () => {
  /* Sacar la obligación de encima sube la tasa de respuesta en vez de bajarla, y
     además es lo único coherente con el resto del sitio: el tipo que avisa cuándo
     no puede ayudarte no puede presionar por una reseña. */
  assert.match(
    mensajeDePedidoDeResena(datosMadre),
    /si no tenés ganas o no es el momento, no pasa absolutamente nada/i,
  );
});

test("pide el permiso de publicar Y el del nombre, por separado", () => {
  /* El permiso es obligatorio para publicar (`web/src/data/prueba.js` rechaza un
     testimonio sin él). Si no se pide acá, hay que escribir un segundo mensaje —y
     ese segundo mensaje es el que no manda nadie.
     Van separados porque autorizar el texto NO es autorizar el nombre. */
  const mensaje = mensajeDePedidoDeResena(datosMadre);
  assert.match(mensaje, /publicarlo en la página tal cual/i);
  assert.match(mensaje, /aparezca tu nombre o preferís que no/i);
});

test("no ofrece nada a cambio", () => {
  /* Una reseña comprada no es una reseña, en varias plataformas es motivo de baja,
     y lo último que necesita este proyecto es prueba social con un precio atrás. */
  const mensaje = mensajeDePedidoDeResena(datosMadre).toLocaleLowerCase("es-AR");
  for (const prohibido of ["descuento", "gratis", "regalo", "bonific", "a cambio", "sorteo"]) {
    assert.ok(!mensaje.includes(prohibido), `"${prohibido}" convierte el favor en una compra`);
  }
});

test("no tiene ninguna marca de plantilla", () => {
  /* Las tres frases que cualquiera reconoce al instante como mensaje automático.
     Cada una anula el trabajo de las otras cuatro decisiones. */
  const mensaje = mensajeDePedidoDeResena(datosMadre).toLocaleLowerCase("es-AR");
  for (const marca of [
    "5 estrellas",
    "cinco estrellas",
    "ayudanos a crecer",
    "te lleva un minuto",
    "significa mucho para nosotros",
    "estimado",
  ]) {
    assert.ok(!mensaje.includes(marca), `"${marca}" delata una plantilla`);
  }
});

test("funciona sin datos: no deja «Hola undefined»", () => {
  /* Un candidato sin nombre cargado no puede producir un mensaje roto que se
     mande igual. El saludo cae a la versión sin nombre. */
  const mensaje = mensajeDePedidoDeResena();
  assert.match(mensaje, /^Hola, ¿cómo va\?/);
  assert.doesNotMatch(mensaje, /undefined|null|NaN/);
});

test("nombra la materia cuando se sabe, y no inventa cuando no", () => {
  assert.match(mensajeDePedidoDeResena(datosMadre), /con matemática/i);
  assert.doesNotMatch(
    mensajeDePedidoDeResena({ ...datosMadre, materias: [] }),
    /\bcon\s+antes de/i,
  );
});

test("hoy pide que contesten por WhatsApp, porque no hay perfil de Google", () => {
  /* NO es un provisorio perezoso. Las primeras reseñas conviene recibirlas por el
     canal donde la persona ya está: contestar un WhatsApp cuesta cero, y abrir
     Google, iniciar sesión y escribir una reseña cuesta bastante más.
     El día que exista el perfil, se pega la URL en la constante y el mensaje
     cambia solo — este test fija que ese cambio esté cableado. */
  assert.equal(URL_RESENA_GOOGLE, null);
  assert.equal(hayCanalDeResenaPublico(), false);
  assert.match(mensajeDePedidoDeResena(datosMadre), /me lo contestes por acá/i);
});

test("el enlace de WhatsApp apunta al teléfono del candidato y lleva el texto", () => {
  const enlace = enlaceDePedidoDeResena({ telefonoDigits: "541122223333", ...datosMadre });

  assert.ok(enlace.startsWith("https://wa.me/541122223333?text="));
  assert.match(decodeURIComponent(enlace), /Hola Carolina/);
});

test("sin teléfono, el enlace abre el chat propio en vez de romperse", () => {
  /* Un enlace muerto parece que anduvo; abrir el chat equivocado se ve al
     instante. Entre las dos fallas, se elige la que se nota. */
  const enlace = enlaceDePedidoDeResena({ telefonoDigits: "", ...datosMadre });

  assert.match(enlace, /^https:\/\/wa\.me\/\d+\?text=/);
});

test("limpia el teléfono de todo lo que no sea número", () => {
  // `wa.me` sólo acepta dígitos: un "+54 9 11" pegado tal cual da un enlace roto.
  const enlace = enlaceDePedidoDeResena({ telefonoDigits: "+54 9 11 2222-3333", ...datosMadre });

  // Se conservan TODOS los dígitos, incluido el 9 de celular argentino.
  assert.ok(enlace.startsWith("https://wa.me/5491122223333?"), enlace);
});
