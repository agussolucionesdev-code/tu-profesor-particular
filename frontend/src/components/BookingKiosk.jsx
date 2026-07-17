import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addMinutes, format, isToday, isTomorrow } from "date-fns";
import es from "date-fns/locale/es";
import {
  FaCheckCircle,
  FaChevronLeft,
  FaTicketAlt,
  FaLaptop,
  FaMapMarkerAlt,
  FaExclamationCircle,
  FaTimesCircle,
  FaInfoCircle,
  FaArrowRight,
  FaPencilAlt,
} from "react-icons/fa";
import BookingSuccessModal from "./booking/BookingSuccessModal";
import { createBooking, fetchPublicSettings } from "../api/bookingApi";
import { useBookingWizard } from "../hooks/useBookingWizard";
import { useBookingAvailability } from "../hooks/useBookingAvailability";
import { SUBJECT_SUGGESTIONS_BY_LEVEL } from "../constants/bookingWizard";
import {
  KIOSK_STEPS,
  LEVEL_OPTIONS,
  MODALITY_OPTIONS,
  KIOSK_DURATION_OPTIONS,
  getKioskYearGradeOptions,
  KIOSK_UPCOMING_DAYS,
  KIOSK_SLOTS_PER_DAY,
} from "../constants/kioskWizard";
import { toBookingApiAcademicSituation } from "../constants/bookingWizard";
import {
  ADULT_RELATIONSHIP_VALUE,
  RESPONSIBLE_RELATIONSHIP_OTHER_VALUE,
  formatResponsibleRelationshipLabel,
  formatDurationOptionLabel,
  getBookingApiMessage,
} from "../utils/bookingFormatters";
import { createIdempotencyKey } from "../utils/idempotencyKey";
import { parsePublicSubjectsByLevel } from "../utils/subjectSettings";
import { useNeuroToast } from "../utils/neuroToast";
import { usePageMeta } from "../hooks/useDocumentTitle";
import { createBookingFunnelTracker } from "../utils/bookingFunnel";
import "../styles/tokens.css";
import "../index.css";
// BookingSuccessModal no trae su CSS: sus clases (.success-overlay, .success-modal…)
// viven en estos dos archivos. El kiosco los importa para no renderizar el
// comprobante sin estilos.
import "./booking/BookingFinalExperience.css";
import "../styles/theme-polish.css";
import "./BookingKiosk.css";

const RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "hermana", label: "Hermana" },
  { value: "hermano", label: "Hermano" },
  { value: "tia", label: "Tía" },
  { value: "tio", label: "Tío" },
  { value: "abuela", label: "Abuela" },
  { value: "abuelo", label: "Abuelo" },
  { value: "prima", label: "Prima" },
  { value: "primo", label: "Primo" },
  { value: RESPONSIBLE_RELATIONSHIP_OTHER_VALUE, label: "Otro" },
];

const formatDayLabel = (dayObj) => {
  if (isToday(dayObj)) return "Hoy";
  if (isTomorrow(dayObj)) return "Mañana";
  return format(dayObj, "EEEE d 'de' MMMM", { locale: es });
};

