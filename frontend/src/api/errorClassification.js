/* Qué falló, en términos de la persona que está mirando la pantalla.
 *
 * `apiClient.js` eran 16 líneas sin un solo interceptor, así que cada llamada
 * resolvía los errores a su manera. El caso peor era ManageBooking:
 *
 *     } catch {
 *       setState("invalid");
 *     }
 *
 * CUALQUIER error terminaba en "Enlace no disponible — este enlace venció, fue
 * revocado o no es válido". Si a alguien se le cortaba el wifi, o si el backend
 * estaba despertando —está en el plan gratuito de Render y se duerme sin
 * tráfico—, la app le decía que su enlace no servía. Y el enlace estaba
 * perfecto: recargando entraba. Pero para entonces ya había ido a pedir otro,
 * o se había ido.
 *
 * Un string de error no arregla eso: la pantalla necesita saber SI el problema
 * fue el token o fue la red, para elegir entre "pedí otro enlace" y "probá de
 * nuevo". Eso es una clasificación, no un mensaje. El mensaje viene después.
 */

export const FALLA = {
  /* El token no sirve para esto: vencido, revocado, de otro turno, o el código
     no existe. Es lo único que justifica mandar a pedir un enlace nuevo. */
  ACCESO: "acceso",
  /* El navegador dice que no hay conexión. */
  SIN_CONEXION: "sin-conexion",
  /* El pedido salió y no volvió nada: DNS, CORS, servidor caído. */
  RED: "red",
  /* Tardó más que el timeout. Puede haber llegado igual. */
  DEMORA: "demora",
  /* El servidor contestó que algo se le rompió a él. */
  SERVIDOR: "servidor",
  /* Alguien se adelantó: el horario ya está tomado. */
  CONFLICTO: "conflicto",
  /* Rate limit. */
  DEMASIADOS_INTENTOS: "demasiados-intentos",
  /* Lo que se mandó no pasa la validación. */
  DATOS: "datos",
  /* El pedido se abortó a propósito, casi siempre por un desmontaje. */
  CANCELADA: "cancelada",
  /* No es un error de axios: probablemente un bug nuestro. */
  INESPERADA: "inesperada",
};

/* Lo que sí tiene sentido volver a intentar tal cual. Un 409 no está: alguien
   tomó el horario, y reintentar lo mismo vuelve a fallar. Un 400 tampoco: hay
   que cambiar lo que se manda. */
const REINTENTABLES = new Set([
  FALLA.SIN_CONEXION,
  FALLA.RED,
  FALLA.DEMORA,
  FALLA.SERVIDOR,
]);

const CODIGOS_DE_DEMORA = new Set(["ECONNABORTED", "ETIMEDOUT", "ERR_TIMEOUT"]);

const enLineaPorDefecto = () =>
  typeof navigator === "undefined" || navigator.onLine !== false;

const tipoPorStatus = (status) => {
  if (status === 401 || status === 403 || status === 404) return FALLA.ACCESO;
  if (status === 409) return FALLA.CONFLICTO;
  if (status === 429) return FALLA.DEMASIADOS_INTENTOS;
  if (status >= 500) return FALLA.SERVIDOR;
  if (status >= 400) return FALLA.DATOS;
  return FALLA.INESPERADA;
};

/**
 * Clasifica un error de axios.
 *
 * @param error            el error tal como lo lanza axios
 * @param opciones.enLinea si el navegador cree tener conexión (para poder
 *                         probarlo sin tocar navigator)
 */
export const clasificarFalla = (error, { enLinea = enLineaPorDefecto() } = {}) => {
  const status = error?.response?.status ?? null;
  const mensajeServidor = error?.response?.data?.message ?? null;

  const armar = (tipo) => ({
    tipo,
    status,
    mensajeServidor,
    sePuedeReintentar: REINTENTABLES.has(tipo),
    // La cancelación es la única que no se muestra: la provocamos nosotros al
    // desmontar, y quien navega rápido no tiene que ver un cartel rojo por eso.
    seMuestra: tipo !== FALLA.CANCELADA,
  });

  if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
    return armar(FALLA.CANCELADA);
  }

  /* Si el servidor CONTESTÓ, hubo conexión: la respuesta es la prueba, y vale
     más que navigator.onLine, que se queda desactualizado. Por eso el status se
     evalúa antes de mirar si hay red. */
  if (status !== null) return armar(tipoPorStatus(status));

  if (!error?.isAxiosError) return armar(FALLA.INESPERADA);

  // Sin conexión gana sobre el resto: decir "el servidor tarda" mandaría a
  // mirar donde no está el problema.
  if (!enLinea) return armar(FALLA.SIN_CONEXION);
  if (CODIGOS_DE_DEMORA.has(error.code)) return armar(FALLA.DEMORA);
  return armar(FALLA.RED);
};

/* Lo único que justifica decirle a alguien "tu enlace no sirve, pedí otro". */
export const esProblemaDeAcceso = (falla) => falla?.tipo === FALLA.ACCESO;

/* Un mensaje del servidor que en realidad es un volcado del stack. Mostrarlo
   no ayuda a nadie y encima delata cómo está hecho el backend. */
const JERGA = /(ValidationError|CastError|ObjectId|MongoError|E11000|at\s+\w+\.|\bstack\b)/i;

const MENSAJES = {
  [FALLA.ACCESO]:
    "Este enlace ya no sirve: venció o fue dado de baja. Entrá con tu código de reserva desde Mis Turnos.",
  [FALLA.SIN_CONEXION]:
    "Parece que te quedaste sin conexión. Fijate el wifi o los datos y volvé a intentar.",
  [FALLA.RED]:
    "No pudimos conectarnos. Revisá tu conexión y volvé a intentar en un momento.",
  [FALLA.DEMORA]:
    "El servidor tardó en responder: suele pasar la primera vez, mientras despierta. Probá de nuevo y ya debería andar.",
  [FALLA.SERVIDOR]:
    "Se nos complicó del lado nuestro. Probá de nuevo en un momento; si sigue igual, escribinos por WhatsApp.",
  [FALLA.CONFLICTO]:
    "Alguien tomó ese horario mientras completabas. Elegí otro y seguí.",
  [FALLA.DEMASIADOS_INTENTOS]:
    "Hubo demasiados intentos seguidos. Esperá un minuto y volvé a probar.",
  [FALLA.DATOS]:
    "Falta algo o hay un dato que no cierra. Revisá lo que completaste y volvé a intentar.",
  [FALLA.INESPERADA]:
    "Algo no funcionó como esperábamos. Recargá la página; si sigue igual, escribinos por WhatsApp.",
  [FALLA.CANCELADA]: "",
};

/**
 * El texto que se le muestra a la persona.
 * Se prefiere lo que dijo el servidor SOLO si dice algo entendible: un 409 en
 * una reserva no es "conflicto 409", es que alguien tomó ese horario, y esa
 * frase la escribe mejor el backend que un catálogo genérico.
 */
export const mensajeDeFalla = (falla) => {
  const delServidor = String(falla?.mensajeServidor ?? "").trim();
  if (delServidor.length > 10 && !JERGA.test(delServidor)) return delServidor;
  return MENSAJES[falla?.tipo] ?? MENSAJES[FALLA.INESPERADA];
};
