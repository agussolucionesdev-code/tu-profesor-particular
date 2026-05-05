import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import { addMinutes, format, isSameDay, setHours, setMinutes } from "date-fns";
import es from "date-fns/locale/es";
import {
  FaArrowRight,
  FaCalendarAlt,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from "react-icons/fa";
import {
  formatDurationVoiceLabel,
  getBookingApiMessage,
  getResponsibleRelationshipDisplay,
} from "../../utils/bookingFormatters";
import { primeVoicePlayback, speakAlert } from "../../utils/neuroToast";
import { rescheduleBooking, fetchAvailability } from "../../api/bookingApi";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };

const formatDateLong = (value) =>
  new Date(value).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const formatTime = (value) =>
  new Date(value).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const formatDurationLabel = (value) => {
  const hours = Number(value);
  if (!Number.isFinite(hours) || hours <= 0) return "--";
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (wholeHours > 0 && minutes > 0) return `${wholeHours} h ${minutes} min`;
  if (wholeHours > 0) return `${wholeHours} h`;
  return `${minutes} min`;
};

const RescheduleModal = ({ editingBooking, onClose, onSuccess, showToast }) => {
  const dialogRef = useRef(null);
  const [newDate, setNewDate] = useState(new Date(editingBooking.timeSlot));
  const [newDuration, setNewDuration] = useState(editingBooking.duration);
  const [existingBookingsForBlock, setExistingBookingsForBlock] = useState([]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load availability on mount
  useEffect(() => {
    fetchAvailability()
      .then((res) => {
        const active = res.data.data.filter(
          (b) => b.status !== "Cancelado" && b._id !== editingBooking._id,
        );
        setExistingBookingsForBlock(active);
      })
      .catch((error) => {
        console.error(error);
        showToast(getBookingApiMessage(error), "warning", {
          title: "Disponibilidad pendiente",
          speak:
            "No pude actualizar la disponibilidad ahora mismo. Probá de nuevo en unos segundos.",
          voiceOptions: PORTAL_VOICE_OPTIONS,
        });
      });
  }, [editingBooking._id, showToast]);

  const newEndDate = new Date(
    newDate.getTime() + Number(newDuration || 0) * 60 * 60 * 1000,
  );
  const currentSlotDate = new Date(editingBooking.timeSlot);
  const currentEndDate = addMinutes(
    currentSlotDate,
    Number(editingBooking.duration || 1) * 60,
  );
  const hasValidDuration =
    Number.isFinite(Number(newDuration)) && Number(newDuration) >= 0.5;
  const hasRescheduleChanges =
    currentSlotDate.getTime() !== newDate.getTime() ||
    Number(editingBooking.duration) !== Number(newDuration);
  const durationQuickOptions = Array.from(
    new Set([
      0.5,
      1,
      1.5,
      2,
      3,
      4,
      Number(editingBooking.duration),
      Number(newDuration),
    ]),
  )
    .filter((v) => Number.isFinite(v) && v >= 0.5 && v <= 5)
    .sort((a, b) => a - b);
  const keepsSameStart = currentSlotDate.getTime() === newDate.getTime();
  const keepsSameDay = isSameDay(currentSlotDate, newDate);
  const rescheduleChangeTitle = !hasRescheduleChanges
    ? "Todavía no cambiaste el turno."
    : keepsSameStart
      ? "Mantenés el mismo inicio y ajustás la duración."
      : keepsSameDay
        ? "Mantenés el mismo día y cambiás el horario."
        : "Estás moviendo la clase a otro día.";
  const rescheduleChangeCopy = !hasRescheduleChanges
    ? "La propuesta nueva replica el turno actual. Cambiá fecha, hora o duración para habilitar la confirmación."
    : keepsSameStart
      ? `Mantenés el inicio a las ${formatTime(newDate)} hs. La clase pasaría de terminar a las ${formatTime(currentEndDate)} hs a terminar a las ${formatTime(newEndDate)} hs, con una duración final de ${formatDurationLabel(newDuration)}.`
      : `Pasarías de ${formatDateLong(editingBooking.timeSlot)} a las ${formatTime(editingBooking.timeSlot)} hs a ${formatDateLong(newDate)} a las ${formatTime(newDate)} hs. Duración final: ${formatDurationLabel(newDuration)}.`;

  const maxTime = setHours(setMinutes(new Date(), 0), 22);

  const getExcludedTimes = (date) => {
    const excluded = [];
    const bookingsOnDay = existingBookingsForBlock.filter((b) =>
      isSameDay(new Date(b.timeSlot), date),
    );
    bookingsOnDay.forEach((b) => {
      let current = new Date(b.timeSlot);
      const end = new Date(b.endTime);
      while (current < end) {
        excluded.push(new Date(current));
        current = addMinutes(current, 30);
      }
    });
    return excluded;
  };

  const calculateMinTime = (date) => {
    const now = new Date();
    const openingTime = setHours(setMinutes(date, 0), 7);
    if (isSameDay(date, now)) {
      const buffer = addMinutes(now, 60);
      return buffer > openingTime ? buffer : openingTime;
    }
    return openingTime;
  };

  const speakPortalGuidance = (guidance) => {
    if (!guidance) return;
    const didStartVoice = primeVoicePlayback({
      message: guidance,
      voiceOptions: PORTAL_VOICE_OPTIONS,
    });
    if (!didStartVoice) {
      speakAlert(guidance, PORTAL_VOICE_OPTIONS);
    }
  };

  const handleRescheduleDateChange = (date) => {
    if (!date) return;
    const selectedTime = date.getTime();
    const currentTime = newDate?.getTime?.();
    if (currentTime === selectedTime) {
      setNewDate(new Date(editingBooking.timeSlot));
      speakPortalGuidance(
        `Volvimos al horario actual: ${format(new Date(editingBooking.timeSlot), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}. Todo sigue como estaba.`,
      );
      return;
    }
    setNewDate(date);
    speakPortalGuidance(
      `Nueva propuesta: ${format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}. Bien, ya la estoy comparando con tu turno actual.`,
    );
  };

  const handleDurationQuickToggle = (duration) => {
    const currentDuration = Number(newDuration);
    const originalDuration = Number(editingBooking.duration);
    const nextDuration =
      currentDuration === duration && originalDuration !== duration
        ? originalDuration || 1
        : duration;
    setNewDuration(nextDuration);
    speakPortalGuidance(
      `Duración propuesta: ${formatDurationVoiceLabel(nextDuration)}. Abajo te muestro cómo queda el horario final.`,
    );
  };

  const handleReschedule = async () => {
    primeVoicePlayback();
    if (!newDate) return showToast("Seleccioná una fecha válida", "error");
    const durationNumber = Number(newDuration);
    if (!Number.isFinite(durationNumber) || durationNumber < 0.5) {
      return showToast("La duración mínima es de 30 minutos.", "error");
    }
    const day = String(newDate.getDate()).padStart(2, "0");
    const month = String(newDate.getMonth() + 1).padStart(2, "0");
    const year = newDate.getFullYear();
    const hours = String(newDate.getHours()).padStart(2, "0");
    const minutes = String(newDate.getMinutes()).padStart(2, "0");
    const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;
    try {
      const response = await rescheduleBooking({
        bookingCode: editingBooking.bookingCode,
        newTimeSlot: formattedDate,
        newDuration: durationNumber,
      });
      const followUp = (() => {
        const n = response.data.notifications;
        const sent = n?.client?.sent ?? n?.clientEmailSent ?? false;
        const recipient = n?.client?.recipient || n?.clientRecipient || "";
        if (sent && recipient) return ` También enviamos el detalle a ${recipient}.`;
        if (recipient)
          return " La reserva ya quedó actualizada. Si el correo tarda, volvé a entrar desde Mis Turnos.";
        return " Podés volver a encontrarla desde Mis Turnos con tu código, email o número de teléfono.";
      })();
      showToast(`Turno reprogramado con éxito.${followUp}`, "success", {
        title: "Reprogramación confirmada",
        detail:
          "La nueva fecha se guardó y el turno ya queda listo para volver a gestionarse.",
        speak: `Listo. El turno fue reprogramado con éxito para ${format(newDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}, con una duración de ${formatDurationVoiceLabel(durationNumber)}. Quedó guardado.`,
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
      onSuccess();
    } catch (error) {
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo reprogramar",
        speak:
          "No pude guardar la reprogramación en este momento. Revisá tu conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  return (
    <div
      className="modal-overlay reschedule-overlay"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="modal-box premium-modal reschedule-modal-box"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        tabIndex={-1}
      >
        <div className="modal-header-premium reschedule-header">
          <div className="reschedule-header-copy">
            <span className="modal-kicker">Mover clase con la misma claridad</span>
            <h3 id="reschedule-title">
              <FaCalendarAlt /> Reprogramar turno
            </h3>
            <p>
              Te guiamos para comparar el turno actual con una nueva propuesta y
              confirmar solo cuando el cambio te quede realmente cómodo.
            </p>
          </div>
          <div className="reschedule-steps-strip" aria-label="Pasos para reprogramar">
            <span className="reschedule-step-chip active">1. Compará</span>
            <span className="reschedule-step-chip active">2. Elegí día y hora</span>
            <span className="reschedule-step-chip active">3. Ajustá duración</span>
          </div>
        </div>

        <div className="modal-body reschedule-modal-body">
          <div className="reschedule-modal-grid">
            <section className="reschedule-overview-panel">
              <div className="reschedule-panel-intro">
                <span className="reschedule-panel-kicker">Tu punto de partida</span>
                <strong>Ves antes y después sin tener que interpretar nada.</strong>
                <p>
                  Si todavía no elegiste un cambio, la propuesta nueva replica
                  el turno actual para que compares con claridad.
                </p>
              </div>

              <div className="reschedule-comparison reschedule-comparison-modern">
                <div className="date-box old">
                  <span>Actual</span>
                  <strong>{formatDateLong(editingBooking.timeSlot)}</strong>
                  <small>
                    {formatTime(editingBooking.timeSlot)} -{" "}
                    {formatTime(editingBooking.endTime)} hs
                  </small>
                </div>
                <div className="arrow-box">
                  <FaArrowRight />
                </div>
                <div className="date-box new">
                  <span>Propuesta nueva</span>
                  <strong>{formatDateLong(newDate)}</strong>
                  <small>
                    {formatTime(newDate)} - {formatTime(newEndDate)} hs
                  </small>
                </div>
              </div>

              <div className="change-preview change-preview-rich">
                <span className="reschedule-panel-kicker">Qué va a pasar si confirmás</span>
                <strong>{rescheduleChangeTitle}</strong>
                <span>{rescheduleChangeCopy}</span>
              </div>

              <div className="reschedule-mini-facts reschedule-status-grid">
                <article>
                  <span>Código</span>
                  <strong>#{editingBooking.bookingCode}</strong>
                </article>
                <article>
                  <span>Alumno</span>
                  <strong>{editingBooking.studentName}</strong>
                </article>
                <article>
                  <span>Parentesco</span>
                  <strong>{getResponsibleRelationshipDisplay(editingBooking)}</strong>
                </article>
                <article>
                  <span>Duración actual</span>
                  <strong>{formatDurationLabel(editingBooking.duration)}</strong>
                </article>
                <article>
                  <span>Duración nueva</span>
                  <strong>{formatDurationLabel(newDuration)}</strong>
                </article>
              </div>
            </section>

            <section className="reschedule-editor-panel">
              <div className="reschedule-editor-head">
                <span className="reschedule-panel-kicker">Agenda disponible</span>
                <strong>Seleccioná un nuevo día, una nueva hora y revisá cómo queda.</strong>
                <p>
                  Los horarios ocupados o ya pasados quedan bloqueados para que
                  no tengas que adivinar.
                </p>
              </div>

              <div className="reschedule-selection-strip">
                <article className="reschedule-selection-pill">
                  <span>Día elegido</span>
                  <strong>{formatDateLong(newDate)}</strong>
                </article>
                <article className="reschedule-selection-pill">
                  <span>Horario elegido</span>
                  <strong>{formatTime(newDate)} hs</strong>
                </article>
                <article className="reschedule-selection-pill accent">
                  <span>Finaliza</span>
                  <strong>{formatTime(newEndDate)} hs</strong>
                </article>
              </div>

              <div className="input-group-modal calendar-panel calendar-panel-premium">
                <div className="calendar-panel-head">
                  <label id="new-date-label">Agenda disponible</label>
                  <span className="calendar-panel-helper">
                    1. Elegí el día. 2. Elegí la hora. Si volvés a tocar exactamente
                    la misma selección, recuperás el horario actual.
                  </span>
                </div>
                <DatePicker
                  selected={newDate}
                  onChange={handleRescheduleDateChange}
                  showTimeSelect
                  timeCaption="Hora"
                  timeIntervals={30}
                  minTime={calculateMinTime(newDate)}
                  maxTime={maxTime}
                  minDate={new Date()}
                  excludeTimes={getExcludedTimes(newDate)}
                  dateFormat="dd 'de' MMMM - HH:mm 'hs'"
                  formatWeekDay={(nameOfDay) => nameOfDay.slice(0, 2)}
                  calendarClassName="reschedule-datepicker"
                  renderCustomHeader={({
                    date,
                    decreaseMonth,
                    increaseMonth,
                    prevMonthButtonDisabled,
                    nextMonthButtonDisabled,
                  }) => (
                    <div className="reschedule-datepicker-header">
                      <button
                        type="button"
                        className="reschedule-month-nav"
                        onClick={decreaseMonth}
                        disabled={prevMonthButtonDisabled}
                        aria-label="Mes anterior"
                      >
                        <FaChevronLeft />
                      </button>
                      <strong>{format(date, "MMMM yyyy", { locale: es })}</strong>
                      <button
                        type="button"
                        className="reschedule-month-nav"
                        onClick={increaseMonth}
                        disabled={nextMonthButtonDisabled}
                        aria-label="Mes siguiente"
                      >
                        <FaChevronRight />
                      </button>
                    </div>
                  )}
                  locale="es"
                  className="input-calendar-modal premium-input"
                  inline
                  ariaLabelledBy="new-date-label"
                />
              </div>

              <div className="input-group-modal duration-row duration-panel duration-panel-premium">
                <div className="duration-panel-head">
                  <label>
                    <FaClock /> Duración de la clase
                  </label>
                  <span>
                    Podés elegir bloques de 30 minutos y volver al valor actual
                    tocando otra vez la opción activa.
                  </span>
                </div>

                <div
                  className="duration-quick-grid"
                  role="list"
                  aria-label="Duraciones sugeridas"
                >
                  {durationQuickOptions.map((duration) => {
                    const isSelected = Number(newDuration) === duration;
                    return (
                      <button
                        key={duration}
                        type="button"
                        className={`duration-quick-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => handleDurationQuickToggle(duration)}
                        aria-pressed={isSelected}
                      >
                        {formatDurationLabel(duration)}
                      </button>
                    );
                  })}
                </div>

                <div className="duration-manual-row">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="5"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    className="input-duration-modal premium-input"
                    aria-label="Duración del nuevo turno en horas"
                  />
                  <div className="duration-preview-card">
                    <span>Horario final</span>
                    <strong>{formatTime(newEndDate)} hs</strong>
                  </div>
                </div>

                <small className="duration-preview">
                  El cambio solo se guarda cuando confirmás. Si preferís dejarlo
                  igual, podés mantener el turno actual.
                </small>
              </div>
            </section>
          </div>
        </div>

        <div className="modal-footer reschedule-footer">
          <div className="reschedule-footer-note">
            {hasRescheduleChanges
              ? "La nueva propuesta ya está lista para confirmarse."
              : "Hacé un cambio en la fecha, la hora o la duración para habilitar la confirmación."}
          </div>
          <button onClick={onClose} className="btn-modal cancel">
            Mantener actual
          </button>
          <button
            onClick={handleReschedule}
            className="btn-modal confirm"
            disabled={!newDate || !hasValidDuration || !hasRescheduleChanges}
          >
            Confirmar cambio
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
