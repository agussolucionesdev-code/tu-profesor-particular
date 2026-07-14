import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { RESPONSIBLE_RELATIONSHIP_OPTIONS } from "../../utils/bookingFormatters";
import { createIdempotencyKey } from "../../utils/idempotencyKey";
import {
  addBusinessDays,
  bookingScheduleChanged,
  buildAdminCreatePayload,
  buildAdminUpdatePayload,
  businessDateKey,
  formatBusinessDate,
  formatBusinessTime,
  formatDurationLabel,
  requiresAuthoritativeSlot,
} from "../../utils/adminAgenda";
import { useAdminAgenda } from "../../hooks/useAdminAgenda";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const emptyCreateForm = (timeSlot = "", duration = 0.5) => ({
  responsibleName: "",
  responsibleRelationship: "self",
  responsibleRelationshipOther: "",
  studentName: "",
  email: "",
  phone: "",
  school: "",
  educationLevel: "",
  yearGrade: "",
  subject: "",
  academicSituation: "",
  timeSlot,
  duration,
  status: "Confirmado",
  price: 0,
  notes: "",
  studentEvolution: "",
  emotionalState: "",
});

const editForm = (booking) => ({
  ...emptyCreateForm(booking.timeSlot),
  school: booking.school || "",
  educationLevel: booking.educationLevel || "",
  yearGrade: booking.yearGrade || "",
  subject: booking.subject || "",
  academicSituation: booking.academicSituation || "",
  duration: Number(booking.duration) || 1,
  status: booking.status,
  price: Number(booking.price) || 0,
  notes: booking.notes || "",
  studentEvolution: booking.studentEvolution || "",
  emotionalState: booking.emotionalState || "",
});

const statusOptions = (mode, booking) => {
  if (mode === "create") return ["Pendiente", "Confirmado"];
  if (booking.status === "Pendiente") return ["Pendiente", "Confirmado", "Cancelado"];
  if (booking.status === "Confirmado") return ["Confirmado", "Finalizado", "Cancelado"];
  return [booking.status];
};

const Field = ({ label, children }) => (
  <label className="admin-field">
    <span>{label}</span>
    {children}
  </label>
);

