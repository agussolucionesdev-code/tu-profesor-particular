import DatePicker from "react-datepicker";
import {
  FaCalendarAlt,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
} from "react-icons/fa";

const DateSelectionStep = ({
  formData,
  selectedDayOnly,
  selectedDayLabel,
  availableSlotCount,
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
        <div className="calendar-card">
          <DatePicker
            selected={formData.timeSlot}
            onChange={() => {}}
            onSelect={handleDateSelect}
            minDate={new Date()}
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
