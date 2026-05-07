import {
  FaClock,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import { format } from "date-fns";

const TimeSelectionStep = ({
  formData,
  isTimeSelected,
  selectedTimeLabel,
  selectedDayLabel,
  selectedDayOnly,
  slotSections,
  availableSlots,
  availableSlotCount,
  handleTimeSelect,
  clearTimeSelection,
  handleProceedToConfirmationStep,
  goToPrev,
}) => {
  return (
    <>
      <div className="time-step-content">
        {/* ── Header: título + link cambiar fecha ── */}
        <div className="time-step-header">
          <h3 className="section-title" tabIndex={-1}>
            <FaClock aria-hidden="true" /> Elegí tu horario
          </h3>
          <button
            type="button"
            className="time-change-date-link"
            onClick={goToPrev}
          >
            Cambiar fecha
          </button>
        </div>

        {/* ── Micro-leyenda: 3 dots compactos ── */}
        <div className="calendar-micro-legend">
          <span className="micro-legend-item">
            <span className="ml-dot ml-occupied" /> Ocupado
          </span>
          <span className="micro-legend-item">
            <span className="ml-dot ml-available" /> Disponible
          </span>
          <span className="micro-legend-item">
            <span className="ml-dot ml-selected" /> Elegido
          </span>
        </div>

        {/* ── Slots card ── */}
        <div className="time-slots-card">
          {availableSlots.length > 0 ? (
            <div className="slot-sections">
              {slotSections.map((section) => (
                <section
                  key={section.id}
                  className="slot-section"
                  data-period={section.id}
                >
                  <div className="slot-section-header">
                    <div>
                      <h4>{section.label}</h4>
                      <p>{section.helper}</p>
                    </div>
                    <span>
                      {
                        section.slots.filter((slot) => !slot.isOccupied)
                          .length
                      }{" "}
                      libres
                    </span>
                  </div>

                  <div className="slots-grid">
                    {section.slots.map((slot, index) => {
                      const isSelected =
                        formData.timeSlot?.getTime() ===
                        slot.timeObj.getTime();
                      const slotStateLabel = slot.isOccupied
                        ? slot.status === "past"
                          ? "No disponible"
                          : "Ocupado"
                        : isSelected
                          ? "Elegido"
                          : "Libre";

                      return (
                        <button
                          key={`${section.id}-${index}`}
                          type="button"
                          disabled={slot.isOccupied}
                          className={`slot-btn ${slot.isOccupied ? "disabled" : ""} ${isSelected ? "selected" : ""}`}
                          onClick={() => handleTimeSelect(slot.timeObj)}
                          aria-pressed={isSelected}
                          aria-label={`${format(slot.timeObj, "HH:mm")} ${slotStateLabel}`}
                        >
                          <span className="slot-main-label">
                            {format(slot.timeObj, "HH:mm")}
                          </span>
                          <span className="slot-sub-label">
                            {slotStateLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="no-slots-box">
              <FaTimesCircle aria-hidden="true" />
              <p>Cargando agenda...</p>
            </div>
          )}
        </div>

        {/* ── Chip + CTA ── */}
        <div className="time-actions-row" role="status" aria-live="polite">
          {isTimeSelected && (
            <button
              type="button"
              className="time-chip"
              onClick={clearTimeSelection}
              aria-label={`Quitar horario: ${selectedTimeLabel}`}
            >
              <FaClock aria-hidden="true" />
              <span>{selectedTimeLabel}</span>
              <FaTimes className="time-chip-x" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            className={`btn-time-next ${isTimeSelected ? "is-ready" : "is-locked"}`}
            onClick={handleProceedToConfirmationStep}
            disabled={!isTimeSelected}
          >
            <span>
              {isTimeSelected ? "Confirmar reserva" : "Elegí un horario"}
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
          <FaArrowLeft aria-hidden="true" /> Cambiar fecha
        </button>
        <button
          type="button"
          className={`btn-neuro-primary ${isTimeSelected ? "btn-ready" : "btn-disabled"}`}
          onClick={handleProceedToConfirmationStep}
        >
          Confirmar reserva <FaArrowRight aria-hidden="true" />
        </button>
      </div>
    </>
  );
};

export default TimeSelectionStep;
