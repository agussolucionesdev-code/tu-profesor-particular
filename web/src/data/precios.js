/* ══════════════════════════════════════════════════════
   LOS PRECIOS DEL SITIO.

   No hay números escritos acá. El sitio lee en vivo la matriz de precios del
   sistema de turnos —la misma con la que el servidor cotiza cada reserva y que
   Agustín edita desde el panel— y este módulo la convierte en la grilla que se
   muestra. Un cambio de tarifa en el panel aparece solo en los dos sitios, sin
   tocar código.

   La cuenta tiene que ser idéntica a la del servidor
   (`backend/src/services/pricingMatrix.js`): si el sitio publicara «2 horas:
   $45.000» y la reserva saliera otra cosa, el precio sería una promesa rota en
   el primer paso. `tests/precios.test.js` lo compara contra la función real.

   Regla heredada del servidor: un nivel sin tarifa NO se muestra. Un $0 en
   pantalla se lee como «es gratis».
══════════════════════════════════════════════════════ */

/* El orden y los nombres del kiosco. La clave va sin tilde porque así la guarda
   la matriz; la etiqueta, con tilde, porque es lo que se lee. */
const NIVELES = [
  { nivel: "Primaria", etiqueta: "Primaria", detalle: "1.° a 6.° grado" },
  { nivel: "Secundaria", etiqueta: "Secundaria", detalle: "1.° a 6.° año" },
  { nivel: "Secundaria Tecnica", etiqueta: "Secundaria Técnica", detalle: "1.° a 7.° año" },
  { nivel: "CENS", etiqueta: "CENS", detalle: "Secundaria para adultos" },
  { nivel: "Terciario", etiqueta: "Terciario", detalle: "Profesorados y terciarios" },
  { nivel: "Universitario", etiqueta: "Universitario", detalle: "Carreras de grado y CBC" },
];

const importe = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const esObjeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* Mismas reglas que `aplicarDescuento` del servidor: el porcentaje tiene que
   estar entre 0 y 100 sin incluirlos, y la tarifa descontada se redondea a peso
   entero ANTES de multiplicar por las horas. */
const tarifaConDescuento = (tarifa, horas, descuento) => {
  const desde = Number(descuento?.desdeHoras);
  const pct = Number(descuento?.porcentaje);
  const valido = Number.isFinite(desde) && desde > 0 && Number.isFinite(pct) && pct > 0 && pct < 100;
  if (!valido || horas < desde) return tarifa;
  return Math.round(tarifa * (1 - pct / 100));
};

const precios = (tarifa, descuento) => {
  const dosHoras = Math.round(tarifaConDescuento(tarifa, 2, descuento) * 2);
  return { hora: tarifa, dosHoras, hayDescuento: dosHoras < tarifa * 2 };
};

/**
 * La grilla que se muestra, a partir de la matriz tal como la devuelve
 * `/api/settings`. Una matriz ausente o rota da `[]`: la página muestra entonces
 * su texto de respaldo en lugar de números.
 */
export const armarGrilla = (matriz) => {
  if (!esObjeto(matriz) || !esObjeto(matriz.porNivel)) return [];
  const excepciones = Array.isArray(matriz.excepciones) ? matriz.excepciones : [];

  return NIVELES.flatMap(({ nivel, etiqueta, detalle }) => {
    const tarifa = importe(matriz.porNivel[nivel]);
    if (tarifa === null) return [];

    /* La excepción de materias del nivel, si hay: en secundaria, las ciencias
       duras. Se muestra aparte porque es la diferencia de precio que más gente
       va a buscar. */
    const exc = excepciones.find(
      (e) => esObjeto(e) && e.nivel === nivel && importe(e.precio) !== null && Array.isArray(e.materias) && e.materias.length > 0,
    );
    const ciencias = exc
      ? { materias: exc.materias.filter((m) => typeof m === "string" && m.trim()), ...precios(importe(exc.precio), matriz.descuento) }
      : null;

    return [{ nivel, etiqueta, detalle, ...precios(tarifa, matriz.descuento), ciencias }];
  });
};

/** El descuento por varias horas, para decirlo en palabras, o null si no hay. */
export const descuentoVigente = (matriz) => {
  const desde = Number(matriz?.descuento?.desdeHoras);
  const pct = Number(matriz?.descuento?.porcentaje);
  if (!(Number.isFinite(desde) && desde > 0 && Number.isFinite(pct) && pct > 0 && pct < 100)) return null;
  return { desdeHoras: desde, porcentaje: pct };
};

/* «$25.000»: el punto de miles a mano y no con Intl, porque el formato de moneda
   de Intl mete un espacio duro entre el signo y el número y cambia según la
   versión de ICU del navegador. */
export const formatearPesos = (n) =>
  `$${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
