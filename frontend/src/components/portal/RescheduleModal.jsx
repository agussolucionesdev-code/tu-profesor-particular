import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import DatePicker from "react-datepicker";
import { format } from "date-fns";
/* Import NOMBRADO. Con `import es from "date-fns/locale/es"` —como estaba— en
   date-fns 4 llega `undefined`, el datepicker cae en su idioma por defecto y el
   calendario mostraba "Su Mo Tu We Th Fr Sa" en un producto en castellano. */
import { es } from "date-fns/locale";
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
import {
  availabilityRequestParams,
  isSelectedTimeAvailable,
  parsePublicAvailabilityResponse,
  selectSlotsForDate,
} from "../../utils/availabilitySlots";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import "./RescheduleModal.css";

const PORTAL_VOICE_OPTIONS = { rate: 0.86, pitch: 0.98, volume: 0.9 };
const DURATION_QUICK_BASE = [0.5, 1, 1.5, 2, 2.5, 3];

/* Los bordes cubren el día COMPLETO (0 a 24) a propósito: con la noche cortada
   en 22, un turno de las 22:00 quedaba fuera de las tres franjas y no se podía
   elegir para reprogramar, aunque el servidor lo ofreciera. */
const PERIODS = [
  { id: "morning", label: "Mañana", from: 0, to: 13 },
  { id: "afternoon", label: "Tarde", from: 13, to: 19 },
  { id: "night", label: "Noche", from: 19, to: 24 },
];

