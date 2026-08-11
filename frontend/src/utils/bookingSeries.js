import { addWeeks, format } from "date-fns";

/* Serie de clases semanales.
 *
 * Hasta ahora, para 8 clases semanales había que completar el wizard 8 veces y se
 * recibían 8 códigos sin ninguna relación entre sí.
 *
 * DECISIÓN DE PRODUCTO: una serie de 8 clases son 8 reservas con 8 códigos, como
 * en Google Calendar. Cada clase se cancela y se reprograma sola: si te agarra un
 * examen la semana que viene, cancelás esa y las otras siete siguen en pie.
 *
 * Eso hace que no haga falta un endpoint nuevo. Se hace una llamada por semana al
 * mismo `POST /api/bookings/reserve` que ya está probado, cada una con su propia
 * clave de idempotencia y todas con el mismo `seriesId`. El camino crítico
 * —locks, claim de slots, notificaciones— no se toca.
 */

export const SEMANAS_MINIMO = 2;
export const SEMANAS_MAXIMO = 12;

/* Opciones que ofrece el wizard. Cortadas en 12 porque más de un trimestre por
   adelantado es raro y multiplica las semanas que pueden estar ocupadas. */
export const OPCIONES_DE_REPETICION = [
  { semanas: 1, label: "Solo esta clase", recomendado: true },
  { semanas: 4, label: "4 semanas" },
  { semanas: 8, label: "8 semanas" },
  { semanas: 12, label: "12 semanas" },
];

const nuevoSeriesId = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  /* Sin randomUUID no se arma una serie: el backend valida que el seriesId sea un
     UUID, y un identificador inventado a mano haría fallar las 8 llamadas.
     Devolver null hace que el wizard reserve solo la primera clase, que es un
     resultado degradado pero correcto. */
  return null;
};

/**
 * Las fechas de una serie: la misma hora, una semana después de la otra.
 * `addWeeks` de date-fns y no sumar 7×24 h en milisegundos: al cruzar un cambio
 * de horario de verano, sumar milisegundos corre la clase una hora.
 */
export const fechasDeLaSerie = (primera, semanas) =>
  Array.from({ length: semanas }, (_, i) => addWeeks(new Date(primera), i));

/**
 * Reserva una serie, semana por semana.
 *
 * Best-effort a propósito. Si una semana está ocupada, cancelar las otras siete
 * sería absurdo: se reserva lo que se puede y se informa exactamente cuál quedó
 * afuera. La alternativa —todo o nada— hace que un solo horario tomado tire abajo
 * el mes entero, y es la razón más probable de que alguien abandone.
 *
 * Secuencial y no en paralelo: ocho reservas simultáneas compiten por los locks
 * de slots del backend y se pisan entre sí. Además, en serie el orden de los
 * resultados es el de las semanas, que es como se muestran.
 *
 * @param crearReserva  (payload, idempotencyKey) => Promise  — se inyecta para
 *                      poder probar esto sin red
 * @param nuevaClave    () => string
 */
export const reservarSerie = async ({
  payloadBase,
  primeraFecha,
  semanas,
  crearReserva,
  nuevaClave,
  aFormatoApi,
}) => {
  const total = Math.max(1, Math.min(Number(semanas) || 1, SEMANAS_MAXIMO));
  const seriesId = total > 1 ? nuevoSeriesId() : null;
  const fechas = fechasDeLaSerie(primeraFecha, seriesId ? total : 1);

  const resultados = [];
  for (let i = 0; i < fechas.length; i += 1) {
    const fecha = fechas[i];
    const payload = {
      ...payloadBase,
      timeSlot: aFormatoApi(fecha),
      ...(seriesId
        ? { seriesId, seriesIndex: i + 1, seriesTotal: total }
        : {}),
    };
    try {
      const respuesta = await crearReserva(payload, nuevaClave());
      resultados.push({ fecha, ok: true, datos: respuesta?.data?.data ?? null });
    } catch (error) {
      resultados.push({ fecha, ok: false, error });
    }
  }

  return { seriesId, resultados };
};

/**
 * Resumen de lo que pasó, para poder contárselo a la persona sin que tenga que
 * interpretar ocho respuestas.
 */
export const resumirSerie = (resultados) => {
  const logradas = resultados.filter((r) => r.ok);
  const falladas = resultados.filter((r) => !r.ok);
  return {
    total: resultados.length,
    logradas,
    falladas,
    todasOk: falladas.length === 0,
    ningunaOk: logradas.length === 0,
    codigos: logradas.map((r) => r.datos?.bookingCode).filter(Boolean),
  };
};

/** "miércoles 13 de agosto" — para listar las semanas en el comprobante. */
export const etiquetaDeFecha = (fecha, locale) =>
  format(new Date(fecha), "EEEE d 'de' MMMM", { locale });