const AdminBookingModal = ({
  mode,
  booking,
  initialTimeSlot,
  initialDateKey,
  slotDurationMinutes,
  durationOptions,
  authConfig,
  onClose,
  onSubmit,
  onConflict,
}) => {
  const isCreate = mode === "create";
  const defaultDuration = durationOptions[0];
  const initialSlot = initialTimeSlot || booking?.timeSlot || "";
  const [form, setForm] = useState(() =>
    isCreate
      ? emptyCreateForm(initialTimeSlot, defaultDuration)
      : editForm(booking),
  );
  const [slotDateKey, setSlotDateKey] = useState(() =>
    initialDateKey || (initialSlot ? businessDateKey(initialSlot) : businessDateKey(new Date())),
  );
  const [scheduleEditing, setScheduleEditing] = useState(isCreate);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const operationKeyRef = useRef(null);
  const errorRef = useRef(null);
  const dialogRef = useFocusTrap(true);
  const scheduleDirty = useMemo(
    () => bookingScheduleChanged(form, booking),
    [booking, form],
  );
  const requiresVerifiedSlot = requiresAuthoritativeSlot({
    mode,
    scheduleDirty,
  });
  const availability = useAdminAgenda({
    authConfig,
    anchorDateKey: slotDateKey,
    mode: "day",
    duration: form.duration,
    excludeBookingId: isCreate ? undefined : booking._id,
    enabled: isCreate || scheduleEditing,
  });

  const slots = useMemo(
    () => availability.data?.slots || [],
    [availability.data],
  );
  const selectedSlotIsAuthoritative = slots.some(
    (slot) => slot.timeSlot === form.timeSlot,
  );
  const title = isCreate ? "Crear turno" : `Editar turno de ${booking.studentName}`;
  const isTerminal = ["Finalizado", "Cancelado"].includes(booking?.status);

  useEffect(() => {
    if (feedback) errorRef.current?.focus();
  }, [feedback]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  useEffect(() => {
    if (
      !requiresVerifiedSlot ||
      availability.status !== "ready" ||
      selectedSlotIsAuthoritative
    ) return;
    setForm((current) => ({ ...current, timeSlot: "" }));
  }, [
    availability.status,
    requiresVerifiedSlot,
    selectedSlotIsAuthoritative,
  ]);

  const update = (field, value) => {
    operationKeyRef.current = null;
    setFeedback("");
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (
        isCreate &&
        field === "studentName" &&
        current.responsibleRelationship === "self"
      ) {
        next.responsibleName = value;
      }
      if (isCreate && field === "responsibleRelationship" && value === "self") {
        next.responsibleName = current.studentName;
        next.responsibleRelationshipOther = "";
      }
      if (
        isCreate &&
        field === "responsibleRelationship" &&
        value !== "self" &&
        current.responsibleRelationship === "self"
      ) {
        next.responsibleName = "";
      }
      return next;
    });
  };

  const moveSlotDay = (amount) => {
    setSlotDateKey((current) => addBusinessDays(current, amount));
    update("timeSlot", "");
  };

  const startScheduleEditing = () => {
    setScheduleEditing(true);
    setFeedback("");
    if (!durationOptions.includes(Number(form.duration))) {
      setForm((current) => ({
        ...current,
        duration: defaultDuration,
        timeSlot: "",
      }));
    }
  };

  const cancelScheduleEditing = () => {
    setScheduleEditing(false);
    setFeedback("");
    setSlotDateKey(businessDateKey(booking.timeSlot));
    setForm((current) => ({
      ...current,
      timeSlot: booking.timeSlot,
      duration: Number(booking.duration),
    }));
  };

  const validate = () => {
    const academicFields = [
      "subject",
      "educationLevel",
      "yearGrade",
      "school",
      "academicSituation",
    ];
    if (isCreate && academicFields.some((field) => !form[field].trim())) {
      return "Completá materia, nivel, año o grado, institución y objetivo académico.";
    }
    if (
      !isCreate &&
      academicFields.some(
        (field) => String(booking[field] || "").trim() && !form[field].trim(),
      )
    ) {
      return "Los datos académicos existentes no se pueden dejar vacíos.";
    }
    if (requiresVerifiedSlot && !selectedSlotIsAuthoritative) {
      return "Elegí un horario verificado por la agenda.";
    }
    if (isCreate) {
      if (!form.studentName.trim()) return "Completá el nombre del alumno.";
      if (!form.email.trim() && !form.phone.trim()) {
        return "Completá al menos un email o teléfono.";
      }
      if (
        form.responsibleRelationship !== "self" &&
        !form.responsibleName.trim()
      ) {
        return "Completá el nombre de la persona responsable.";
      }
    }
    return "";
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    const validationError = validate();
    if (validationError) {
      setFeedback(validationError);
      return;
    }
    setSaving(true);
    setFeedback("");
    try {
      const payload = isCreate
        ? buildAdminCreatePayload(form)
        : buildAdminUpdatePayload(form, booking);
      if (!isCreate && Object.keys(payload).length === 0) {
        setFeedback("No hay cambios para guardar.");
        return;
      }
      if (isCreate && !operationKeyRef.current) {
        operationKeyRef.current = createIdempotencyKey();
      }
      await onSubmit(payload, operationKeyRef.current);
      onClose();
    } catch (error) {
      setFeedback(
        error?.response?.data?.message ||
          error?.message ||
          "No se pudo guardar el turno.",
      );
      if (error?.response?.status === 409) {
        availability.retry();
        await onConflict?.();
      }
    } finally {
      setSaving(false);
    }
  };

  const availableOptions = useMemo(
    () => slots.map((slot) => ({
      value: slot.timeSlot,
      label: `${formatBusinessTime(slot.timeSlot)}–${formatBusinessTime(slot.endTime)}`,
    })),
    [slots],
  );

  return (
    <div className="admin-modal-overlay" onClick={saving ? undefined : onClose}>
      <div
        ref={dialogRef}
        className="admin-modal-card large agenda-booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-booking-modal-title"
        aria-describedby={feedback ? "agenda-booking-feedback" : undefined}
        aria-busy={saving}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-modal-header">
          <div>
            <span className="card-kicker">Agenda operativa</span>
            <h3 id="agenda-booking-modal-title">{title}</h3>
          </div>
          {!isCreate && <span className="code-mono">{booking.bookingCode}</span>}
        </header>

        <form onSubmit={submit}>
          <div className="admin-modal-body agenda-modal-grid">
            {isCreate ? (
              <fieldset className="agenda-modal-section agenda-modal-span">
                <legend>Identidad y contacto para el alta</legend>
                <div className="agenda-form-grid">
                  <Field label="Alumno">
                    <input className="admin-input" value={form.studentName} onChange={(event) => update("studentName", event.target.value)} required />
                  </Field>
                  <Field label="Vínculo responsable">
                    <select className="admin-input" value={form.responsibleRelationship} onChange={(event) => update("responsibleRelationship", event.target.value)}>
                      <option value="self">Alumno mayor de edad</option>
                      {RESPONSIBLE_RELATIONSHIP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  {form.responsibleRelationship !== "self" && (
                    <Field label="Persona responsable">
                      <input className="admin-input" value={form.responsibleName} onChange={(event) => update("responsibleName", event.target.value)} required />
                    </Field>
                  )}
                  {form.responsibleRelationship === "otro" && (
                    <Field label="Otro vínculo">
                      <input className="admin-input" value={form.responsibleRelationshipOther} onChange={(event) => update("responsibleRelationshipOther", event.target.value)} required />
                    </Field>
                  )}
                  <Field label="Email">
                    <input className="admin-input" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} />
                  </Field>
                  <Field label="Teléfono / WhatsApp">
                    <input className="admin-input" type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} />
                  </Field>
                </div>
              </fieldset>
            ) : (
              <section className="agenda-identity-readonly agenda-modal-span" aria-label="Identidad protegida">
                <strong>{booking.studentName}</strong>
                <span>La identidad y el contacto no se modifican desde la agenda.</span>
              </section>
            )}

            <fieldset className="agenda-modal-section agenda-modal-span">
              <legend>Clase</legend>
              <div className="agenda-form-grid">
                <Field label="Materia">
                  <input className="admin-input" value={form.subject} onChange={(event) => update("subject", event.target.value)} required={isCreate || Boolean(booking?.subject)} />
                </Field>
                <Field label="Nivel educativo">
                  <input className="admin-input" value={form.educationLevel} onChange={(event) => update("educationLevel", event.target.value)} required={isCreate || Boolean(booking?.educationLevel)} />
                </Field>
                <Field label="Año / Grado">
                  <input className="admin-input" value={form.yearGrade} onChange={(event) => update("yearGrade", event.target.value)} required={isCreate || Boolean(booking?.yearGrade)} />
                </Field>
                <Field label="Institución">
                  <input className="admin-input" value={form.school} onChange={(event) => update("school", event.target.value)} required={isCreate || Boolean(booking?.school)} />
                </Field>
                <Field label="Estado">
                  <select className="admin-input" value={form.status} onChange={(event) => update("status", event.target.value)}>
                    {statusOptions(mode, booking).map((status) => <option key={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Precio congelado">
                  <input className="admin-input" type="number" min="0" step="1" value={form.price} onChange={(event) => update("price", event.target.value)} />
                </Field>
              </div>
              <Field label="Objetivo o situación académica">
                <textarea className="admin-input admin-textarea" rows="2" maxLength="1200" value={form.academicSituation} onChange={(event) => update("academicSituation", event.target.value)} required={isCreate || Boolean(booking?.academicSituation)} />
              </Field>
            </fieldset>

            <fieldset className="agenda-modal-section agenda-modal-span">
              <legend>Horario verificado</legend>
              {!scheduleEditing && (
                <div className="agenda-current-schedule">
                  <span>
                    {formatBusinessDate(businessDateKey(form.timeSlot))} · {formatBusinessTime(form.timeSlot)} · {formatDurationLabel(form.duration)}
                  </span>
                  {!isTerminal && durationOptions.length > 0 && (
                    <button type="button" className="admin-secondary-btn slim" onClick={startScheduleEditing}>Reprogramar turno</button>
                  )}
                </div>
              )}
              {scheduleEditing && (
                <>
                  <div className="agenda-slot-toolbar">
                    <button type="button" className="cal-nav-btn" onClick={() => moveSlotDay(-1)} aria-label="Día anterior"><FaChevronLeft aria-hidden="true" /></button>
                    <strong>{formatBusinessDate(slotDateKey)}</strong>
                    <button type="button" className="cal-nav-btn" onClick={() => moveSlotDay(1)} aria-label="Día siguiente"><FaChevronRight aria-hidden="true" /></button>
                  </div>
                  <p className="settings-hint">Grilla configurada cada {slotDurationMinutes} minutos.</p>
                  <div className="agenda-form-grid">
                    <Field label="Duración">
                      <select className="admin-input" value={form.duration} onChange={(event) => update("duration", Number(event.target.value))}>
                        {durationOptions.map((duration) => <option key={duration} value={duration}>{formatDurationLabel(duration)}</option>)}
                      </select>
                    </Field>
                    <Field label="Horario disponible">
                      <select className="admin-input" value={form.timeSlot} onChange={(event) => update("timeSlot", event.target.value)} disabled={availability.status !== "ready"} required={requiresVerifiedSlot}>
                        <option value="">Seleccionar horario</option>
                        {availableOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                  </div>
                  {!isCreate && (
                    <button type="button" className="admin-secondary-btn slim" onClick={cancelScheduleEditing}>Conservar horario actual</button>
                  )}
                  {availability.status === "loading" && <p role="status" aria-live="polite">Verificando horarios…</p>}
                  {availability.status === "error" && (
                    <div className="agenda-inline-error" role="alert">
                      <span>{availability.error}</span>
                      <button type="button" className="admin-secondary-btn slim" onClick={availability.retry}>Reintentar</button>
                    </div>
                  )}
                  {availability.status === "ready" && availableOptions.length === 0 && <p role="status">No hay horarios disponibles para esa duración.</p>}
                </>
              )}
            </fieldset>

            <Field label="Notas privadas">
              <textarea className="admin-input admin-textarea" rows="3" maxLength="2000" value={form.notes} onChange={(event) => update("notes", event.target.value)} />
            </Field>
            {!isCreate && (
              <>
                <Field label="Evolución del alumno">
                  <textarea className="admin-input admin-textarea" rows="3" maxLength="5000" value={form.studentEvolution} onChange={(event) => update("studentEvolution", event.target.value)} />
                </Field>
                <Field label="Estado emocional">
                  <textarea className="admin-input admin-textarea" rows="3" maxLength="1000" value={form.emotionalState} onChange={(event) => update("emotionalState", event.target.value)} />
                </Field>
              </>
            )}
          </div>

          {feedback && (
            <p ref={errorRef} tabIndex="-1" id="agenda-booking-feedback" className="attendance-feedback error" role="alert" aria-live="assertive">{feedback}</p>
          )}

          <footer className="admin-modal-footer">
            <button type="button" className="admin-secondary-btn" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="admin-primary-btn slim" disabled={saving || (requiresVerifiedSlot && availability.status !== "ready")}>{saving ? "Guardando…" : isCreate ? "Crear turno" : "Guardar cambios"}</button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default AdminBookingModal;
