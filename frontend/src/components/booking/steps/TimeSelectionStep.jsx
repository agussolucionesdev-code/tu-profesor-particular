import {
  FaCalendarAlt,
  FaCalendarCheck,
  FaClock,
  FaLightbulb,
  FaArrowRight,
  FaArrowLeft,
  FaTimes,
  FaTimesCircle,
} from "react-icons/fa";
import { format } from "date-fns";
import es from "date-fns/locale/es";

const TimeSelectionStep = ({
  formData,
  isTimeSelected,
  selectedTimeLabel,
  selectedDayLabel,
  selectedDayOnly,
  slotSections,
  availableSlots,
  availableSlotCount,
  nextFreeSlot,
  handleTimeSelect,
  clearTimeSelection,
  handleProceedToConfirmationStep,
  goToPrev,
}) => {
  return (
    <>
      <div className="step-content-with-arrows step-content-focus">
        <div className="calendar-focus-container relative-interaction">
          <div className="step-stage-shell slot-stage-shell">
            <div className="step-stage-main">
              <div className="step-stage-heading">
                <div>
                  <span className="step-stage-kicker">Paso 3 · Horario</span>
                  <h3 className="section-title" tabIndex={-1}>
                    <FaClock aria-hidden="true" /> Turnos disponibles
                  </h3>
                  <p className="step-empathy-note">
                    Cada botón es un horario posible. Los bloques ocupados o
                    pasados quedan bloqueados para evitar confusiones.
                  </p>
                </div>

                <button
                  type="button"
                  className="calendar-secondary-action"
                  onClick={goToPrev}
                >
                  <FaCalendarAlt aria-hidden="true" /> Cambiar fecha
                </button>
              </div>

              <div className="calendar-toolbar-row">
                <div className="calendar-legend">
                  <div className="legend-item">
                    <span className="legend-icon disabled"></span> Ocupado
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon available"></span> Disponible
                  </div>
                  <div className="legend-item">
                    <span className="legend-icon selected"></span> Seleccionado
                  </div>
                </div>

                <span className="calendar-toolbar-helper">
                  {isTimeSelected
                    ? "Horario listo. El siguiente paso es revisar y confirmar."
                    : "Elegí una hora libre y te habilitamos la confirmación."}
                </span>
              </div>

              <div
                className={`calendar-selection-banner ${isTimeSelected ? "is-active" : ""}`}
                role="status"
                aria-live="polite"
              >
                <div>
                  <span className="calendar-selection-kicker">
                    Horario elegido
                  </span>
                  <strong>
                    {isTimeSelected
                      ? `${selectedTimeLabel} · ${selectedDayLabel}`
                      : "Todavía no elegiste un horario"}
                  </strong>
                  <p>
                    {isTimeSelected
                      ? "Ahora solo queda revisar duración, resumen y confirmar."
                      : "Podés tocar cualquier bloque libre para marcarlo y seguir."}
                  </p>
                </div>

                {isTimeSelected ? (
                  <button
                    type="button"
                    className="btn-chip-clear"
                    onClick={clearTimeSelection}
                    aria-label="Quitar horario elegido"
                  >
                    <FaTimes aria-hidden="true" /> Quitar selección
                  </button>
                ) : (
                  <span className="calendar-selection-tip">
                    Paso siguiente: confirmar. Si volvés a tocar el bloque
                    elegido, lo quitás.
                  </span>
                )}
              </div>

              <div className="calendar-glass-box panoramic slot-rich-box">
                <div className="slots-container">
                  {availableSlots.length > 0 ? (
                    <div className="slot-sections">
                      {slotSections.map((section) => (
                        <section key={section.id} className="slot-section" data-period={section.id}>
                          <div className="slot-section-header">
                            <div>
                              <h4>{section.label}</h4>
                              <p>{section.helper}</p>
                            </div>
                            <span>
                              {
                                section.slots.filter(
                                  (slot) => !slot.isOccupied,
                                ).length
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
              </div>
            </div>

            <aside className="step-stage-sidebar">
              <div className="stage-sidebar-cards">
                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaCalendarCheck />
                    </span>
                    <span className="insight-label">Día en foco</span>
                  </div>
                  <strong>
                    {selectedDayOnly
                      ? format(selectedDayOnly, "EEEE d 'de' MMMM", {
                          locale: es,
                        })
                      : "Sin fecha"}
                  </strong>
                  <small>
                    {selectedDayOnly
                      ? "Si necesitás otro día, podés volver sin perder tus datos."
                      : "Vuelve al paso anterior para elegir la fecha."}
                  </small>
                </article>

                <article className="selection-insight-card">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaClock />
                    </span>
                    <span className="insight-label">Estado del horario</span>
                  </div>
                  <strong>
                    {isTimeSelected
                      ? selectedTimeLabel
                      : nextFreeSlot
                        ? `${format(nextFreeSlot, "HH:mm")} hs`
                        : "--"}
                  </strong>
                  <small>
                    {isTimeSelected
                      ? "Ya podés pasar al resumen final."
                      : nextFreeSlot
                        ? "Te sugerimos empezar por el primer hueco libre."
                        : "Si este día no sirve, volvés y elegís otra fecha."}
                  </small>
                </article>

                <article className="selection-insight-card accent">
                  <div className="selection-insight-head">
                    <span className="selection-insight-icon" aria-hidden="true">
                      <FaLightbulb />
                    </span>
                    <span className="insight-label">Próximo paso</span>
                  </div>
                  <strong>
                    {isTimeSelected
                      ? "Revisar y confirmar"
                      : `${availableSlotCount} bloques libres`}
                  </strong>
                  <small>
                    {isTimeSelected
                      ? "En la última pantalla ajustás duración y revisás el resumen."
                      : "Apenas elijas un horario libre, te habilitamos la confirmación."}
                  </small>
                </article>
              </div>

              <button
                type="button"
                className={`btn-stage-next desktop-stage-cta ${isTimeSelected ? "is-ready" : "is-locked"}`}
                onClick={handleProceedToConfirmationStep}
              >
                <span>
                  {isTimeSelected
                    ? "Continuar a confirmar"
                    : "Elegí un horario para continuar"}
                </span>
                <FaArrowRight aria-hidden="true" />
              </button>

              <p className="stage-next-helper">
                {isTimeSelected
                  ? "El botón ya quedó listo para llevarte al resumen final."
                  : "Cuando marques un horario libre, este botón se activa y te lleva al cierre de la reserva."}
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
