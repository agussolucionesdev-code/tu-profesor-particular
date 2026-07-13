import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import { addMinutes, format, isSameDay } from "date-fns";
import es from "date-fns/locale/es";
import { FaCalendarAlt, FaChevronLeft, FaChevronRight, FaClock, FaTimes } from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
  formatDurationOptionLabel,
  formatDurationVoiceLabel,
  getBookingApiMessage,
} from "../../utils/bookingFormatters";
import { primeVoicePlayback, speakAlert } from "../../utils/neuroToast";
import { rescheduleBooking, fetchAvailability } from "../../api/bookingApi";
import { createIdempotencyKey } from "../../utils/idempotencyKey";
import { selectSlotsForDate } from "../../utils/availabilitySlots";
import "./RescheduleModal.css";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };
const DURATION_QUICK_BASE = [0.5, 1, 1.5, 2, 2.5, 3];

const PERIODS = [
  { id: "morning", label: "Mañana", from: 7, to: 13 },
  { id: "afternoon", label: "Tarde", from: 13, to: 19 },
  { id: "night", label: "Noche", from: 19, to: 22 },
];

const RescheduleModal = ({ editingBooking, managementToken, onClose, onSuccess, showToast }) => {
  const dialogRef = useRef(null);
  const rescheduleAttemptRef = useRef(null);

  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date(editingBooking.timeSlot);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedTime, setSelectedTime] = useState(new Date(editingBooking.timeSlot));
  const [newDuration, setNewDuration] = useState(editingBooking.duration);
  const [existingBookingsForBlock, setExistingBookingsForBlock] = useState([]);
  const [backendSlots, setBackendSlots] = useState(undefined);
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState(undefined);

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
        setBackendSlots(Array.isArray(res.data.slots) ? res.data.slots : undefined);
        setAvailabilityTimeZone(res.data.schedule?.timeZone);
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

  // Derive full datetime from day + selected time slot
  const newDate = useMemo(() => {
    if (!selectedTime) return null;
    const combined = new Date(selectedDay);
    combined.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    return combined;
  }, [selectedDay, selectedTime]);

  const currentSlotDate = new Date(editingBooking.timeSlot);
  const newEndDate = newDate
    ? new Date(newDate.getTime() + Number(newDuration || 0) * 60 * 60 * 1000)
    : null;

  const hasValidDuration = Number.isFinite(Number(newDuration)) && Number(newDuration) >= 0.5;
  const hasRescheduleChanges = !!(
    newDate &&
    (currentSlotDate.getTime() !== newDate.getTime() ||
      Number(editingBooking.duration) !== Number(newDuration))
  );

  const durationQuickOptions = Array.from(
    new Set([...DURATION_QUICK_BASE, Number(editingBooking.duration)]),
  )
    .filter((v) => Number.isFinite(v) && v >= 0.5 && v <= 3)
    .sort((a, b) => a - b);

  // Generate 30-min slots for selected day, mark occupied/past
  const legacySlots = useMemo(() => {
    const now = new Date();
    const excluded = new Set();
    existingBookingsForBlock
      .filter((b) => isSameDay(new Date(b.timeSlot), selectedDay))
      .forEach((b) => {
        let cur = new Date(b.timeSlot);
        const end = new Date(b.endTime);
        while (cur < end) {
          excluded.add(cur.getTime());
          cur = addMinutes(cur, 30);
        }
      });

    const result = [];
    for (let h = 7; h < 22; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slot = new Date(selectedDay);
        slot.setHours(h, m, 0, 0);
        const isPast = isSameDay(selectedDay, now) && slot <= addMinutes(now, 60);
        result.push({ time: slot, disabled: excluded.has(slot.getTime()) || isPast });
      }
    }
    return result;
  }, [selectedDay, existingBookingsForBlock]);

  const slots = useMemo(
    () =>
      selectSlotsForDate({
        selectedDate: selectedDay,
        backendSlots,
        fallbackSlots: legacySlots,
        timeZone: availabilityTimeZone,
      }).map((slot) => ({ time: slot.timeObj, disabled: slot.isOccupied })),
    [selectedDay, backendSlots, legacySlots, availabilityTimeZone],
  );

  // Group slots by period, skip empty periods
  const slotsByPeriod = useMemo(
    () =>
      PERIODS.map((p) => ({
        ...p,
        slots: slots.filter((s) => {
          const h = s.time.getHours();
          return h >= p.from && h < p.to;
        }),
      })).filter((p) => p.slots.length > 0),
    [slots],
  );

  const speakPortalGuidance = (guidance) => {
    if (!guidance) return;
    const ok = primeVoicePlayback({ message: guidance, voiceOptions: PORTAL_VOICE_OPTIONS });
    if (!ok) speakAlert(guidance, PORTAL_VOICE_OPTIONS);
  };

  const handleDayChange = (date) => {
    if (!date) return;
    const dayOnly = new Date(date);
    dayOnly.setHours(0, 0, 0, 0);
    setSelectedDay(dayOnly);
    setSelectedTime(null);
    speakPortalGuidance(
      `Día seleccionado: ${format(dayOnly, "EEEE d 'de' MMMM", { locale: es })}. Ahora elegí el horario.`,
    );
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
    speakPortalGuidance(`Horario seleccionado: ${format(time, "HH:mm")}.`);
  };

  const handleDurationToggle = (duration) => {
    const currentDuration = Number(newDuration);
    const originalDuration = Number(editingBooking.duration);
    const next =
      currentDuration === duration && originalDuration !== duration
        ? originalDuration || 1
        : duration;
    setNewDuration(next);
    speakPortalGuidance(`Duración: ${formatDurationVoiceLabel(next)}.`);
  };

  const handleReschedule = async () => {
    primeVoicePlayback();
    if (!newDate) return showToast("Seleccioná un día y horario.", "error");
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
      const reschedulePayload = {
        bookingCode: editingBooking.bookingCode,
        newTimeSlot: formattedDate,
        newDuration: durationNumber,
      };
      const requestFingerprint = JSON.stringify(reschedulePayload);
      if (rescheduleAttemptRef.current?.fingerprint !== requestFingerprint) {
        rescheduleAttemptRef.current = {
          fingerprint: requestFingerprint,
          key: createIdempotencyKey(),
        };
      }
      const response = await rescheduleBooking(
        reschedulePayload,
        managementToken,
        rescheduleAttemptRef.current.key,
      );
      rescheduleAttemptRef.current = null;
      const followUp = (() => {
        const n = response.data.notifications;
        const sent = n?.client?.sent ?? n?.clientEmailSent ?? false;
        const recipient = n?.client?.recipient || n?.clientRecipient || "";
        if (sent && recipient) return ` También enviamos el detalle a ${recipient}.`;
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
            <h3 id="reschedule-title" className="reschedule-title">
              Reprogramar turno
            </h3>
            <p className="reschedule-subtitle">
              #{editingBooking.bookingCode} · {editingBooking.studentName}
            </p>
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

        {/* Current slot — single line */}
        <div className="reschedule-current-line">
          <span className="reschedule-current-label">Actual</span>
          <span className="reschedule-current-info">
            {formatDateLong(editingBooking.timeSlot)} · {formatTime(editingBooking.timeSlot)} –{" "}
            {formatTime(editingBooking.endTime)} h
          </span>
        </div>

        {/* Body: calendar left, slots + duration right */}
        <div className="reschedule-body">
          {/* Left: day picker */}
          <section className="reschedule-calendar-col">
            <div className="reschedule-col-label" id="new-date-label">
              <FaCalendarAlt aria-hidden="true" /> Nuevo día
            </div>
            <DatePicker
              selected={selectedDay}
              onChange={handleDayChange}
              minDate={new Date()}
              locale="es"
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
              inline
              ariaLabelledBy="new-date-label"
            />
          </section>

          {/* Right: slot grid + duration */}
          <section className="reschedule-right-col">
            {/* Slot grid */}
            <div className="reschedule-slots-section">
              <div className="reschedule-col-label">
                <FaClock aria-hidden="true" /> Horario disponible
              </div>
              {slotsByPeriod.map((period) => (
                <div key={period.id} className="reschedule-period">
                  <h4 className="reschedule-period-label">{period.label}</h4>
                  <div className="reschedule-slots-grid">
                    {period.slots.map((slot) => {
                      const isSelected =
                        selectedTime?.getTime() === slot.time.getTime();
                      return (
                        <button
                          key={slot.time.getTime()}
                          type="button"
                          disabled={slot.disabled}
                          className={`reschedule-slot-btn${slot.disabled ? " reschedule-slot-btn--disabled" : ""}${isSelected ? " reschedule-slot-btn--selected" : ""}`}
                          onClick={() => handleTimeSelect(slot.time)}
                          aria-pressed={isSelected}
                          aria-label={`${format(slot.time, "HH:mm")} ${slot.disabled ? "no disponible" : isSelected ? "seleccionado" : "disponible"}`}
                        >
                          {format(slot.time, "HH:mm")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Duration */}
            <div className="reschedule-duration-section">
              <div className="reschedule-col-label">
                <FaClock aria-hidden="true" /> Duración
              </div>
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
                      onClick={() => handleDurationToggle(duration)}
                      aria-pressed={isSelected}
                    >
                      {formatDurationOptionLabel(duration)}
                    </button>
                  );
                })}
              </div>
              {newEndDate && (
                <div className="reschedule-end-time">
                  <span>Finaliza</span>
                  <strong>{formatTime(newEndDate)} h</strong>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="reschedule-footer">
          <p className="reschedule-footer-note">
            {!selectedTime
              ? "Elegí un horario para habilitar la confirmación."
              : hasRescheduleChanges
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
