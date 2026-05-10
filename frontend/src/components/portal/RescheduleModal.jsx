import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import { addMinutes, format, isSameDay, setHours, setMinutes } from "date-fns";
import es from "date-fns/locale/es";
import { FaArrowRight, FaCalendarAlt, FaChevronLeft, FaChevronRight, FaClock, FaTimes } from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
  formatDurationOptionLabel,
  formatDurationVoiceLabel,
  getBookingApiMessage,
  getResponsibleRelationshipDisplay,
  isAdultBooking,
} from "../../utils/bookingFormatters";
import { primeVoicePlayback, speakAlert } from "../../utils/neuroToast";
import { rescheduleBooking, fetchAvailability } from "../../api/bookingApi";
import "./RescheduleModal.css";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };

const DURATION_QUICK_BASE = [0.5, 1, 1.5, 2, 2.5, 3];

const RescheduleModal = ({ editingBooking, onClose, onSuccess, showToast }) => {
  const dialogRef = useRef(null);
  const [newDate, setNewDate] = useState(new Date(editingBooking.timeSlot));
  const [newDuration, setNewDuration] = useState(editingBooking.duration);
  const [existingBookingsForBlock, setExistingBookingsForBlock] = useState([]);

  // Body scroll lock + focus
  useEffect(() => {
    dialogRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Load availability
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
          speak: "No pude actualizar la disponibilidad ahora mismo. Probá de nuevo en unos segundos.",
          voiceOptions: PORTAL_VOICE_OPTIONS,
        });
      });
  }, [editingBooking._id, showToast]);

  // Derived values
  const currentSlotDate = new Date(editingBooking.timeSlot);
  const currentEndDate = addMinutes(currentSlotDate, Number(editingBooking.duration || 1) * 60);
  const newEndDate = new Date(newDate.getTime() + Number(newDuration || 0) * 60 * 60 * 1000);

  const hasValidDuration = Number.isFinite(Number(newDuration)) && Number(newDuration) >= 0.5;
  const hasRescheduleChanges =
    currentSlotDate.getTime() !== newDate.getTime() ||
    Number(editingBooking.duration) !== Number(newDuration);

  const durationQuickOptions = Array.from(
    new Set([...DURATION_QUICK_BASE, Number(editingBooking.duration)]),
  )
    .filter((v) => Number.isFinite(v) && v >= 0.5 && v <= 3)
    .sort((a, b) => a - b);

  const maxTime = setHours(setMinutes(new Date(), 0), 22);

  const getExcludedTimes = (date) => {
    const excluded = [];
    existingBookingsForBlock
      .filter((b) => isSameDay(new Date(b.timeSlot), date))
      .forEach((b) => {
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
    const didStartVoice = primeVoicePlayback({ message: guidance, voiceOptions: PORTAL_VOICE_OPTIONS });
    if (!didStartVoice) speakAlert(guidance, PORTAL_VOICE_OPTIONS);
  };

  const handleRescheduleDateChange = (date) => {
    if (!date) return;
    if (date.getTime() === newDate?.getTime?.()) {
      setNewDate(new Date(editingBooking.timeSlot));
      speakPortalGuidance(
        `Volvimos al horario actual: ${format(new Date(editingBooking.timeSlot), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}.`,
      );
      return;
    }
    setNewDate(date);
    speakPortalGuidance(
      `Nueva propuesta: ${format(date, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}.`,
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
    speakPortalGuidance(`Duración propuesta: ${formatDurationVoiceLabel(nextDuration)}.`);
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
        if (recipient) return " La reserva ya quedó actualizada.";
        return " Podés encontrarla desde Mis Turnos.";
      })();
      showToast(`Turno reprogramado con éxito.${followUp}`, "success", {
        title: "Reprogramación confirmada",
        speak: `Listo. El turno fue reprogramado para ${format(newDate, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}, con una duración de ${formatDurationVoiceLabel(durationNumber)}.`,
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
      onSuccess();
    } catch (error) {
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo reprogramar",
        speak: "No pude guardar la reprogramación. Revisá tu conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  const adultBooking = isAdultBooking(editingBooking);

  return createPortal(
    <div className="reschedule-overlay" onClick={onClose} aria-hidden="false">
      <div
        ref={dialogRef}
        className="reschedule-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="reschedule-header">
          <div className="reschedule-header-icon" aria-hidden="true">
            <FaCalendarAlt />
          </div>
          <div className="reschedule-header-text">
            <h3 id="reschedule-title" className="reschedule-title">Reprogramar turno</h3>
            <p className="reschedule-subtitle">#{editingBooking.bookingCode} · {editingBooking.studentName}</p>
          </div>
          <button
            type="button"
            className="reschedule-close-btn"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        {/* Comparison strip */}
        <div className="reschedule-comparison">
          <div className="reschedule-slot reschedule-slot--current">
            <span className="reschedule-slot-label">Actual</span>
            <strong className="reschedule-slot-date">{formatDateLong(editingBooking.timeSlot)}</strong>
            <span className="reschedule-slot-time">
              {formatTime(editingBooking.timeSlot)} – {formatTime(editingBooking.endTime)} h
            </span>
          </div>
          <div className="reschedule-arrow" aria-hidden="true">
            <FaArrowRight />
          </div>
          <div className={`reschedule-slot reschedule-slot--new${hasRescheduleChanges ? " reschedule-slot--changed" : ""}`}>
            <span className="reschedule-slot-label">Propuesta</span>
            <strong className="reschedule-slot-date">{formatDateLong(newDate)}</strong>
            <span className="reschedule-slot-time">
              {formatTime(newDate)} – {formatTime(newEndDate)} h
            </span>
          </div>
        </div>

        {/* Body: 2-column grid */}
        <div className="reschedule-body">
          {/* Left: calendar */}
          <section className="reschedule-calendar-col">
            <label className="reschedule-col-label" id="new-date-label">
              <FaCalendarAlt aria-hidden="true" /> Nuevo día y hora
            </label>
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
              dateFormat="dd 'de' MMMM - HH:mm 'h'"
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
              className="reschedule-datepicker-input"
              inline
              ariaLabelledBy="new-date-label"
            />
          </section>

          {/* Right: duration + facts */}
          <section className="reschedule-right-col">
            {/* Duration */}
            <div className="reschedule-duration-section">
              <label className="reschedule-col-label">
                <FaClock aria-hidden="true" /> Duración
              </label>
              <div
                className="reschedule-duration-grid"
                role="list"
                aria-label="Opciones de duración"
              >
                {durationQuickOptions.map((duration) => {
                  const isSelected = Number(newDuration) === duration;
                  return (
                    <button
                      key={duration}
                      type="button"
                      role="listitem"
                      className={`reschedule-duration-btn${isSelected ? " reschedule-duration-btn--active" : ""}`}
                      onClick={() => handleDurationQuickToggle(duration)}
                      aria-pressed={isSelected}
                    >
                      {formatDurationOptionLabel(duration)}
                    </button>
                  );
                })}
              </div>
              <div className="reschedule-duration-manual">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="3"
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  className="reschedule-duration-input"
                  aria-label="Duración en horas"
                />
                <div className="reschedule-end-time">
                  <span>Finaliza</span>
                  <strong>{formatTime(newEndDate)} h</strong>
                </div>
              </div>
            </div>

            {/* Facts */}
            <dl className="reschedule-facts">
              <div className="reschedule-fact">
                <dt>Alumno</dt>
                <dd>{editingBooking.studentName}</dd>
              </div>
              {!adultBooking && (
                <div className="reschedule-fact">
                  <dt>Parentesco</dt>
                  <dd>{getResponsibleRelationshipDisplay(editingBooking)}</dd>
                </div>
              )}
              <div className="reschedule-fact">
                <dt>Duración actual</dt>
                <dd>{formatDurationOptionLabel(editingBooking.duration)}</dd>
              </div>
              <div className="reschedule-fact">
                <dt>Duración nueva</dt>
                <dd>{formatDurationOptionLabel(newDuration)}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Footer */}
        <div className="reschedule-footer">
          <p className="reschedule-footer-note">
            {hasRescheduleChanges
              ? "Propuesta lista para confirmar."
              : "Cambiá fecha, hora o duración para habilitar la confirmación."}
          </p>
          <div className="reschedule-footer-actions">
            <button type="button" className="reschedule-btn-cancel" onClick={onClose}>
              Mantener actual
            </button>
            <button
              type="button"
              className="reschedule-btn-confirm"
              onClick={handleReschedule}
              disabled={!newDate || !hasValidDuration || !hasRescheduleChanges}
            >
              Confirmar cambio
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RescheduleModal;