const BookingKiosk = () => {
  usePageMeta(
    "Reservar clase",
    "Reservá tu clase particular en pocos pasos. Elegí materia, modalidad y horario. Agustín Elías Sosa, Buenos Aires.",
  );

  const { toast, showToast } = useNeuroToast({ duration: 4500 });
  const [step, setStep] = useState(1);
  const [pricePerHour, setPricePerHour] = useState(0);
  const [subjectsByLevelOverride, setSubjectsByLevelOverride] = useState(null);
  const [showAllDays, setShowAllDays] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [successData, setSuccessData] = useState(null);

  const cardRef = useRef(null);
  const bookingAttemptRef = useRef(null);
  const funnelRef = useRef(null);
  if (!funnelRef.current) funnelRef.current = createBookingFunnelTracker();

  const [searchParams] = useSearchParams();
  const prefill = useMemo(() => {
    const overrides = {};
    const materia = searchParams.get("materia");
    const nivel = searchParams.get("nivel");
    if (materia) overrides.subject = decodeURIComponent(materia);
    if (nivel) overrides.educationLevel = decodeURIComponent(nivel);
    return overrides;
  }, [searchParams]);

  const {
    formData,
    setFormData,
    isAdult,
    setHasAttemptedNext,
    isValidField,
    isPersonalInfoComplete,
    handleChange,
    toggleAdultMode,
    resetForm,
    getFieldStateClass,
  } = useBookingWizard(showToast, prefill);

  const {
    upcomingSlotsByDay,
    availabilityStatus,
    availabilityMatchesSelectedDuration,
    isSelectedTimeVerified,
    maxAllowedDuration,
    retryAvailability,
  } = useBookingAvailability(formData.timeSlot, formData.duration, showToast);

  useEffect(() => {
    funnelRef.current.start(1);
  }, []);

  useEffect(() => {
    fetchPublicSettings()
      .then((res) => {
        const data = res.data?.data ?? {};
        const price = Number(data["booking.pricePerHour"] ?? 0);
        if (price > 0) setPricePerHour(price);
        const parsed = parsePublicSubjectsByLevel(data["booking.subjectsByLevel"]);
        if (parsed) setSubjectsByLevelOverride(parsed);
      })
      .catch(() => {});
  }, []);

  // Al cambiar de paso: (1) llevar la tarjeta al tope del viewport solo si quedó
  // por encima —nada de auto-scroll agresivo, ese era el bug—, y (2) mover el
  // foco al título del paso para que teclado y lectores de pantalla no queden
  // huérfanos cuando la tarjeta anterior se desmonta. Se saltea en el primer
  // render (isMounted) para no robar el foco al cargar la página.
  const isMountedRef = useRef(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;

    const prefersReduced =
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
    const top = node.getBoundingClientRect().top;
    if (top < 0 || top > 160) {
      const navH = document.querySelector(".navbar-elite")?.getBoundingClientRect().height ?? 0;
      const y = node.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top: Math.max(0, y), behavior: prefersReduced ? "auto" : "smooth" });
    }

    if (isMountedRef.current) {
      const heading = node.querySelector(".kiosk-title");
      heading?.focus?.({ preventScroll: true });
    }
    isMountedRef.current = true;
  }, [step]);

  const subjectsForLevel = useMemo(() => {
    const source = subjectsByLevelOverride ?? SUBJECT_SUGGESTIONS_BY_LEVEL;
    return source[formData.educationLevel] ?? [];
  }, [subjectsByLevelOverride, formData.educationLevel]);

  const selectableDurations = useMemo(
    () => KIOSK_DURATION_OPTIONS.filter((opt) => opt.value <= maxAllowedDuration),
    [maxAllowedDuration],
  );

  const visibleDays = useMemo(() => {
    const days = upcomingSlotsByDay;
    return showAllDays ? days : days.slice(0, KIOSK_UPCOMING_DAYS);
  }, [upcomingSlotsByDay, showAllDays]);

  const setField = (name, value) => handleChange({ target: { name, value } });

  // ── Navegación ──────────────────────────────────────────────────────────
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));
  const goToStep = (target) => {
    if (target < step) setStep(target);
  };

  // ── Paso 1: Materia ───────────────────────────────────────────────────────
  const chooseLevel = (level) => {
    setField("educationLevel", level); // handleChange limpia subject y yearGrade
    funnelRef.current.stageChange(1, 1);
  };
  const chooseSubject = (subject) => {
    setField("subject", subject);
    setStep(2);
  };

  // ── Paso 2: Modalidad ─────────────────────────────────────────────────────
  const chooseModality = (modality) => {
    setField("modality", modality);
    setStep(3);
  };

  // ── Paso 3: Turno ─────────────────────────────────────────────────────────
  const chooseDuration = (value) => {
    // Cambiar la duración puede invalidar el turno ya elegido: se limpia para
    // forzar una nueva elección coherente con la disponibilidad recalculada.
    setFormData((prev) => ({ ...prev, duration: value, timeSlot: null }));
  };
  const chooseSlot = (timeObj) => {
    setFormData((prev) => ({ ...prev, timeSlot: timeObj }));
    setStep(4);
  };

  // ── Paso 4: Datos ─────────────────────────────────────────────────────────
  const canProceedContact =
    isPersonalInfoComplete && isValidField("yearGrade") && isValidField("objective");

  const submitContact = () => {
    if (!canProceedContact) {
      setHasAttemptedNext(true);
      showToast("Revisá los campos resaltados para continuar.", "error", {
        title: "Faltan datos",
      });
      return;
    }
    setHasAttemptedNext(false);
    setStep(5);
  };

  // ── Paso 5: Confirmar ─────────────────────────────────────────────────────
  const isReadyToSubmit =
    Boolean(formData.timeSlot) &&
    Number(formData.duration) >= 0.5 &&
    availabilityStatus === "ready" &&
    availabilityMatchesSelectedDuration &&
    isSelectedTimeVerified;

  const responsibleRelationshipLabel = formatResponsibleRelationshipLabel(
    isAdult ? ADULT_RELATIONSHIP_VALUE : formData.responsibleRelationship,
    formData.responsibleRelationshipOther,
  );

  const priceLabel =
    pricePerHour > 0 && formData.duration
      ? new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 0,
        }).format(pricePerHour * Number(formData.duration))
      : "";

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!isReadyToSubmit) {
      showToast("Esperá a que confirmemos la disponibilidad del turno.", "warning");
      return;
    }
    setLoading(true);
    setSubmitError("");
    try {
      const dateObj = formData.timeSlot;
      const formattedDate = `${String(dateObj.getDate()).padStart(2, "0")}/${String(dateObj.getMonth() + 1).padStart(2, "0")}/${dateObj.getFullYear()} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
      const finalResponsibleName = isAdult
        ? "Mayor de edad / Responsable"
        : formData.responsibleName;
      const finalResponsibleRelationship = isAdult
        ? ADULT_RELATIONSHIP_VALUE
        : formData.responsibleRelationship;
      const finalResponsibleRelationshipOther =
        finalResponsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE
          ? formData.responsibleRelationshipOther.trim()
          : "";
      const safeEmail = formData.email.trim();

      const payload = {
        studentName: formData.studentName,
        responsibleName: finalResponsibleName,
        responsibleRelationship: finalResponsibleRelationship,
        responsibleRelationshipOther: finalResponsibleRelationshipOther,
        email: safeEmail,
        phone: formData.phone,
        school: formData.school.trim(),
        educationLevel: formData.educationLevel,
        yearGrade: formData.yearGrade,
        subject: formData.subject,
        modality: formData.modality,
        academicSituation: toBookingApiAcademicSituation(formData),
        timeSlot: formattedDate,
        duration: Number(formData.duration),
        tutorName: "Agustin",
      };

      const fingerprint = JSON.stringify(payload);
      if (bookingAttemptRef.current?.fingerprint !== fingerprint) {
        bookingAttemptRef.current = { fingerprint, key: createIdempotencyKey() };
      }
      const response = await createBooking(payload, bookingAttemptRef.current.key);
      bookingAttemptRef.current = null;
      funnelRef.current.complete(5);

      const end = addMinutes(dateObj, Number(formData.duration) * 60);
      const bookingCode = response.data.data.bookingCode;
      const managementUrl = response.data.data.managementUrl;
      const managementMethods = [
        { label: "Código", value: bookingCode, helper: "Pegalo tal cual en Mis Turnos." },
        ...(safeEmail
          ? [{ label: "Email", value: safeEmail, helper: "También sirve para reencontrar la reserva." }]
          : []),
        ...(formData.phone
          ? [{ label: "Teléfono", value: formData.phone, helper: "El mismo número que cargaste." }]
          : []),
      ];
      setSuccessData({
        bookingCode,
        rawTimeSlot: dateObj.toISOString(),
        rawEndTime: end.toISOString(),
        day: format(dateObj, "EEEE d 'de' MMMM 'de' yyyy", { locale: es }),
        startTime: format(dateObj, "HH:mm"),
        endTime: format(end, "HH:mm"),
        actualDuration: formData.duration,
        durationLabel: formatDurationOptionLabel(formData.duration),
        cleanStudentName: formData.studentName,
        responsibleLabel: isAdult ? null : formData.responsibleName,
        responsibleRelationshipLabel: isAdult ? null : responsibleRelationshipLabel,
        email: safeEmail,
        phone: formData.phone,
        subject: formData.subject,
        modality: formData.modality,
        educationLevel: [formData.educationLevel, formData.yearGrade].filter(Boolean).join(" - "),
        notifications: response.data.notifications || null,
        managementMethods,
        managementUrl,
      });
      setShowModal(true);
    } catch (error) {
      const msg = getBookingApiMessage(error);
      showToast(msg, "error");
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetAfterSuccess = () => {
    setShowModal(false);
    resetForm();
    setStep(1);
    setShowAllDays(false);
    funnelRef.current = createBookingFunnelTracker();
    funnelRef.current.start(1);
  };

  const whatsappConfirmText = successData
    ? [
        "Hola Prof. Agustín. Acabo de reservar un turno.",
        "",
        `Alumno: ${successData.cleanStudentName}`,
        `Materia: ${successData.subject}`,
        `Modalidad: ${successData.modality === "presencial" ? "Presencial" : "Online"}`,
        `Fecha: ${successData.day}`,
        `Horario: ${successData.startTime} a ${successData.endTime} h`,
        `Código: ${successData.bookingCode}`,
        successData.managementUrl ? `Gestión: ${successData.managementUrl}` : null,
        "",
        "Gracias.",
      ]
        .filter((l) => l !== null)
        .join("\n")
    : "";

  const toastMeta = {
    success: { icon: <FaCheckCircle />, title: "Todo listo" },
    warning: { icon: <FaExclamationCircle />, title: "Atención" },
    error: { icon: <FaTimesCircle />, title: "Revisá esto" },
    info: { icon: <FaInfoCircle />, title: "Info" },
  }[toast.type || "info"];

  return (
    <div className="kiosk-wrapper">
      <div
        className={`kiosk-toast ${toast.show ? "show" : ""} ${toast.type}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span className="kiosk-toast-icon" aria-hidden="true">{toastMeta.icon}</span>
        <div className="kiosk-toast-copy">
          <strong>{toast.title || toastMeta.title}</strong>
          <span>{toast.message}</span>
        </div>
      </div>

      <div className="kiosk-card" ref={cardRef}>
        <div className="kiosk-card-head">
          <Link to="/portal" className="kiosk-portal-link">
            <FaTicketAlt aria-hidden="true" /> Ver mis turnos
          </Link>
        </div>

        {/* Stepper honesto: 5 pasos reales */}
        <nav
          className="kiosk-stepper"
          aria-label="Progreso de la reserva"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={KIOSK_STEPS.length}
          aria-valuenow={step}
          aria-valuetext={`Paso ${step} de ${KIOSK_STEPS.length}: ${KIOSK_STEPS[step - 1].label}`}
        >
          {KIOSK_STEPS.map((s) => {
            const state = step > s.id ? "done" : step === s.id ? "current" : "todo";
            return (
              <button
                key={s.id}
                type="button"
                className={`kiosk-step is-${state}`}
                onClick={() => goToStep(s.id)}
                disabled={s.id >= step}
                aria-current={step === s.id ? "step" : undefined}
              >
                <span className="kiosk-step-dot" aria-hidden="true">
                  {step > s.id ? <FaCheckCircle /> : s.id}
                </span>
                <span className="kiosk-step-label">{s.short}</span>
              </button>
            );
          })}
        </nav>

        {/* ─── PASO 1: MATERIA ─── */}
        {step === 1 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s1-title">
            {!formData.educationLevel ? (
              <>
                <h1 id="kiosk-s1-title" className="kiosk-title" tabIndex={-1}>¿Qué estás cursando?</h1>
                <p className="kiosk-subtitle">Elegí el nivel para ver las materias.</p>
                <div className="kiosk-grid kiosk-grid-levels">
                  {LEVEL_OPTIONS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      className="kiosk-choice-card"
                      onClick={() => chooseLevel(lvl.value)}
                    >
                      <span className="kiosk-choice-label">{lvl.label}</span>
                      <span className="kiosk-choice-hint">{lvl.hint}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="kiosk-title-row">
                  <div>
                    <h1 id="kiosk-s1-title" className="kiosk-title" tabIndex={-1}>¿Qué materia?</h1>
                    <p className="kiosk-subtitle">
                      Nivel: <strong>{formData.educationLevel}</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="kiosk-inline-btn"
                    onClick={() => setField("educationLevel", "")}
                  >
                    <FaPencilAlt aria-hidden="true" /> Cambiar nivel
                  </button>
                </div>
                <div className="kiosk-grid kiosk-grid-subjects">
                  {subjectsForLevel.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      className={`kiosk-choice-card kiosk-choice-compact ${formData.subject === subject ? "is-selected" : ""}`}
                      onClick={() => chooseSubject(subject)}
                    >
                      <span className="kiosk-choice-label">{subject}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ─── PASO 2: MODALIDAD ─── */}
        {step === 2 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s2-title">
            <h1 id="kiosk-s2-title" className="kiosk-title" tabIndex={-1}>¿Cómo preferís la clase?</h1>
            <p className="kiosk-subtitle">
              {formData.subject} · {formData.educationLevel}
            </p>
            <div className="kiosk-grid kiosk-grid-modality">
              {MODALITY_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  className={`kiosk-choice-card kiosk-choice-modality ${formData.modality === m.value ? "is-selected" : ""}`}
                  onClick={() => chooseModality(m.value)}
                >
                  <span className="kiosk-choice-icon" aria-hidden="true">
                    {m.value === "online" ? <FaLaptop /> : <FaMapMarkerAlt />}
                  </span>
                  <span className="kiosk-choice-label">{m.label}</span>
                  <span className="kiosk-choice-hint">{m.hint}</span>
                </button>
              ))}
            </div>
            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 3: TURNO ─── */}
        {step === 3 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s3-title">
            <h1 id="kiosk-s3-title" className="kiosk-title" tabIndex={-1}>¿Cuánto dura y cuándo?</h1>
            <p className="kiosk-subtitle">Elegí la duración y después el horario que más te sirva.</p>

            <div className="kiosk-field-label">Duración</div>
            <div className="kiosk-chips">
              {selectableDurations.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`kiosk-chip ${Number(formData.duration) === opt.value ? "is-selected" : ""}`}
                  onClick={() => chooseDuration(opt.value)}
                >
                  {opt.label}
                  {opt.recommended && <span className="kiosk-chip-tag">Recomendado</span>}
                </button>
              ))}
            </div>

            {formData.duration ? (
              <div role="status" aria-live="polite">
                <div className="kiosk-field-label">Próximos turnos disponibles</div>
                {availabilityStatus === "loading" && (
                  <p className="kiosk-muted">Buscando horarios libres…</p>
                )}
                {availabilityStatus === "error" && (
                  <div className="kiosk-empty">
                    <p>No pudimos cargar la agenda.</p>
                    <button type="button" className="kiosk-inline-btn" onClick={retryAvailability}>
                      Reintentar
                    </button>
                  </div>
                )}
                {availabilityStatus === "ready" && visibleDays.length === 0 && (
                  <p className="kiosk-muted">
                    No hay turnos para esta duración en el período habilitado. Probá una duración más corta.
                  </p>
                )}
                {availabilityStatus === "ready" &&
                  visibleDays.map((day) => (
                    <div key={day.dateKey} className="kiosk-day-group">
                      <div className="kiosk-day-label">{formatDayLabel(day.dayObj)}</div>
                      <div className="kiosk-slots">
                        {day.slots.slice(0, KIOSK_SLOTS_PER_DAY).map((slot) => (
                          <button
                            key={slot.timeObj.toISOString()}
                            type="button"
                            className="kiosk-slot"
                            onClick={() => chooseSlot(slot.timeObj)}
                          >
                            {format(slot.timeObj, "HH:mm")}
                          </button>
                        ))}
                        {day.slots.length > KIOSK_SLOTS_PER_DAY && (
                          <span className="kiosk-slot-more">
                            +{day.slots.length - KIOSK_SLOTS_PER_DAY} más
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                {availabilityStatus === "ready" &&
                  !showAllDays &&
                  upcomingSlotsByDay.length > KIOSK_UPCOMING_DAYS && (
                    <button
                      type="button"
                      className="kiosk-inline-btn kiosk-more-days"
                      onClick={() => setShowAllDays(true)}
                    >
                      Ver más fechas ({upcomingSlotsByDay.length - KIOSK_UPCOMING_DAYS})
                    </button>
                  )}
              </div>
            ) : (
              <p className="kiosk-muted">Elegí una duración para ver los horarios.</p>
            )}

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 4: DATOS ─── */}
        {step === 4 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s4-title">
            <h1 id="kiosk-s4-title" className="kiosk-title" tabIndex={-1}>Tus datos</h1>
            <p className="kiosk-subtitle">Solo lo necesario para confirmar y avisarte.</p>

            <div className="kiosk-form-grid">
              <label className="kiosk-field">
                <span className="kiosk-field-label">Nombre del alumno *</span>
                <input
                  type="text"
                  name="studentName"
                  className={`kiosk-input ${getFieldStateClass("studentName")}`}
                  value={formData.studentName}
                  onChange={handleChange}
                  placeholder="Nombre y apellido"
                  autoComplete="name"
                />
              </label>

              <label className="kiosk-field">
                <span className="kiosk-field-label">Teléfono / WhatsApp *</span>
                <input
                  type="tel"
                  name="phone"
                  className={`kiosk-input ${getFieldStateClass("phone")}`}
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 9 11 1234 5678"
                  autoComplete="tel"
                />
              </label>

              <label className="kiosk-field">
                <span className="kiosk-field-label">Email (opcional)</span>
                <input
                  type="email"
                  name="email"
                  className={`kiosk-input ${getFieldStateClass("email", true)}`}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tucorreo@email.com"
                  autoComplete="email"
                />
              </label>

              <label className="kiosk-field">
                <span className="kiosk-field-label">Año / grado *</span>
                <select
                  name="yearGrade"
                  className={`kiosk-input ${getFieldStateClass("yearGrade")}`}
                  value={formData.yearGrade}
                  onChange={handleChange}
                >
                  <option value="">Elegí una opción</option>
                  {getKioskYearGradeOptions(formData.educationLevel).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="kiosk-adult-toggle">
              <label className="kiosk-check">
                <input type="checkbox" checked={isAdult} onChange={toggleAdultMode} />
                <span>Soy el alumno y soy mayor de edad</span>
              </label>
            </div>

            {!isAdult && (
              <div className="kiosk-form-grid">
                <label className="kiosk-field">
                  <span className="kiosk-field-label">Nombre del responsable *</span>
                  <input
                    type="text"
                    name="responsibleName"
                    className={`kiosk-input ${getFieldStateClass("responsibleName")}`}
                    value={formData.responsibleName}
                    onChange={handleChange}
                    placeholder="Nombre y apellido"
                  />
                </label>
                <label className="kiosk-field">
                  <span className="kiosk-field-label">Vínculo *</span>
                  <select
                    name="responsibleRelationship"
                    className={`kiosk-input ${getFieldStateClass("responsibleRelationship")}`}
                    value={formData.responsibleRelationship}
                    onChange={handleChange}
                  >
                    <option value="">Elegí una opción</option>
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </label>
                {formData.responsibleRelationship === RESPONSIBLE_RELATIONSHIP_OTHER_VALUE && (
                  <label className="kiosk-field">
                    <span className="kiosk-field-label">¿Cuál? *</span>
                    <input
                      type="text"
                      name="responsibleRelationshipOther"
                      className={`kiosk-input ${getFieldStateClass("responsibleRelationshipOther")}`}
                      value={formData.responsibleRelationshipOther}
                      onChange={handleChange}
                      placeholder="Indicá el vínculo"
                    />
                  </label>
                )}
              </div>
            )}

            <label className="kiosk-field">
              <span className="kiosk-field-label">¿Qué querés lograr en la clase? *</span>
              <textarea
                name="objective"
                className={`kiosk-input kiosk-textarea ${getFieldStateClass("objective")}`}
                value={formData.objective}
                onChange={handleChange}
                rows={3}
                placeholder="Ej: preparar el examen de la semana que viene, entender ecuaciones…"
                maxLength={300}
              />
            </label>

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
              <button type="button" className="kiosk-primary" onClick={submitContact}>
                Continuar <FaArrowRight aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* ─── PASO 5: CONFIRMAR ─── */}
        {step === 5 && (
          <section className="kiosk-step-panel" aria-labelledby="kiosk-s5-title">
            <h1 id="kiosk-s5-title" className="kiosk-title" tabIndex={-1}>Revisá y confirmá</h1>
            <p className="kiosk-subtitle">Si algo no está bien, tocá el paso de arriba para editarlo.</p>

            <dl className="kiosk-summary">
              <div><dt>Materia</dt><dd>{formData.subject}</dd></div>
              <div><dt>Nivel</dt><dd>{[formData.educationLevel, formData.yearGrade].filter(Boolean).join(" · ")}</dd></div>
              <div>
                <dt>Modalidad</dt>
                <dd>{formData.modality === "presencial" ? "Presencial" : "Online"}</dd>
              </div>
              <div>
                <dt>Fecha</dt>
                <dd>
                  {formData.timeSlot
                    ? format(formData.timeSlot, "EEEE d 'de' MMMM", { locale: es })
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Horario</dt>
                <dd>
                  {formData.timeSlot
                    ? `${format(formData.timeSlot, "HH:mm")} a ${format(addMinutes(formData.timeSlot, Number(formData.duration) * 60), "HH:mm")} h`
                    : "—"}
                </dd>
              </div>
              <div><dt>Alumno</dt><dd>{formData.studentName}</dd></div>
              {priceLabel && (
                <div><dt>Estimado</dt><dd>{priceLabel}</dd></div>
              )}
            </dl>

            {submitError && (
              <p className="kiosk-error" role="alert">{submitError}</p>
            )}

            <div className="kiosk-nav">
              <button type="button" className="kiosk-back" onClick={goPrev} disabled={loading}>
                <FaChevronLeft aria-hidden="true" /> Volver
              </button>
              <button
                type="button"
                className="kiosk-primary kiosk-confirm"
                onClick={handleSubmit}
                disabled={loading || !isReadyToSubmit}
              >
                {loading ? "Confirmando…" : "Confirmar reserva"}
              </button>
            </div>
          </section>
        )}
      </div>

      <BookingSuccessModal
        show={showModal}
        successData={successData}
        whatsappConfirmText={whatsappConfirmText}
        onCopyCode={() => {
          if (successData?.bookingCode) navigator.clipboard?.writeText(successData.bookingCode);
        }}
        onCopyManagementLink={() => {
          if (successData?.managementUrl) navigator.clipboard?.writeText(successData.managementUrl);
        }}
        onClose={resetAfterSuccess}
      />
    </div>
  );
};

export default BookingKiosk;
