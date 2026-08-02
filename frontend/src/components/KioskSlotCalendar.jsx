import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { format, isSameDay, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";
import "./KioskSlotCalendar.css";

/* Calendario + horarios del día elegido.
   Reemplaza al viejo "Ver más fechas", que estiraba una lista imposible de
   recorrer: la agenda cubre hasta 92 días y una lista de ese largo no se puede
   navegar. Con el calendario se ve de un golpe qué días tienen lugar.

   Mismas decisiones que el modal de reprogramar del portal (PERIODS, header
   propio, locale es) para que las dos pantallas se sientan el mismo producto. */

/* Franjas por hora de inicio. Los bordes cubren el día COMPLETO a propósito:
   con la primera arrancando en 0 y la última terminando en 24, ningún horario
   puede quedar fuera de todas y volverse inelegible. Pasó de verdad —con la
   noche cortada en 22, el turno de las 22:00 existía y no se podía tocar. */
const PERIODS = [
  { id: "morning", label: "Mañana", from: 0, to: 13 },
  { id: "afternoon", label: "Tarde", from: 13, to: 19 },
  { id: "night", label: "Noche", from: 19, to: 24 },
];

const KioskSlotCalendar = ({
  slotsByDay,
  onPick,
  onNeedFullRange,
  selectedSlot = null,
  onConfirm,
}) => {
  /* Días que tienen al menos un horario libre. Sirve para dos cosas: limitar el
     calendario a fechas elegibles y pintar el punto verde del día. */
  const availableDays = useMemo(
    () => slotsByDay.map((d) => startOfDay(d.dayObj)),
    [slotsByDay],
  );

  /* Si ya hay un horario elegido, el calendario abre en SU día. Si no, en el
     primero libre. Volver al paso y encontrarlo en otro mes desorienta. */
  const [selectedDay, setSelectedDay] = useState(
    () => (selectedSlot ? startOfDay(new Date(selectedSlot)) : availableDays[0]) ?? null,
  );

  const slotElegido = selectedSlot ? new Date(selectedSlot) : null;
  const esElegido = (timeObj) =>
    Boolean(slotElegido) && slotElegido.getTime() === timeObj.getTime();

  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    const match = slotsByDay.find((d) => isSameDay(d.dayObj, selectedDay));
    return match?.slots ?? [];
  }, [slotsByDay, selectedDay]);

  /* Agrupar por franja, descartando las vacías (sin "Noche" si no hay
     nocturnos). Se agrupa por reparto —cada horario cae en la primera franja
     que lo acepta y se lo saca del resto— en lugar de filtrar tres veces: así
     un horario no puede duplicarse ni, sobre todo, perderse. Si alguno quedara
     sin franja igual se muestra al final: es preferible una etiqueta rara a un
     turno disponible que nadie puede elegir. */
  const slotsByPeriod = useMemo(() => {
    const periodoDe = (slot) => {
      const h = slot.timeObj.getHours();
      return PERIODS.find((p) => h >= p.from && h < p.to);
    };

    const grupos = PERIODS.map((p) => ({
      ...p,
      slots: daySlots.filter((s) => periodoDe(s)?.id === p.id),
    }));

    const huerfanos = daySlots.filter((s) => !periodoDe(s));
    if (huerfanos.length > 0) {
      grupos.push({ id: "otros", label: "Otros horarios", slots: huerfanos });
    }
    return grupos.filter((p) => p.slots.length > 0);
  }, [daySlots]);

  if (availableDays.length === 0) return null;

  return (
    <div className="ksc">
      <div className="ksc-grid">
        {/* ── Calendario ── */}
        <section className="ksc-col" aria-labelledby="ksc-day-label">
          <h3 className="ksc-col-label" id="ksc-day-label">
            <FaCalendarAlt aria-hidden="true" /> Elegí el día
          </h3>

          <DatePicker
            selected={selectedDay}
            onChange={(d) => setSelectedDay(d)}
            includeDates={availableDays}
            locale={es}
            inline
            calendarClassName="ksc-datepicker"
            dayClassName={(date) =>
              availableDays.some((d) => isSameDay(d, date))
                ? "ksc-day--free"
                : undefined
            }
            renderCustomHeader={({
              date,
              decreaseMonth,
              increaseMonth,
              prevMonthButtonDisabled,
              nextMonthButtonDisabled,
            }) => (
              <div className="ksc-dp-header">
                <button
                  type="button"
                  className="ksc-month-nav"
                  onClick={decreaseMonth}
                  disabled={prevMonthButtonDisabled}
                  aria-label="Mes anterior"
                >
                  <FaChevronLeft aria-hidden="true" />
                </button>
                <strong>{format(date, "MMMM yyyy", { locale: es })}</strong>
                <button
                  type="button"
                  className="ksc-month-nav"
                  onClick={() => {
                    increaseMonth();
                    /* La primera carga sólo trae unas semanas para que el paso
                       abra rápido. Si el visitante se va al mes que viene,
                       recién ahí se pide la agenda completa. */
                    onNeedFullRange?.();
                  }}
                  disabled={nextMonthButtonDisabled}
                  aria-label="Mes siguiente"
                >
                  <FaChevronRight aria-hidden="true" />
                </button>
              </div>
            )}
          />

          <p className="ksc-legend">
            <span className="ksc-legend-dot" aria-hidden="true" />
            Los días marcados tienen horarios libres
          </p>
        </section>

        {/* ── Horarios del día elegido ── */}
        <section className="ksc-col" aria-labelledby="ksc-time-label">
          <h3 className="ksc-col-label" id="ksc-time-label">
            <FaClock aria-hidden="true" /> Horarios disponibles
          </h3>

          {selectedDay && (
            <p className="ksc-day-caption">
              {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
              <span className="ksc-day-total">
                {daySlots.length}{" "}
                {daySlots.length === 1 ? "horario" : "horarios"}
              </span>
            </p>
          )}

          {/* Instrucción de cómo soltar lo elegido. Va ACÁ y no en un tooltip:
              si la forma de deshacer no se lee en el mismo lugar donde se
              elige, no existe. */}
          {slotElegido && (
            <p className="ksc-ayuda-soltar">
              Para cambiarlo, tocá otro horario. Para soltarlo, tocá de nuevo el
              que está marcado.
            </p>
          )}

          {/* aria-live: al cambiar de día se anuncia cuántos horarios hay. */}
          <div className="ksc-periods" aria-live="polite">
            {daySlots.length === 0 ? (
              <p className="ksc-empty" role="status">
                No hay horarios libres este día. Probá con otro.
              </p>
            ) : (
              slotsByPeriod.map((period) => (
                <div key={period.id} className="ksc-period">
                  <h4 className="ksc-period-label">{period.label}</h4>
                  <div className="ksc-slots">
                    {period.slots.map((slot) => {
                      const elegido = esElegido(slot.timeObj);
                      return (
                        <button
                          key={slot.timeObj.toISOString()}
                          type="button"
                          className={`ksc-slot${elegido ? " is-elegido" : ""}`}
                          onClick={() => onPick(slot.timeObj)}
                          /* aria-pressed y no un aria-label que diga "Reservar":
                             esto es un botón de dos estados, y el lector de
                             pantalla tiene que poder decir si está activado. */
                          aria-pressed={elegido}
                          aria-label={`${format(slot.timeObj, "HH:mm")} del ${format(slot.timeObj, "EEEE d 'de' MMMM", { locale: es })}${elegido ? ". Elegido. Tocá de nuevo para soltarlo" : ""}`}
                        >
                          {format(slot.timeObj, "HH:mm")}
                          {elegido && (
                            <FaCheck className="ksc-slot-check" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Barra de confirmación: aparece recién cuando hay algo elegido, repite
          en palabras QUÉ se eligió —para no obligar a volver a buscarlo en la
          grilla— y deja avanzar cuando la persona quiere, no antes. */}
      {slotElegido && (
        <div className="ksc-confirmar" role="status" aria-live="polite">
          <div className="ksc-confirmar-txt">
            <span className="ksc-confirmar-label">Elegiste</span>
            <strong className="ksc-confirmar-valor">
              {format(slotElegido, "EEEE d 'de' MMMM", { locale: es })} a las{" "}
              {format(slotElegido, "HH:mm")}
            </strong>
          </div>
          <div className="ksc-confirmar-acciones">
            <button
              type="button"
              className="ksc-soltar"
              onClick={() => onPick(slotElegido)}
            >
              Soltar
            </button>
            <button type="button" className="ksc-avanzar" onClick={onConfirm}>
              Continuar <FaArrowRight aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KioskSlotCalendar;
