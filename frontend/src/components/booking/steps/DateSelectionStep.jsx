import DatePicker from "react-datepicker";
import {
  FaCalendarAlt,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
  FaExclamationCircle,
} from "react-icons/fa";

const DateSelectionStep = ({
  formData,
  selectedDayOnly,
  selectedDayLabel,
  availableSlotCount,
  hasAnyAvailability = true,
  availabilityStatus,
  availabilityMinDate,
  availabilityMaxDate,
  availabilityRangeLabel,
  retryAvailability,
  handleDateSelect,
  clearDateSelection,
  handleProceedToTimeStep,
  goToPrev,
  renderCalendarHeader,
  getDayClassName,
  renderDayContents,
  isDateAvailable,
}) => {
  return (
    <>
      <div className="date-step-content">
        {/* ── Título limpio ── */}
        <h3 className="section-title" tabIndex={-1}>
          <FaCalendarAlt aria-hidden="true" /> Elegí tu día
        </h3>

        {/* ── Micro-leyenda: 3 ítems compactos ── */}
        <div className="calendar-micro-legend">
          <span className="micro-legend-item">
            <span className="ml-dot ml-today" /> Hoy
          </span>
          <span className="micro-legend-item">
            <span className="ml-dot ml-partial" /> Con turnos
          </span>
          <span className="micro-legend-item">
            <span className="ml-dot ml-selected" /> Elegido
          </span>
        </div>

        {/* ── Calendar card ── */}
        <div className="calendar-card" role="region" aria-label="Calendario de disponibilidad de turnos">
          <DatePicker
            selected={formData.timeSlot}
            onChange={() => {}}
            onSelect={handleDateSelect}
            minDate={availabilityMinDate ?? undefined}
            maxDate={availabilityMaxDate}
            inline
            locale="es"
            fixedHeight
            calendarClassName="neuro-calendar"
            dayClassName={getDayClassName}
            renderDayContents={renderDayContents}
            filterDate={isDateAvailable}
            renderCustomHeader={renderCalendarHeader(1)}
          />
        </div>

        {/* ── Keyboard hint ── */}
        <p className="calendar-keyboard-hint" aria-live="off">
          Usá las flechas del teclado para navegar entre días. <kbd>Enter</kbd> para seleccionar.
        </p>

        {/* ── Sin disponibilidad en el período completo ── */}
        {availabilityStatus === "loading" && (
          <div className="calendar-no-availability" role="status">
            <FaExclamationCircle aria-hidden="true" />
            <span>Cargando disponibilidad actualizada…</span>
          </div>
        )}

        {availabilityStatus === "error" && (
          <div className="calendar-no-availability" role="alert">
            <FaExclamationCircle aria-hidden="true" />
            <span>No pudimos cargar la agenda. No vamos a mostrar horarios sin verificar.</span>
            <button type="button" className="btn-neuro-secondary" onClick={retryAvailability}>
              Reintentar
            </button>
          </div>
        )}

        {availabilityStatus === "ready" && !hasAnyAvailability && (
          <div className="calendar-no-availability" role="alert">
            <FaExclamationCircle aria-hidden="true" />
            <span>
              No hay turnos disponibles en {availabilityRangeLabel || "el período verificado"}. Probá otra fecha o{" "}
              <a href="https://wa.me/5491164236675" target="_blank" rel="noopener noreferrer">
                contactá al profesor por WhatsApp
              </a>
              .
            </span>
          </div>
        )}

        {/* ── Sin disponibilidad en el día seleccionado ── */}
        {availabilityStatus === "ready" && selectedDayOnly && availableSlotCount === 0 && (
          <p className="calendar-no-slots-note" role="alert">
            No hay horarios libres para este día. Probá con otra fecha o{" "}
            <a href="https://wa.me/5491164236675" target="_blank" rel="noopener noreferrer">
              contactá al profesor
            </a>
            .
          </p>
        )}

        {/* ── Chip + CTA ── */}
        <div className="calendar-actions-row" role="status" aria-live="polite">
          {selectedDayOnly && (
            <button
              type="button"
              className="date-chip"
              onClick={clearDateSelection}
              aria-label={`Quitar fecha: ${selectedDayLabel}`}
            >
              <FaCalendarAlt aria-hidden="true" />
              <span>{selectedDayLabel}</span>
              <FaTimes className="date-chip-x" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className={`btn-date-next ${selectedDayOnly ? "is-ready" : "is-locked"}`}
            onClick={handleProceedToTimeStep}
            disabled={!selectedDayOnly}
          >
            <span>
              {selectedDayOnly
                ? `Ver horarios (${availableSlotCount})`
                : "Elegí un día"}
            </span>
            <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* ── Mobile bottom actions ── */}
      <div className="step-actions stage-actions-mobile space-between">
        <button
          type="button"
          className="btn-neuro-secondary"
          onClick={goToPrev}
        >
          <FaArrowLeft aria-hidden="true" /> Anterior
        </button>
        <button
          type="button"
          className={`btn-neuro-primary ${selectedDayOnly ? "btn-ready" : "btn-disabled"}`}
          onClick={handleProceedToTimeStep}
        >
          Horarios <FaArrowRight aria-hidden="true" />
        </button>
      </div>
    </>
  );
};

export default DateSelectionStep;
