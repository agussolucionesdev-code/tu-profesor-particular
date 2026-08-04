import assert from "node:assert/strict";
import test from "node:test";
import {
  FALLA,
  clasificarFalla,
  esProblemaDeAcceso,
  mensajeDeFalla,
} from "../../src/api/errorClassification.js";

/* Por qué existe este módulo.

   `apiClient.js` eran 16 líneas sin un solo interceptor, así que cada llamada
   resolvía los errores a su manera. El caso peor era ManageBooking:

     } catch {
       setState("invalid");
     }

   CUALQUIER error terminaba en la pantalla "Enlace no disponible — este enlace
   venció, fue revocado o no es válido". Si a alguien se le cortaba el wifi, o si
   el backend estaba despertando —está en el plan gratuito de Render y se
   duerme—, la app le decía que su enlace no servía. Y el enlace estaba
   perfecto: al recargar entraba sin problema. Pero para entonces ya había ido a
   pedir uno nuevo, o se había ido.

   Un string de error no alcanza para arreglarlo: la pantalla necesita saber SI
   el problema fue el token o fue la red, para decidir entre "pedí otro enlace"
   y "probá de nuevo". Eso es una clasificación, no un mensaje.

   Un error de red y un 401 no son el mismo evento y no merecen la misma
   respuesta. */

const errorDeRed = (code) => ({
  isAxiosError: true,
  code,
  request: {},
  response: undefined,
});

const errorHttp = (status, data) => ({
  isAxiosError: true,
  response: { status, data },
});

test("un 401 es un problema de acceso", () => {
  const falla = clasificarFalla(errorHttp(401));

  assert.equal(falla.tipo, FALLA.ACCESO);
  assert.equal(falla.status, 401);
  assert.equal(esProblemaDeAcceso(falla), true);
});

test("un 403 también es un problema de acceso", () => {
  // El token es válido pero no corresponde a este turno. Para quien mira la
  // pantalla es lo mismo que un token vencido: necesita otro.
  assert.equal(clasificarFalla(errorHttp(403)).tipo, FALLA.ACCESO);
});

test("un 404 es un problema de acceso, no un error del servidor", () => {
  // El backend devuelve 404 cuando el código no existe. Mandar a "probá de
  // nuevo" a alguien con un código equivocado lo deja reintentando para siempre.
  assert.equal(clasificarFalla(errorHttp(404)).tipo, FALLA.ACCESO);
});

test("un error de red sin respuesta NO es un problema de acceso", () => {
  // Es el bug entero, en una línea.
  const falla = clasificarFalla(errorDeRed("ERR_NETWORK"));

  assert.equal(falla.tipo, FALLA.RED);
  assert.equal(esProblemaDeAcceso(falla), false);
  assert.equal(falla.sePuedeReintentar, true);
});

test("un timeout se distingue de una red caída", () => {
  // No es lo mismo: con la red caída no hay nada que hacer hasta que vuelva;
  // con un timeout el pedido puede haber llegado igual.
  const falla = clasificarFalla(errorDeRed("ECONNABORTED"));

  assert.equal(falla.tipo, FALLA.DEMORA);
  assert.equal(falla.sePuedeReintentar, true);
});

test("ETIMEDOUT también cuenta como demora", () => {
  assert.equal(clasificarFalla(errorDeRed("ETIMEDOUT")).tipo, FALLA.DEMORA);
});

test("un 5xx es del servidor y se puede reintentar", () => {
  const falla = clasificarFalla(errorHttp(503));

  assert.equal(falla.tipo, FALLA.SERVIDOR);
  assert.equal(falla.sePuedeReintentar, true);
  assert.equal(esProblemaDeAcceso(falla), false);
});

test("un 409 es un conflicto y NO se reintenta solo", () => {
  // Alguien tomó el horario. Reintentar lo mismo vuelve a fallar: hay que
  // elegir otro.
  const falla = clasificarFalla(errorHttp(409));

  assert.equal(falla.tipo, FALLA.CONFLICTO);
  assert.equal(falla.sePuedeReintentar, false);
});

test("un 429 pide esperar, no reintentar en el acto", () => {
  const falla = clasificarFalla(errorHttp(429));

  assert.equal(falla.tipo, FALLA.DEMASIADOS_INTENTOS);
  assert.equal(falla.sePuedeReintentar, false);
});

