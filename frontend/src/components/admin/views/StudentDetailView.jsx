import {
  FaArrowLeft,
  FaBookOpen,
  FaCalendarAlt,
  FaEnvelope,
  FaGraduationCap,
  FaLayerGroup,
  FaPhoneAlt,
  FaSchool,
  FaWhatsapp,
} from "react-icons/fa";
import {
  buildStudentKey as studentKey,
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
} from "../../../utils/bookingFormatters";
import "./StudentDetail.css";

const STATUS_LABELS = {
  Pendiente: "pending",
  Confirmado: "confirmed",
  Finalizado: "finalized",
  Cancelado: "cancelled",
};

const StudentDetailView = ({
  student,
  sortedBookings,
  onBack,
  onSelectBooking,
  onSendWhatsApp,
}) => {
  const studentBookings = sortedBookings
    .filter((b) => studentKey(b) === student.key)
    .sort(
      (a, b) =>
        new Date(a.timeSlot).getTime() - new Date(b.timeSlot).getTime(),
    );

  const finalized = studentBookings.filter((b) => b.status === "Finalizado");
  const upcoming = studentBookings.filter(
    (b) =>
      b.status !== "Cancelado" && new Date(b.timeSlot) > new Date(),
  );

  const subjectsMap = new Map();
  studentBookings.forEach((b) => {
    if (b.subject) {
      subjectsMap.set(b.subject, (subjectsMap.get(b.subject) || 0) + 1);
    }
  });
  const subjectList = [...subjectsMap.entries()].sort((a, b) => b[1] - a[1]);
  const maxSubjectCount = subjectList[0]?.[1] || 1;

  const hasNotes = (b) => b.notes || b.studentEvolution || b.emotionalState;

  const activityNotes = studentBookings.filter(hasNotes);

  return (
    <section className="student-detail">
      {/* Header */}
      <div className="sd-header">
        <button
          type="button"
          className="sd-back-btn"
          onClick={onBack}
          title="Volver a la lista"
        >
          <FaArrowLeft aria-hidden="true" /> Volver
        </button>

        <div className="sd-hero">
          <div className="sd-avatar" aria-hidden="true">
            {student.studentName.charAt(0).toUpperCase()}
          </div>
          <div className="sd-hero-info">
            <h2 className="sd-name">{student.studentName}</h2>
            <p className="sd-responsible">{student.responsibleSummary}</p>
            <div className="sd-stats-row">
              <span className="sd-stat">
                <strong>{studentBookings.length}</strong> reservas
              </span>
              <span className="sd-stat">
                <strong>{finalized.length}</strong> finalizadas
              </span>
              <span className="sd-stat">
                <strong>{upcoming.length}</strong> próximas
              </span>
            </div>
          </div>
        </div>

        {/* Contact actions */}
        <div className="sd-contact-bar">
          {student.phone && (
            <a
              href={`tel:${student.phone}`}
              className="sd-contact-btn"
              title={`Llamar: ${student.phone}`}
            >
              <FaPhoneAlt aria-hidden="true" />
              {student.phone}
            </a>
          )}
          {student.email && (
            <a
              href={`mailto:${student.email}`}
              className="sd-contact-btn"
              title={`Email: ${student.email}`}
            >
              <FaEnvelope aria-hidden="true" />
              {student.email}
            </a>
          )}
          {student.phone && (
            <button
              type="button"
              className="sd-contact-btn whatsapp"
              title="Enviar WhatsApp"
              onClick={() =>
                onSendWhatsApp({
                  phone: student.phone,
                  studentName: student.studentName,
                  subject: student.subjects[0] || "",
                  timeSlot: upcoming[0]?.timeSlot || null,
                  _id: `student-${student.key}`,
                })
              }
            >
              <FaWhatsapp aria-hidden="true" />
              WhatsApp
            </button>
          )}
        </div>
      </div>

      {/* 2-col body */}
      <div className="sd-body">
        {/* Left: info + subjects */}
        <div className="sd-col-left">
          <article className="sd-card">
            <h4 className="sd-card-title">
              <FaSchool aria-hidden="true" /> Información académica
            </h4>
            <dl className="sd-dl">
              <dt>Institución</dt>
              <dd>{studentBookings[0]?.school || "Sin datos"}</dd>
              <dt>Nivel educativo</dt>
              <dd>{studentBookings[0]?.educationLevel || "Sin datos"}</dd>
              <dt>Año / Grado</dt>
              <dd>{studentBookings[0]?.yearGrade || "Sin datos"}</dd>
            </dl>
          </article>

          <article className="sd-card">
            <h4 className="sd-card-title">
              <FaBookOpen aria-hidden="true" /> Materias
            </h4>
            {subjectList.length === 0 ? (
              <p className="empty-copy">Sin materias registradas.</p>
            ) : (
              <div className="sd-subject-list">
                {subjectList.map(([subject, count]) => (
                  <div key={subject} className="sd-subject-row">
                    <div className="sd-subject-copy">
                      <strong>{subject}</strong>
                      <span>{count} sesión{count !== 1 ? "es" : ""}</span>
                    </div>
                    <div className="sd-subject-bar-track" aria-hidden="true">
                      <div
                        className="sd-subject-bar-fill"
                        style={{ width: `${(count / maxSubjectCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          {activityNotes.length > 0 && (
            <article className="sd-card">
              <h4 className="sd-card-title">
                <FaLayerGroup aria-hidden="true" /> Notas del profe
              </h4>
              <div className="sd-notes-list">
                {activityNotes.map((b) => (
                  <div key={b._id} className="sd-note-item">
                    <small className="sd-note-date">
                      {b.timeSlot
                        ? `${formatShortDate(new Date(b.timeSlot))} · ${formatTime(new Date(b.timeSlot))}`
                        : "--"}
                    </small>
                    {b.notes && (
                      <p>
                        <strong>Notas:</strong> {b.notes}
                      </p>
                    )}
                    {b.studentEvolution && (
                      <p>
                        <strong>Evolución:</strong> {b.studentEvolution}
                      </p>
                    )}
                    {b.emotionalState && (
                      <p>
                        <strong>Estado emocional:</strong> {b.emotionalState}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </article>
          )}
        </div>

        {/* Right: timeline */}
        <div className="sd-col-right">
          <article className="sd-card">
            <h4 className="sd-card-title">
              <FaCalendarAlt aria-hidden="true" /> Historial de sesiones
            </h4>
            {studentBookings.length === 0 ? (
              <p className="empty-copy">Sin sesiones registradas.</p>
            ) : (
              <div className="sd-timeline">
                {[...studentBookings].reverse().map((b) => (
                  <button
                    key={b._id}
                    type="button"
                    className={`sd-session-item ${STATUS_LABELS[b.status] || ""}`}
                    onClick={() => onSelectBooking(b)}
                    title="Ver ficha completa"
                  >
                    <div className="sd-session-dot" aria-hidden="true" />
                    <div className="sd-session-body">
                      <div className="sd-session-head">
                        <strong>{b.subject || "Sin materia"}</strong>
                        <span className={`sd-session-status ${STATUS_LABELS[b.status] || ""}`}>
                          {b.status}
                        </span>
                      </div>
                      <span className="sd-session-date">
                        <FaGraduationCap aria-hidden="true" />
                        {b.timeSlot
                          ? `${formatShortDate(new Date(b.timeSlot))} · ${formatTime(new Date(b.timeSlot))} h`
                          : "--"}
                        {b.duration ? ` · ${b.duration}h` : ""}
                      </span>
                      {b.price > 0 && (
                        <span className="sd-session-price">
                          ${Number(b.price).toLocaleString("es-AR")}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
};

export default StudentDetailView;
