import {
  FaArrowLeft, FaBookOpen, FaCalendarAlt, FaEnvelope,
  FaGraduationCap, FaPhoneAlt, FaSchool, FaWhatsapp,
} from "react-icons/fa";
import { useEffect, useRef } from "react";
import {
  buildStudentKey, formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
} from "../../../utils/bookingFormatters";
import "./StudentDetail.css";

const STATUS_LABELS = {
  Pendiente: "pending", Confirmado: "confirmed",
  Finalizado: "finalized", Cancelado: "cancelled",
};

const relationshipLabel = (responsible, studentType) => {
  if (studentType === "adult" || responsible?.relationship === "self") {
    return "Alumno mayor de edad";
  }
  if (!responsible?.name) return "Alumno mayor de edad";
  return `${responsible.relationshipOther || responsible.relationship || "Responsable"}: ${responsible.name}`;
};

const StudentDetailView = ({
  data, legacyStudent, legacyBookings = [], loading, error,
  onRetry, onBack, onSelectBooking, onSendWhatsApp,
}) => {
  const backButtonRef = useRef(null);
  useEffect(() => { backButtonRef.current?.focus(); }, []);

  if (loading) return <section className="student-detail"><button ref={backButtonRef} type="button" className="sd-back-btn" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Volver</button><p role="status" className="admin-view-loading">Cargando perfil…</p></section>;
  if (error) return <section className="student-detail"><button ref={backButtonRef} type="button" className="sd-back-btn" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Volver</button><div role="alert" className="student-load-error"><p>{error}</p><button type="button" className="secondary-button" onClick={onRetry}>Reintentar</button></div></section>;

  const isLegacy = Boolean(legacyStudent);
  const student = isLegacy ? {
    id: legacyStudent.key,
    displayName: legacyStudent.studentName,
    studentType: "legacy",
    contact: { email: legacyStudent.email, phone: legacyStudent.phone },
    responsible: { name: legacyStudent.responsibleSummary },
    academic: {
      school: legacyStudent.school,
      educationLevel: legacyStudent.educationLevel,
      yearGrade: legacyStudent.yearGrade,
      subjects: legacyStudent.subjects || [],
    },
  } : data?.student;

  if (!student) return <section className="student-detail"><button ref={backButtonRef} type="button" className="sd-back-btn" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Volver</button><p role="alert">El perfil solicitado no está disponible.</p></section>;

  const recentBookings = isLegacy
    ? legacyBookings.filter((booking) => buildStudentKey(booking) === legacyStudent.key)
    : (data?.recentBookings || []);
  const metrics = isLegacy ? {
    bookingsCount: legacyStudent.totalBookings || recentBookings.length,
    nextBookingAt: legacyStudent.nextBooking,
  } : (data?.metrics || student.metrics || {});
  const subjects = student.academic?.subjects || [];
  const responsible = isLegacy ? legacyStudent.responsibleSummary : relationshipLabel(student.responsible, student.studentType);
  const phone = student.contact?.phone;
  const email = student.contact?.email;

  return (
    <section className="student-detail">
      <div className="sd-header">
        <button ref={backButtonRef} type="button" className="sd-back-btn" onClick={onBack}><FaArrowLeft aria-hidden="true" /> Volver a alumnos</button>
        <div className="sd-hero">
          <div className="sd-avatar" aria-hidden="true">{student.displayName?.charAt(0).toUpperCase()}</div>
          <div className="sd-hero-info">
            <h2 className="sd-name">{student.displayName}</h2>
            <p className="sd-responsible">{responsible}</p>
            <span className={`student-profile-badge ${isLegacy ? "pending" : "verified"}`}>{isLegacy ? "Perfil pendiente de migración" : "Perfil verificado"}</span>
            <div className="sd-stats-row"><span className="sd-stat"><strong>{metrics.bookingsCount || 0}</strong> reservas</span>{metrics.nextBookingAt && <span className="sd-stat"><strong>Próxima:</strong> {formatShortDate(new Date(metrics.nextBookingAt))}</span>}</div>
          </div>
        </div>
        <div className="sd-contact-bar">
          {phone && <a href={`tel:${phone}`} className="sd-contact-btn"><FaPhoneAlt aria-hidden="true" />{phone}</a>}
          {email && <a href={`mailto:${email}`} className="sd-contact-btn"><FaEnvelope aria-hidden="true" />{email}</a>}
          {phone && <button type="button" className="sd-contact-btn whatsapp" onClick={() => onSendWhatsApp({ phone, studentName: student.displayName, subject: subjects[0] || "", timeSlot: metrics.nextBookingAt || null, _id: `student-${student.id}` })}><FaWhatsapp aria-hidden="true" />WhatsApp</button>}
        </div>
      </div>

      <div className="sd-body">
        <div className="sd-col-left">
          <article className="sd-card"><h3 className="sd-card-title"><FaSchool aria-hidden="true" /> Información académica</h3><dl className="sd-dl">
            <dt>Institución</dt><dd>{student.academic?.school || "Sin datos"}</dd>
            <dt>Nivel educativo</dt><dd>{student.academic?.educationLevel || "Sin datos"}</dd>
            <dt>Año / Grado</dt><dd>{student.academic?.yearGrade || "Sin datos"}</dd>
          </dl></article>
          <article className="sd-card"><h3 className="sd-card-title"><FaBookOpen aria-hidden="true" /> Materias</h3>{subjects.length === 0 ? <p className="empty-copy">Sin materias registradas.</p> : <div className="student-subject-pills">{subjects.map((subject) => <span key={subject} className="student-subject-pill">{subject}</span>)}</div>}</article>
        </div>

        <div className="sd-col-right"><article className="sd-card"><h3 className="sd-card-title"><FaCalendarAlt aria-hidden="true" /> Historial reciente</h3>
          {recentBookings.length === 0 ? <p className="empty-copy">Sin sesiones registradas.</p> : <div className="sd-timeline">{[...recentBookings].reverse().map((booking) => (
            <button key={booking.id || booking._id} type="button" className={`sd-session-item ${STATUS_LABELS[booking.status] || ""}`} onClick={() => onSelectBooking({ ...booking, _id: booking._id || booking.id })}>
              <div className="sd-session-dot" aria-hidden="true" /><div className="sd-session-body"><div className="sd-session-head"><strong>{booking.subject || "Sin materia"}</strong><span className={`sd-session-status ${STATUS_LABELS[booking.status] || ""}`}>{booking.status}</span></div>
                <span className="sd-session-date"><FaGraduationCap aria-hidden="true" />{booking.timeSlot ? `${formatShortDate(new Date(booking.timeSlot))} · ${formatTime(new Date(booking.timeSlot))} h` : "--"}{booking.duration ? ` · ${booking.duration}h` : ""}</span></div>
            </button>
          ))}</div>}
        </article></div>
      </div>
    </section>
  );
};

export default StudentDetailView;
