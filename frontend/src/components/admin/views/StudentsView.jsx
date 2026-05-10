import { useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaSearch,
  FaUserGraduate,
} from "react-icons/fa";
import {
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
  normalizeText as norm,
} from "../../../utils/bookingFormatters";
import StudentDetailView from "./StudentDetailView";

/* Activity level based on booking data */
const getActivityLevel = (student) => {
  if (student.nextBooking) return "active"; // has future booking
  const last = student.lastBooking;
  if (!last) return "inactive";
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  return last >= twoWeeksAgo ? "recent" : "inactive";
};

const ACTIVITY_LABELS = {
  active: "Activo",
  recent: "Sin turno",
  inactive: "Inactivo",
};

const StudentsView = ({
  students,
  sortedBookings,
  onSelectBooking,
  onSendWhatsApp,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const enrichedStudents = useMemo(() => {
    const now = new Date();
    return students.map((s) => {
      const bookings = sortedBookings.filter(
        (b) =>
          norm(b.studentName) === norm(s.studentName) &&
          b.status !== "Cancelado",
      );
      const past = bookings
        .filter((b) => new Date(b.timeSlot) < now)
        .sort(
          (a, b) =>
            new Date(b.timeSlot).getTime() - new Date(a.timeSlot).getTime(),
        );
      return { ...s, lastBooking: past[0] ? new Date(past[0].timeSlot) : null };
    });
  }, [students, sortedBookings]);

  const filtered = useMemo(() => {
    const term = norm(searchTerm);
    if (!term) return enrichedStudents;
    return enrichedStudents.filter((s) => s.searchBlob.includes(term));
  }, [enrichedStudents, searchTerm]);

  if (selectedStudent) {
    return (
      <StudentDetailView
        student={selectedStudent}
        sortedBookings={sortedBookings}
        onBack={() => setSelectedStudent(null)}
        onSelectBooking={onSelectBooking}
        onSendWhatsApp={onSendWhatsApp}
      />
    );
  }

  return (
    <section className="admin-card">
      <div className="admin-card-header spread">
        <div>
          <span className="card-kicker">Registro</span>
          <h3>Alumnos y responsables</h3>
        </div>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search-box">
          <FaSearch aria-hidden="true" />
          <span className="sr-only">Buscar alumno</span>
          <input
            type="search"
            placeholder="Buscar alumno, responsable, materia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
        </label>
        {searchTerm && (
          <p className="admin-search-count" aria-live="polite">
            {filtered.length} de {students.length} alumnos
          </p>
        )}
      </div>

      <div className="students-grid">
        {filtered.length === 0 ? (
          <p className="empty-copy">
            No hay alumnos que coincidan con la búsqueda.
          </p>
        ) : (
          filtered.map((student) => {
            const activity = getActivityLevel(student);
            return (
              <article key={student.key} className="student-card">
                <div className="student-card-top">
                  <div className="student-card-name-group">
                    <div className={`student-activity-dot ${activity}`} title={ACTIVITY_LABELS[activity]} />
                    <div>
                      <strong>{student.studentName}</strong>
                      <span>{student.responsibleSummary}</span>
                    </div>
                  </div>
                  <span className="student-metric">
                    {student.totalBookings} turno{student.totalBookings !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Subject pills */}
                {student.subjects.length > 0 && (
                  <div className="student-subject-pills">
                    {student.subjects.slice(0, 3).map((s) => (
                      <span key={s} className="student-subject-pill">{s}</span>
                    ))}
                    {student.subjects.length > 3 && (
                      <span className="student-subject-pill more">
                        +{student.subjects.length - 3}
                      </span>
                    )}
                  </div>
                )}

                <div className="student-session-row">
                  <div>
                    <FaCalendarAlt aria-hidden="true" />
                    <span>
                      {student.lastBooking
                        ? `Última: ${formatShortDate(student.lastBooking)}`
                        : "Sin sesiones"}
                    </span>
                  </div>
                  <div>
                    <FaCalendarAlt aria-hidden="true" />
                    <span>
                      {student.nextBooking
                        ? `Próxima: ${formatShortDate(student.nextBooking)} ${formatTime(student.nextBooking)}`
                        : "Sin próximo turno"}
                    </span>
                  </div>
                </div>

                <div className="student-card-footer">
                  <span className={`student-activity-label ${activity}`}>
                    {ACTIVITY_LABELS[activity]}
                  </span>
                  <button
                    type="button"
                    className="inline-link-btn"
                    onClick={() => setSelectedStudent(student)}
                  >
                    <FaUserGraduate aria-hidden="true" /> Ver perfil
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
};

export default StudentsView;
