import AppSettings from "../models/AppSettings.js";

/* Precio de una reserva self-service.
 *
 * `createBooking` público nunca asignaba `price`, así que toda reserva hecha desde
 * el sitio quedaba en 0. El KPI "Ingresos del mes" suma el `price` de los turnos
 * Finalizado, así que sumaba únicamente lo que el profesor había cargado a mano:
 * el número era estructuralmente incompleto y no había forma de notarlo
 * mirándolo.
 *
 * El precio se calcula ACÁ, en el servidor. `price` no está en
 * createBookingSchema y no tiene que estar: si el cliente pudiera mandarlo,
 * cualquiera reservaría por cero.
 */

export const PRICE_PER_HOUR_KEY = "booking.pricePerHour";

/* Redondeo a peso entero. En pesos argentinos nadie cobra centavos, y un `price`
   con decimales hace que el KPI de ingresos muestre números con coma. */
const aPesoEntero = (valor) => Math.round(valor);

/* La tarifa la edita el profesor desde el panel, así que puede quedar en
   cualquier cosa: vacía, un texto, un negativo. Cualquiera de esas significa "sin
   tarifa configurada", y sin tarifa NO se inventa un número: el precio queda en
   0, que es lo que significa "a acordar" y es lo que pasaba siempre hasta ahora. */
const tarifaUsable = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

/** Lee la tarifa por hora configurada, o null si no hay una usable. */
export const getPricePerHour = async () => {
  const registro = await AppSettings.findOne({ key: PRICE_PER_HOUR_KEY }).lean();
  return tarifaUsable(registro?.value);
};

/**
 * Precio de una reserva a partir de una tarifa y una duración en horas.
 * Devuelve 0 cuando no hay tarifa: nunca un precio inventado.
 */
export const calcularPrecio = (tarifaPorHora, duracionHoras) => {
  const tarifa = tarifaUsable(tarifaPorHora);
  const horas = Number(duracionHoras);
  if (!tarifa || !Number.isFinite(horas) || horas <= 0) return 0;
  return aPesoEntero(tarifa * horas);
};

/**
 * Lo que se guarda al crear una reserva self-service: el precio Y la tarifa con
 * la que se cotizó.
 *
 * Se guarda el precio en lugar de calcularlo al leer por la misma razón por la que
 * una factura guarda el importe: quien reservó a 8000 acordó 8000, y un aumento
 * posterior no puede reescribir lo que ya se acordó.
 */
export const buildPricingForNewBooking = async (duracionHoras) => {
  const tarifa = await getPricePerHour();
  return {
    price: calcularPrecio(tarifa, duracionHoras),
    pricePerHourAtBooking: tarifa,
  };
};

/**
 * Precio después de reprogramar.
 *
 * Solo cambia si cambió la duración, y se recalcula con la tarifa que se le
 * cotizó a esa persona —no con la actual—: mover un horario no puede encarecerle
 * el turno a alguien porque el profesor subió los valores en el medio.
 *
 * Si la reserva no tiene tarifa guardada —las anteriores a este campo, o las que
 * cargó el profesor a mano con un precio propio— se deja el precio como está: no
 * hay forma de recalcularlo sin inventar la tarifa, y sobrescribir un precio que
 * el profesor puso a mano sería peor que no tocarlo.
 */
export const repricingForReschedule = ({ booking, nuevaDuracion }) => {
  const tarifa = tarifaUsable(booking?.pricePerHourAtBooking);
  if (!tarifa) return null;
  if (Number(booking.duration) === Number(nuevaDuracion)) return null;
  return { price: calcularPrecio(tarifa, nuevaDuracion) };
};
