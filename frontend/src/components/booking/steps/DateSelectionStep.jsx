import DatePicker from "react-datepicker";
import {
  FaCalendarAlt,
  FaCalendarCheck,
  FaClock,
  FaLightbulb,
  FaArrowRight,
  FaArrowLeft,
  FaSearchPlus,
  FaTimes,
} from "react-icons/fa";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const DateSelectionStep = ({
  formData,
  selectedDayOnly,
  selectedDayLabel,
  availableSlotCount,
  nextFreeSlot,
  isDesktopCalendarViewport,
  isCalendarExpanded,
  handleDateSelect,
  clearDateSelection,
  handleProceedToTimeStep,
  goToPrev,
  openCalendarExpanded,
  renderCalendarHeader,
  getDayClassName,
  renderDayContents,
  isDateAvailable,
}) => {
  return (
    <>
      <div className="step-content-with-arrows step-content-focus">
        <div className="calendar-focus-container relative-interaction">
          <div className="step-stage-shell calendar-stage-shell">
            <div className="step-stage-main">
              <div className="step-stage-heading">
                <div>
                  <span className="step-stage-kicker">Paso 2 · Fecha</span>
                  <h3 className="section-title" tabIndex={-1}>
                    <FaCalendarAlt aria-hidden="true" /> Elegí un día
                  </h3>
                  <p className="step-empathy-note">
                    Si estás organizando a un menor, elegí un día que también le
                    dé margen para descansar y llegar tranquilo.
                  </p>
                </div>

                {isDesktopCalendarViewport && (
                  <button
                    type="button"
                    className="calendar-zoom-button"
                    onClick={openCalendarExpanded}
                    aria-haspopup="dialog"
                    aria-expanded={isCalendarExpanded}
                  >
                    <FaSearchPlus aria-hidden="true" /> Ampliar calendario
                  </button>
                )}
              </div>

              <div className="calendar-toolbar-row">
                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-icon today"></span> Hoy
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon available"></span> Libre
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon partial-day"></span> Con turnos
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon full-day"></span> Sin cupos
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon selected"></span> Elegido
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon day-blocked"></span> No disponible
                  </div>
                </div>

                <span className="calendar-toolbar-helper">
                  {selectedDayOnly
                    ? "Fecha lista. El siguiente paso ya está preparado."
                    : "Tocá un día para habilitar los horarios disponibles."}
                </span>
              </div>

              <div
                className={`calendar-selection-banner ${selectedDayOnly ? "is-active" : ""}`}
                role="status"
                aria-live="polite"
              >
                <div>
                  <span className="calendar-selection-kicker">
                    Selección actual
                  </span>
                  <strong>
                    {selectedDayOnly
                      ? selectedDayLabel
                      : "Todavía no elegiste una fecha"}
                  </strong>
                  <p>
                    {selectedDayOnly
                      ? "Si la cambiás, los horarios del paso siguiente se actualizan solos."
                      : "En pantallas grandes podés abrir la vista ampliada para verla mucho más cómoda."}
                  </p>
                </div>

                {selectedDayOnly ? (
                  <button
                    type="button"
                    className="btn-chip-clear"
                    onClick={clearDateSelection}
                    aria-label="Quitar fecha elegida"
                  >
                    <FaTimes aria-hidden="true" /> Quitar selección
                  </button>
                ) : (
                  <span className="calendar-selection-tip">
                    Paso siguiente: horarios. Si volvés a tocar la fecha
                    elegida, la quitás.
                  </span>
                )}
              </div>

              <div className="calendar-glass-box calendar-rich-box">
                <DatePicker
                  selected={formData.timeSlot}
                  onChange={() => {}}
                  onSelect={handleDateSelect}
                  minDate={new Date()}
                  inline
                  locale="es"
                  fixedHeight
                  calendarClassName="neuro-calendar neuro-calendar-rich"
                  dayClassName={getDayClassName}
                  renderDayContents={renderDayContents}
                  filterDate={isDateAvailable}
                  renderCustomHeader={renderCalendarHeader(1)}
                />
              </div>
            </div>

            <aside className="step-stage-sidebar">
              <div className="stage-sidebar-cards">
                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaCalendarCheck />
                    </span>
                    <span className="insight-label">Día elegido</span>
                  </div>
                  <strong>
                    {selectedDayOnly
                      ? format(selectedDayOnly, "EEEE d 'de' MMMM", {
                          locale: es,
                        })
                      : "Todavía sin fecha"}
                  </strong>
                  <small>
                    {selectedDayOnly
                      ? "La reserva ya quedó enfocada en este día."
                      : "Primero elegí el día y después te mostramos solo horarios libres."}
                  </small>
                </article>

                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaClock />
                    </span>
                    <span className="insight-label">Horarios libres</span>
                  </div>
                  <strong>
                    {selectedDayOnly ? `${availableSlotCount} opciones` : "--"}
                  </strong>
                  <small>
                    {selectedDayOnly
                      ? availableSlotCount > 0
                        ? "Filtramos la agenda real para que no pierdas tiempo."
                        : "Ese día ya no tiene espacios disponibles."
                      : "Este contador aparece apenas confirmás una fecha."}
                  </small>
                </article>

                <article className="selection-insight-card accent">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaLightbulb />
                    </span>
                    <span className="insight-label">Primer horario libre</span>
                  </div>
                  <strong>
                    {nextFreeSlot ? `${format(nextFreeSlot, "HH:mm")} hs` : "--"}
                  </strong>
                  <small>
                    {nextFreeSlot
                      ? "Ideal si querés resolver rápido sin revisar toda la grilla."
                      : "Cuando haya cupos te lo vamos a marcar acá."}
                  </small>
                </article>
              </div>

              <button
                type="button"
                className={`btn-stage-next desktop-stage-cta ${selectedDayOnly ? "is-ready" : "is-locked"}`}
                onClick={handleProceedToTimeStep}
              >
                <span>
                  {selectedDayOnly
                    ? "Ver horarios disponibles"
                    : "Elegí un día para continuar"}
                </span>
                <FaArrowRight aria-hidden="true" />
              </button>

              <p className="stage-next-helper">
                {selectedDayOnly
                  ? "Te llevamos al paso 3 con la fecha ya enfocada."
                  : "Cuando elijas una fecha, este botón se convierte en tu acceso directo al siguiente paso."}
              </p>
            </aside>
          </div>
        </div>
      </div>

      <div className="step-actions stage-actions-mobile space-between">
        <button
          type="button"
          className="btn-neuro-secondary"
          onClick={goToPrev}
        >
          <FaArrowLeft aria-hidden="true" /> Volver a tus datos
        </button>
        <button
          type="button"
          className={`btn-neuro-primary ${selectedDayOnly ? "btn-ready" : "btn-disabled"}`}
          onClick={handleProceedToTimeStep}
        >
          Horarios disponibles <FaArrowRight aria-hidden="true" />
        </button>
      </div>
    </>
  );
};

export default DateSelectionStep;
