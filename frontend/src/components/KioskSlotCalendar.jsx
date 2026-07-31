import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { format, isSameDay, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import {
  FaCalendarAlt,
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

const PERIODS = [
  { id: "morning", label: "Mañana", from: 7, to: 13 },
  { id: "afternoon", label: "Tarde", from: 13, to: 19 },
  { id: "night", label: "Noche", from: 19, to: 22 },
];

const KioskSlotCalendar = ({ slotsByDay, onPick }) => {
  /* Días que tienen al menos un horario libre. Sirve para dos cosas: limitar el
     calendario a fechas elegibles y pintar el punto verde del día. */
  const availableDays = useMemo(
    () => slotsByDay.map((d) => startOfDay(d.dayObj)),
    [slotsByDay],
  );

  const [selectedDay, setSelectedDay] = useState(
    () => availableDays[0] ?? null,
  );

  const daySlots = useMemo(() => {
    if (!selectedDay) return [];
    const match = slotsByDay.find((d) => isSameDay(d.dayObj, selectedDay));
    return match?.slots ?? [];
  }, [slotsByDay, selectedDay]);

  // Agrupar por franja y descartar las vacías: sin "Noche" si no hay nocturnos.
  const slotsByPeriod = useMemo(
    () =>
      PERIODS.map((p) => ({
        ...p,
        slots: daySlots.filter((s) => {
          const h = s.timeObj.getHours();
          return h >= p.from && h < p.to;
        }),
      })).filter((p) => p.slots.length > 0),
    [daySlots],
  );

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
                  onClick={increaseMonth}
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
                    {period.slots.map((slot) => (
                      <button
                        key={slot.timeObj.toISOString()}
                        type="button"
                        className="ksc-slot"
                        onClick={() => onPick(slot.timeObj)}
                        aria-label={`Reservar a las ${format(slot.timeObj, "HH:mm")} del ${format(slot.timeObj, "EEEE d 'de' MMMM", { locale: es })}`}
                      >
                        {format(slot.timeObj, "HH:mm")}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default KioskSlotCalendar;
