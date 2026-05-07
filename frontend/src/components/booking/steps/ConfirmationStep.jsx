import {
  FaCalendarCheck,
  FaCalendarAlt,
  FaClock,
  FaHourglassHalf,
  FaCheckCircle,
  FaArrowLeft,
  FaArrowRight,
} from "react-icons/fa";
import BookingConfirmationSummary from "../BookingConfirmationSummary";
import { formatDurationOptionLabel } from "../../../utils/bookingFormatters";

const ConfirmationStep = ({
  formData,
  isAdult,
  isTimeSelected,
  isConfirmationReady,
  confirmationDateLabel,
  confirmationDurationLabel,
  confirmationTimeRangeLabel,
  confirmationEducationLabel,
  responsibleRelationshipLabel,
  confirmationLookupHint,
  durationOptions,
  maxAllowedDuration,
  handleDurationSelect,
  handleSubmit,
  goToPrev,
  loading,
  loadingPhase,
  pricePerHour,
}) => {
  const estimatedPrice =
    pricePerHour > 0 && formData.duration >= 0.5
      ? pricePerHour * formData.duration
      : null;

  return (
    <>
      <div className="confirm-step-content">
        {/* ── Header ── */}
        <h3 className="section-title" tabIndex={-1}>
          <FaCalendarCheck aria-hidden="true" /> Confirmá tu reserva
        </h3>

        {/* ── Summary strip: date + time + price ── */}
        <div className="confirm-summary-strip">
          {confirmationDateLabel && (
            <div className="confirm-fact">
              <FaCalendarAlt aria-hidden="true" />
              <span>{confirmationDateLabel}</span>
            </div>
          )}
          <div className="confirm-fact">
            <FaClock aria-hidden="true" />
            <span>{confirmationTimeRangeLabel || "Pendiente"}</span>
          </div>
          {estimatedPrice !== null && (
            <div className="confirm-fact accent">
              <strong>${estimatedPrice.toLocaleString("es-AR")}</strong>
            </div>
          )}
        </div>

        {/* ── Duration selector card ── */}
        <div className="confirm-duration-card">
          <div className="confirm-duration-header">
            <h4>Duración de la clase</h4>
            <span className="confirm-duration-limit">
              Hasta {formatDurationOptionLabel(maxAllowedDuration)}
            </span>
          </div>

          <div
            className="duration-option-grid"
            role="list"
            aria-label="Opciones de duración"
          >
            {durationOptions.map((duration) => {
              const isSelected = Number(formData.duration) === duration;
              const mins = duration * 60;
              const label =
                mins < 60
                  ? `${mins} min`
                  : mins === 60
                    ? "1 h"
                    : `${duration} h`;
              const sublabel =
                mins === 30
                  ? "Repaso rápido"
                  : mins === 45
                    ? "Clase corta"
                    : mins === 60
                      ? "Clase estándar"
                      : mins === 90
                        ? "Clase extendida"
                        : "Clase intensiva";
              const isRecommended = mins === 60;

              return (
                <button
                  key={duration}
                  type="button"
                  role="listitem"
                  className={`duration-chip${isSelected ? " selected" : ""}${isRecommended ? " is-recommended" : ""}`}
                  onClick={() => handleDurationSelect(duration)}
                  aria-pressed={isSelected}
                  aria-label={`${label} — ${sublabel}${isRecommended ? " (recomendado)" : ""}`}
                >
                  {isRecommended && (
                    <span className="duration-chip-badge">Recomendado</span>
                  )}
                  <span className="duration-chip-main">{label}</span>
                  <span className="duration-chip-sub">{sublabel}</span>
                  {isSelected && (
                    <span className="duration-chip-check" aria-hidden="true">
                      <FaCheckCircle />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {formData.duration >= 0.5 && (
            <p className="confirm-duration-selected">
              <FaHourglassHalf aria-hidden="true" />{" "}
              {formatDurationOptionLabel(formData.duration)} para este turno
            </p>
          )}
        </div>

        {/* ── Summary card ── */}
        <BookingConfirmationSummary
          dateLabel={confirmationDateLabel}
          durationLabel={confirmationDurationLabel}
          timeRangeLabel={confirmationTimeRangeLabel}
          studentName={formData.studentName}
          responsibleName={formData.responsibleName}
          responsibleRelationshipLabel={responsibleRelationshipLabel}
          isAdult={isAdult}
          educationLevel={confirmationEducationLabel}
          subject={formData.subject}
          school={formData.school}
          email={formData.email}
          phone={formData.phone}
          lookupHint={confirmationLookupHint}
        />
      </div>

      {/* ── Actions ── */}
      <div className="step-actions space-between confirmation-stage-actions">
        <button
          type="button"
          className="btn-neuro-secondary"
          onClick={goToPrev}
          disabled={loading}
        >
          <FaArrowLeft aria-hidden="true" /> Horario
        </button>

        {loading ? (
          <div
            className="booking-loading-panel"
            role="status"
            aria-live="assertive"
          >
            <div className="booking-loading-phases">
              {[
                { icon: "🔍", label: "Verificando disponibilidad" },
                { icon: "💾", label: "Guardando tu turno" },
                { icon: "✉️", label: "Enviando confirmación" },
                { icon: "✅", label: "¡Listo! Preparando tu código" },
              ].map((phase, i) => (
                <div
                  key={i}
                  className={`booking-loading-phase ${
                    i < loadingPhase
                      ? "phase-done"
                      : i === loadingPhase
                        ? "phase-active"
                        : "phase-pending"
                  }`}
                >
                  <span className="phase-icon">{phase.icon}</span>
                  <span className="phase-label">{phase.label}</span>
                  {i === loadingPhase && (
                    <span className="phase-spinner" aria-hidden="true" />
                  )}
                  {i < loadingPhase && (
                    <span className="phase-check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="booking-loading-note">
              No cierres esta ventana — tardamos unos segundos en asegurar tu
              lugar.
            </p>
          </div>
        ) : (
          <button
            type="button"
            className={`btn-neuro-success ${formData.duration >= 0.5 ? "ready-to-pulse" : "btn-disabled"}`}
            onClick={handleSubmit}
            disabled={loading || !formData.duration || formData.duration < 0.5}
          >
            <FaCheckCircle aria-hidden="true" /> Confirmar Reserva
          </button>
        )}
      </div>
    </>
  );
};

export default ConfirmationStep;