const RescheduleModal = ({ editingBooking, managementToken, onClose, onSuccess, showToast }) => {
  const dialogRef = useFocusTrap(true);
  const rescheduleAttemptRef = useRef(null);

  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date(editingBooking.timeSlot);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedTime, setSelectedTime] = useState(new Date(editingBooking.timeSlot));
  const [newDuration, setNewDuration] = useState(editingBooking.duration);
  const [backendSlots, setBackendSlots] = useState(undefined);
  const [availabilityTimeZone, setAvailabilityTimeZone] = useState(undefined);
  const [availabilityMinDate, setAvailabilityMinDate] = useState(null);
  const [availabilityMaxDate, setAvailabilityMaxDate] = useState(null);
  const [availabilityStatus, setAvailabilityStatus] = useState("loading");
  const [resolvedAvailabilityDuration, setResolvedAvailabilityDuration] = useState(null);
  const [availabilityRequestVersion, setAvailabilityRequestVersion] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Body scroll lock. Focus containment and restoration use the shared dialog hook.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && !isSubmitting) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSubmitting, onClose]);

  // Load availability
  useEffect(() => {
    let isCurrentRequest = true;
    const requestParams = availabilityRequestParams(newDuration);
    fetchAvailability(requestParams, managementToken)
      .then((res) => {
        const parsed = parsePublicAvailabilityResponse(res.data);
        if (!isCurrentRequest) return;
        const responseSlots = parsed.slots;
        setBackendSlots(responseSlots);
        setAvailabilityTimeZone(parsed.schedule.timeZone);
        setAvailabilityMinDate(parsed.minDate);
        setAvailabilityMaxDate(parsed.maxDate);
        setResolvedAvailabilityDuration(requestParams?.duration ?? null);
        setAvailabilityStatus("ready");
        setSelectedTime((currentTime) =>
          isSelectedTimeAvailable({
            selectedTime: currentTime,
            backendSlots: responseSlots,
          })
            ? currentTime
            : null,
        );
      })
      .catch((error) => {
        if (!isCurrentRequest) return;
        console.error(error);
        setBackendSlots(undefined);
        setAvailabilityTimeZone(undefined);
        setAvailabilityMinDate(null);
        setAvailabilityMaxDate(null);
        setResolvedAvailabilityDuration(requestParams?.duration ?? null);
        setAvailabilityStatus("error");
        setSelectedTime(null);
        showToast(getBookingApiMessage(error), "warning", {
          title: "Disponibilidad pendiente",
          speak: "No pude actualizar la disponibilidad ahora mismo. Probá de nuevo en unos segundos.",
          voiceOptions: PORTAL_VOICE_OPTIONS,
        });
      });
    return () => {
      isCurrentRequest = false;
    };
  }, [availabilityRequestVersion, editingBooking.duration, managementToken, newDuration, showToast]);

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

  const requestedAvailabilityDuration = availabilityRequestParams(newDuration)?.duration ?? null;
  const effectiveAvailabilityStatus =
    resolvedAvailabilityDuration === requestedAvailabilityDuration
      ? availabilityStatus
      : "loading";

  const slots = useMemo(
    () =>
      effectiveAvailabilityStatus === "ready"
        ? selectSlotsForDate({
          selectedDate: selectedDay,
          backendSlots,
          timeZone: availabilityTimeZone,
        }).map((slot) => ({
          time: slot.timeObj,
          disabled: slot.isOccupied,
        }))
        : [],
    [effectiveAvailabilityStatus, selectedDay, backendSlots, availabilityTimeZone],
  );

  // Group slots by period, skip empty periods
  const slotsByPeriod = useMemo(
    () =>
      // Red de seguridad: si algún horario no cayera en ninguna franja, se
      // muestra igual al final. Un turno inelegible es peor que una etiqueta
      // genérica.
      [
        ...PERIODS.map((p) => ({
          ...p,
          slots: slots.filter((s) => {
            const h = s.time.getHours();
            return h >= p.from && h < p.to;
          }),
        })),
        {
          id: "otros",
          label: "Otros horarios",
          slots: slots.filter(
            (s) =>
              !PERIODS.some((p) => {
                const h = s.time.getHours();
                return h >= p.from && h < p.to;
              }),
          ),
        },
      ].filter((p) => p.slots.length > 0),
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
    if (isSubmitting) return;
    primeVoicePlayback();
    if (effectiveAvailabilityStatus !== "ready") {
      return showToast(
        "Esperá a que confirmemos la disponibilidad antes de reprogramar.",
        "warning",
      );
    }
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
    setIsSubmitting(true);
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
      setIsSubmitting(false);
      onSuccess();
    } catch (error) {
      setIsSubmitting(false);
      showToast(getBookingApiMessage(error), "error", {
        title: "No se pudo reprogramar",
        speak: "No pude guardar la reprogramación. Revisá tu conexión e intentá nuevamente.",
        voiceOptions: PORTAL_VOICE_OPTIONS,
      });
    }
  };

  return createPortal(
    <div
      className="reschedule-overlay"
      onClick={() => {
        if (!isSubmitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="reschedule-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reschedule-title"
        aria-describedby="reschedule-feedback"
        aria-busy={isSubmitting}
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
            disabled={isSubmitting}
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
              minDate={availabilityMinDate ?? undefined}
              maxDate={availabilityMaxDate}
              /* El OBJETO, no la cadena "es": por nombre habría que haberlo
                 registrado antes con registerLocale, y al no estarlo el
                 calendario caía en inglés sin avisar. */
              locale={es}
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
              {effectiveAvailabilityStatus === "loading" && (
                <p className="reschedule-availability-message" role="status">
                  Cargando agenda actualizada…
                </p>
              )}
              {effectiveAvailabilityStatus === "error" && (
                <div className="reschedule-availability-message" role="alert">
                  <p>No pudimos verificar la agenda. No vamos a ofrecer horarios sin confirmar.</p>
                  <button
                    type="button"
                    className="reschedule-slot-btn"
                    onClick={() => {
                      setAvailabilityStatus("loading");
                      setBackendSlots(undefined);
                      setAvailabilityMinDate(null);
                      setAvailabilityMaxDate(null);
                      setAvailabilityRequestVersion((version) => version + 1);
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {effectiveAvailabilityStatus === "ready" && slots.length === 0 && (
                <p className="reschedule-availability-message" role="status">
                  No hay horarios disponibles para este día.
                </p>
              )}
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
          <p
            id="reschedule-feedback"
            className="reschedule-footer-note"
            aria-live="polite"
          >
            {effectiveAvailabilityStatus === "loading"
              ? "Verificando que el horario siga disponible."
              : effectiveAvailabilityStatus === "error"
                ? "No pudimos verificar el horario. Reintentá la consulta."
                : !selectedTime
                  ? "Elegí un horario para habilitar la confirmación."
                  : hasRescheduleChanges
                    ? "Propuesta lista para confirmar."
                    : "Cambiá fecha, hora o duración para habilitar la confirmación."}
          </p>
          <div className="reschedule-footer-actions">
            <button
              type="button"
              className="reschedule-btn-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Mantener actual
            </button>
            <button
              type="button"
              className="reschedule-btn-confirm"
              onClick={handleReschedule}
              disabled={
                isSubmitting ||
                effectiveAvailabilityStatus !== "ready" ||
                !newDate ||
                !hasValidDuration ||
                !hasRescheduleChanges
              }
            >
              {isSubmitting ? "Guardando cambio…" : "Confirmar cambio"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RescheduleModal;
