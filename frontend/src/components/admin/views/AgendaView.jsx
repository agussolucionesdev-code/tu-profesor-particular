import { useEffect, useMemo, useState } from "react";
import {
  FaCalendarPlus,
  FaChevronLeft,
  FaChevronRight,
  FaPlus,
  FaSyncAlt,
} from "react-icons/fa";
import AdminBookingModal from "../AdminBookingModal";
import {
  useAdminAgenda,
  useAdminAgendaSchedule,
} from "../../../hooks/useAdminAgenda";
import {
  addBusinessDays,
  businessDateKey,
  durationOptionsForSlotMinutes,
  formatBusinessDate,
  formatBusinessTime,
  formatDurationLabel,
} from "../../../utils/adminAgenda";
import { downloadIcs } from "../../../utils/icsExport";
import "./AgendaView.css";

const STATUS_CLASS = {
  Pendiente: "pending",
  Confirmado: "confirmed",
  Finalizado: "finalized",
  Cancelado: "cancelled",
};

const dateKeysInRange = ({ fromDateKey, toDateKey }) => {
  const keys = [];
  for (let key = fromDateKey; key < toDateKey; key = addBusinessDays(key, 1)) {
    keys.push(key);
  }
  return keys;
};

const AgendaView = ({
  sortedBookings,
  authConfig,
  onCreateBooking,
  onUpdateBooking,
  onInteractionStateChange,
  onRefreshBookings,
}) => {
  const [mode, setMode] = useState("week");
  const [anchorDateKey, setAnchorDateKey] = useState(() => businessDateKey(new Date()));
  const [modal, setModal] = useState(null);

  useEffect(() => {
    onInteractionStateChange?.(Boolean(modal));
    return () => onInteractionStateChange?.(false);
  }, [modal, onInteractionStateChange]);
  const schedule = useAdminAgendaSchedule(authConfig);
  const slotDurationMinutes = schedule.data?.slotDurationMinutes ?? null;
  const durationOptions = useMemo(
    () => slotDurationMinutes
      ? durationOptionsForSlotMinutes(slotDurationMinutes)
      : [],
    [slotDurationMinutes],
  );
  const defaultDuration = durationOptions[0] ?? 0.5;
  const availability = useAdminAgenda({
    authConfig,
    anchorDateKey,
    mode,
    duration: defaultDuration,
    enabled: schedule.status === "ready",
  });
  const dayKeys = useMemo(
    () => dateKeysInRange(availability.range),
    [availability.range],
  );
  const bookingsByDay = useMemo(() => {
    const grouped = new Map(dayKeys.map((key) => [key, []]));
    for (const booking of sortedBookings) {
      try {
        const key = businessDateKey(booking.timeSlot);
        if (grouped.has(key)) grouped.get(key).push(booking);
      } catch {
        // Invalid historical timestamps are intentionally omitted from the agenda.
      }
    }
    return grouped;
  }, [dayKeys, sortedBookings]);
  const slotsByDay = useMemo(() => {
    const grouped = new Map(dayKeys.map((key) => [key, []]));
    for (const slot of availability.data?.slots || []) {
      const key = businessDateKey(slot.timeSlot);
      if (grouped.has(key)) grouped.get(key).push(slot);
    }
    return grouped;
  }, [availability.data, dayKeys]);

  const moveRange = (direction) => {
    setAnchorDateKey((current) => addBusinessDays(
      current,
      direction * (mode === "week" ? 7 : 1),
    ));
  };

  const submitModal = async (payload, idempotencyKey) => {
    if (modal.mode === "create") {
      await onCreateBooking(payload, idempotencyKey);
    } else {
      await onUpdateBooking(modal.booking._id, payload);
    }
    availability.retry();
  };

  const refreshAfterConflict = async () => {
    await onRefreshBookings({ silent: true });
    availability.retry();
  };

  const rangeHeading = mode === "day"
    ? formatBusinessDate(availability.range.fromDateKey)
    : `${formatBusinessDate(availability.range.fromDateKey, { weekday: undefined })} – ${formatBusinessDate(addBusinessDays(availability.range.toDateKey, -1), { weekday: undefined })}`;
  const visibleBookings = dayKeys.flatMap((key) => bookingsByDay.get(key) || []);

  return (
    <section className="admin-card agenda-operations" aria-labelledby="agenda-operational-title">
      <header className="agenda-toolbar">
        <div>
          <span className="card-kicker">Zona horaria: Buenos Aires</span>
          <h2 id="agenda-operational-title">Agenda operativa</h2>
          <p>{rangeHeading}</p>
        </div>
        <div className="agenda-toolbar-actions">
          <div className="agenda-mode-switch" role="group" aria-label="Vista de agenda">
            <button type="button" aria-pressed={mode === "day"} onClick={() => setMode("day")}>Día</button>
            <button type="button" aria-pressed={mode === "week"} onClick={() => setMode("week")}>Semana</button>
          </div>
          <button
            type="button"
            className="admin-primary-btn slim"
            disabled={schedule.status !== "ready" || availability.status !== "ready"}
            onClick={() => setModal({
              mode: "create",
              initialTimeSlot: "",
              initialDateKey: anchorDateKey,
            })}
          >
            <FaPlus aria-hidden="true" /> Crear turno
          </button>
          {visibleBookings.length > 0 && (
            <button type="button" className="admin-secondary-btn slim" onClick={() => downloadIcs(visibleBookings, "agenda.ics")}>
              <FaCalendarPlus aria-hidden="true" /> .ics
            </button>
          )}
        </div>
      </header>

      <div className="agenda-range-nav" aria-label="Navegar fechas">
        <button type="button" className="cal-nav-btn" onClick={() => moveRange(-1)} aria-label={mode === "day" ? "Día anterior" : "Semana anterior"}><FaChevronLeft aria-hidden="true" /></button>
        <button type="button" className="cal-today-btn" onClick={() => setAnchorDateKey(businessDateKey(new Date()))}>Hoy</button>
        <button type="button" className="cal-nav-btn" onClick={() => moveRange(1)} aria-label={mode === "day" ? "Día siguiente" : "Semana siguiente"}><FaChevronRight aria-hidden="true" /></button>
      </div>

      {availability.status === "loading" && <p className="agenda-state" role="status" aria-live="polite">Cargando disponibilidad autoritativa…</p>}
      {availability.status === "error" && (
        <div className="agenda-inline-error" role="alert" aria-live="assertive">
          <span>{availability.error}</span>
          <button type="button" className="admin-secondary-btn slim" onClick={availability.retry}><FaSyncAlt aria-hidden="true" /> Reintentar</button>
        </div>
      )}

      {schedule.status === "error" && (
        <div className="agenda-inline-error" role="alert" aria-live="assertive">
          <span>{schedule.error} Los turnos existentes siguen disponibles en modo operativo.</span>
          <button type="button" className="admin-secondary-btn slim" onClick={schedule.retry}><FaSyncAlt aria-hidden="true" /> Reintentar</button>
        </div>
      )}

      <div className={`agenda-days-grid is-${mode}`}>
          {dayKeys.map((dayKey) => {
            const dayBookings = bookingsByDay.get(dayKey) || [];
            const freeSlots = slotsByDay.get(dayKey) || [];
            return (
              <article className="agenda-day-column" key={dayKey} aria-labelledby={`agenda-day-${dayKey}`}>
                <header>
                  <h3 id={`agenda-day-${dayKey}`}>{formatBusinessDate(dayKey)}</h3>
                  <span>{dayBookings.length} turno{dayBookings.length === 1 ? "" : "s"}</span>
                </header>
                <div className="agenda-booking-list">
                  {dayBookings.map((booking) => (
                    <button
                      type="button"
                      key={booking._id}
                      className={`agenda-booking-card ${STATUS_CLASS[booking.status] || "confirmed"}`}
                      onClick={() => setModal({ mode: "edit", booking })}
                      aria-label={`Editar turno de ${booking.studentName}, ${booking.subject}, ${formatBusinessTime(booking.timeSlot)}, ${booking.status}`}
                    >
                      <time>{formatBusinessTime(booking.timeSlot)}</time>
                      <strong>{booking.studentName}</strong>
                      <span>{booking.subject}</span>
                      <small>{booking.status} · {formatDurationLabel(booking.duration)}</small>
                    </button>
                  ))}
                  {dayBookings.length === 0 && <p className="agenda-empty">Sin turnos</p>}
                </div>
                <details className="agenda-free-slots">
                  <summary>
                    {availability.status === "ready"
                      ? `${freeSlots.length} horario${freeSlots.length === 1 ? "" : "s"} libre${freeSlots.length === 1 ? "" : "s"} para ${formatDurationLabel(defaultDuration)}`
                      : "Horarios libres no disponibles"}
                  </summary>
                  <div>
                    {availability.status === "ready" && freeSlots.map((slot) => (
                      <button type="button" key={slot.timeSlot} onClick={() => setModal({ mode: "create", initialTimeSlot: slot.timeSlot, initialDateKey: dayKey })}>
                        {formatBusinessTime(slot.timeSlot)}
                      </button>
                    ))}
                    {availability.status === "ready" && freeSlots.length === 0 && <span>Sin cupos para {formatDurationLabel(defaultDuration)}</span>}
                    {availability.status !== "ready" && <span>La creación y reprogramación quedan deshabilitadas hasta verificar disponibilidad.</span>}
                  </div>
                </details>
              </article>
            );
          })}
      </div>

      {modal && (
        <AdminBookingModal
          mode={modal.mode}
          booking={modal.booking}
          initialTimeSlot={modal.initialTimeSlot}
          initialDateKey={modal.initialDateKey}
          slotDurationMinutes={slotDurationMinutes}
          durationOptions={durationOptions}
          authConfig={authConfig}
          onClose={() => setModal(null)}
          onSubmit={submitModal}
          onConflict={refreshAfterConflict}
        />
      )}
    </section>
  );
};

export default AgendaView;
