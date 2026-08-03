/* Dónde es la clase presencial.
 *
 * El valor real lo edita el profesor desde el panel y viaja en
 * `GET /api/settings`. Este módulo existe por lo que pasa cuando esa llamada
 * falla: el kiosco la pide con un `.catch(() => {})`, así que sin un fallback
 * el paso "Presencial" se quedaba sin dirección —y quien reservaba terminaba
 * sin saber adónde ir hasta que le llegaba el email—.
 *
 * Es la misma dirección que ya publica tuprofesorparticular.com.ar, no un dato
 * nuevo.
 */

export const FALLBACK_TEACHER_LOCATION = Object.freeze({
  address: "Jujuy 414, Temperley, Buenos Aires",
  mapsUrl: "https://maps.google.com/?q=Jujuy+414,Temperley,Buenos+Aires",
});

const textoUtil = (valor) => {
  const limpio = typeof valor === "string" ? valor.trim() : "";
  return limpio.length > 0 ? limpio : null;
};

/* El profesor escribe el mapsUrl a mano y termina en un `href`. Un
   `javascript:` ahí sería XSS almacenado con un solo campo de texto, así que
   se valida el esquema y no solo que "parezca" una URL. */
const enlaceSeguro = (valor) => {
  const crudo = textoUtil(valor);
  if (!crudo) return null;
  try {
    const url = new URL(crudo);
    return url.protocol === "https:" || url.protocol === "http:" ? crudo : null;
  } catch {
    return null;
  }
};

/**
 * Arma la ubicación a partir del `data` del endpoint público de ajustes.
 * Cada campo se evalúa por separado: que el mapa venga mal no debe tirar abajo
 * la dirección, ni al revés.
 */
export const parseTeacherLocation = (settings) => {
  const data = settings ?? {};
  return {
    address: textoUtil(data["teacher.address"]) ?? FALLBACK_TEACHER_LOCATION.address,
    mapsUrl: enlaceSeguro(data["teacher.mapsUrl"]) ?? FALLBACK_TEACHER_LOCATION.mapsUrl,
  };
};
