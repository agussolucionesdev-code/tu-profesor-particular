import {
  FaCalendarCheck,
  FaClock,
  FaHourglassHalf,
  FaTicketAlt,
  FaCheckCircle,
  FaShieldAlt,
  FaArrowLeft,
} from "react-icons/fa";
// FaCheckCircle doubles as the confirm icon and the chip check icon
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
      <div className="calendar-focus-container confirmation-stage">
        <div className="confirmation-stage-intro">
          <div className="confirmation-stage-copy">
            <span className="confirmation-stage-eyebrow">Paso 4 de 4</span>
            <h3
              className="section-title center-text confirmation-stage-title"
              tabIndex={-1}
            >
              <FaCalendarCheck aria-hidden="true" /> Confirmación final
            </h3>
            <p className="step-empathy-note confirmation-stage-note">
              Ya tenés fecha y horario. Solo queda elegir la duración ideal y
              revisar el resumen con todo bien claro antes de confirmar.
            </p>
          </div>

          <div
            className={`confirmation-stage-badge ${isConfirmationReady ? "is-ready" : ""}`}
          >
            <span>
              {isConfirmationReady ? "Todo listo" : "Último detalle"}
            </span>
            <strong>
              {isConfirmationReady
                ? "Reserva preparada para confirmar"
                : "Elegí cuánto durará la clase"}
            </strong>
          </div>
        </div>

        <section className="confirmation-hero-panel">
          <article className="confirmation-hero-main">
            <span className="confirmation-hero-kicker">
              Tu reserva en una mirada
            </span>
            <h4>{confirmationDateLabel || "Aún falta definir el turno"}</h4>
            <p>
              {confirmationTimeRangeLabel
                ? "Este es el horario que va a quedar guardado. Ajustá la duración y confirmás en un último paso, sin vueltas."
                : "Cuando elijas un horario, acá te dejamos el resumen principal para cerrarlo con tranquilidad."}
            </p>

            <div className="confirmation-hero-facts">
              <div className="confirmation-hero-fact">
                <FaClock aria-hidden="true" />
                <div>
                  <span>Horario</span>
                  <strong>
                    {confirmationTimeRangeLabel || "Pendiente"}
                  </strong>
                </div>
              </div>

              <div className="confirmation-hero-fact">
                <FaHourglassHalf aria-hidden="true" />
                <div>
                  <span>Duración</span>
                  <strong>
                    {confirmationDurationLabel || "Aún sin elegir"}
                  </strong>
                </div>
              </div>

              <div className="confirmation-hero-fact">
                <FaTicketAlt aria-hidden="true" />
                <div>
                  <span>Gestión</span>
                  <strong>Código al confirmar</strong>
                </div>
              </div>
            </div>
          </article>

          <aside className="confirmation-hero-side">
            <span className="confirmation-hero-side-kicker">
              Experiencia guiada
            </span>

            <div className="confirmation-hero-checks">
              <span className="confirmation-hero-check is-done">
                <FaCheckCircle aria-hidden="true" /> Fecha elegida
              </span>
              <span
                className={`confirmation-hero-check ${isTimeSelected ? "is-done" : ""}`}
              >
                <FaCheckCircle aria-hidden="true" /> Horario reservado
              </span>
              <span
                className={`confirmation-hero-check ${isConfirmationReady ? "is-done" : ""}`}
              >
                <FaShieldAlt aria-hidden="true" /> Duración confirmada
              </span>
            </div>

            <p>
              {isConfirmationReady
                ? "Ya elegiste una opción compatible. Si todo te cierra, el botón final queda listo para confirmar."
                : `Te mostramos ${durationOptions.length} opciones compatibles con este horario para que elijas sin cruces ni confusiones.`}
            </p>
          </aside>
        </section>

        <section className="duration-selector duration-selector-premium">
          <div className="duration-selector-header">
            <div>
              <span className="duration-kicker">Duración de la clase</span>
              <h4>Elegí el tiempo ideal para este encuentro</h4>
              <p>
                Solo ves duraciones que entran dentro de ese horario, así todo
                queda prolijo, claro y sin superposiciones.
              </p>
            </div>

            <span className="duration-limit-badge">
              Hasta {formatDurationOptionLabel(maxAllowedDuration)}
            </span>
          </div>

          <div className="duration-selector-layout">
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

            <aside
              className={`duration-summary-card ${isConfirmationReady ? "is-ready" : ""}`}
            >
              <span className="duration-summary-kicker">
                {isConfirmationReady ? "Duración elegida" : "Tu siguiente paso"}
              </span>
              <strong>
                {isConfirmationReady ? confirmationDurationLabel : "Marcá una opción"}
              </strong>
              <p>
                {formData.duration
                  ? `La clase quedará reservada por ${formatDurationOptionLabel(formData.duration)}.`
                  : "Tocá una tarjeta para definir cuánto tiempo querés reservar."}
              </p>

              <div className="duration-summary-meta">
                <span>
                  <FaShieldAlt aria-hidden="true" /> Sin cruces
                </span>
                <span>
                  <FaCalendarCheck aria-hidden="true" /> Revisar y confirmar
                </span>
              </div>
            </aside>
          </div>

          <div className="duration-footer">
            <p className="duration-current-selection">
              {formData.duration
                ? `Elegiste ${formatDurationOptionLabel(formData.duration)} para este turno.`
                : "Elegí cuánto tiempo querés reservar para continuar."}
            </p>
            <p className="duration-limit">
              Límite disponible para este turno:{" "}
              {formatDurationOptionLabel(maxAllowedDuration)}
            </p>
          </div>
        </section>

        {estimatedPrice !== null && (
          <div
            style={{
              background: "var(--color-surface-2, #f0fdf4)",
              borderLeft: "4px solid var(--color-success, #38a169)",
              borderRadius: "10px",
              padding: "0.85rem 1.1rem",
              marginBottom: "1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div>
              <strong style={{ fontSize: "0.95rem" }}>Precio estimado</strong>
              <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.7 }}>
                (puede variar según el nivel)
              </p>
            </div>
            <strong style={{ fontSize: "1.25rem", color: "var(--color-success, #38a169)" }}>
              ${estimatedPrice.toLocaleString("es-AR")}
            </strong>
          </div>
        )}

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