test("un 400 es de datos y no se reintenta con lo mismo", () => {
  const falla = clasificarFalla(errorHttp(400, { message: "Falta el email." }));

  assert.equal(falla.tipo, FALLA.DATOS);
  assert.equal(falla.sePuedeReintentar, false);
});

test("una cancelación deliberada no es una falla que mostrar", () => {
  /* Cuando un componente se desmonta a mitad de un pedido, axios lanza un
     CanceledError. Si eso llega a la pantalla como error, alguien que navega
     rápido ve un cartel rojo por haber cambiado de página. */
  const falla = clasificarFalla({ isAxiosError: true, code: "ERR_CANCELED" });

  assert.equal(falla.tipo, FALLA.CANCELADA);
  assert.equal(falla.seMuestra, false);
});

test("todas las demás fallas sí se muestran", () => {
  for (const error of [errorHttp(401), errorHttp(500), errorDeRed("ERR_NETWORK")]) {
    assert.equal(clasificarFalla(error).seMuestra, true);
  }
});

test("sin conexión del navegador gana sobre cualquier otra pista", () => {
  // Si navigator.onLine dice que no hay red, decir "el servidor tarda" manda a
  // la persona a mirar donde no está el problema.
  const falla = clasificarFalla(errorDeRed("ECONNABORTED"), { enLinea: false });

  assert.equal(falla.tipo, FALLA.SIN_CONEXION);
  assert.equal(falla.sePuedeReintentar, true);
});

test("no confunde un 4xx con estar sin conexión", () => {
  // navigator.onLine puede quedar desactualizado. Si el servidor CONTESTÓ, hubo
  // conexión: la respuesta es la prueba.
  assert.equal(
    clasificarFalla(errorHttp(401), { enLinea: false }).tipo,
    FALLA.ACCESO,
  );
});

test("un error que no es de axios no se clasifica mal", () => {
  // Un TypeError dentro de un .then() llega al mismo catch. Tratarlo como un
  // problema de red haría que la pantalla ofrezca "reintentar" ante un bug.
  const falla = clasificarFalla(new TypeError("x.map is not a function"));

  assert.equal(falla.tipo, FALLA.INESPERADA);
  assert.equal(falla.sePuedeReintentar, false);
});

test("clasificar null o undefined no explota", () => {
  for (const valor of [null, undefined]) {
    assert.equal(clasificarFalla(valor).tipo, FALLA.INESPERADA);
  }
});

test("cada tipo de falla tiene un mensaje en castellano y sin jerga", () => {
  for (const tipo of Object.values(FALLA)) {
    if (tipo === FALLA.CANCELADA) continue; // No se muestra.
    const mensaje = mensajeDeFalla({ tipo, status: null });
    assert.ok(mensaje.length > 15, `${tipo} sin mensaje útil`);
    assert.ok(
      !/\b(error|status|http|fetch|axios|null|undefined|\d{3})\b/i.test(mensaje),
      `${tipo} filtra jerga técnica: ${mensaje}`,
    );
  }
});

test("prefiere el mensaje del servidor cuando dice algo útil", () => {
  const falla = clasificarFalla(
    errorHttp(400, { message: "Ese horario ya no está disponible." }),
  );

  assert.equal(mensajeDeFalla(falla), "Ese horario ya no está disponible.");
});

test("descarta un mensaje del servidor que es un volcado técnico", () => {
  const falla = clasificarFalla(
    errorHttp(400, { message: "ValidationError: Cast to ObjectId failed" }),
  );

  assert.ok(!mensajeDeFalla(falla).includes("ObjectId"));
});

test("el mensaje de demora nombra la causa real y no culpa a la persona", () => {
  /* El backend está en el plan gratuito de Render: se duerme sin tráfico y el
     primer pedido puede tardar más que el timeout de 15 segundos. Es la causa
     más probable de un timeout acá, y decirlo cambia "algo salió mal" por
     "esperá unos segundos y listo". */
  const mensaje = mensajeDeFalla({ tipo: FALLA.DEMORA, status: null });

  assert.match(mensaje, /tard|despert|de nuevo/i);
});
