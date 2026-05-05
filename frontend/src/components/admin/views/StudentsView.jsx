import {
  FaBookOpen,
  FaCalendarAlt,
  FaIdCard,
  FaLayerGroup,
  FaSchool,
} from "react-icons/fa";
import {
  buildStudentKey as studentKey,
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
} from "../../../utils/bookingFormatters";

const StudentsView = ({
  filteredStudents,
  sortedBookings,
  onSelectBooking,
}) => (
  <section className="admin-card">
    <div className="admin-card-header">
      <div>
        <span className="card-kicker">Registro</span>
        <h3>Alumnos y responsables</h3>
      </div>
    </div>
    <div className="students-grid">
      {filteredStudents.length === 0 ? (
        <p className="empty-copy">
          No hay alumnos que coincidan con la búsqueda.
        </p>
      ) : (
        filteredStudents.map((student) => (
          <article key={student.key} className="student-card">
            <div className="student-card-top">
              <div>
                <strong>{student.studentName}</strong>
                <span>{student.responsibleSummary}</span>
              </div>
              <span className="student-metric">
                {student.totalBookings} turnos
              </span>
            </div>
            <div className="student-meta-list">
              <div>
                <FaIdCard />
                <span>
                  {student.responsibleRelationship || "Vínculo sin cargar"}
                </span>
              </div>
              <div>
                <FaSchool />
                <span>{student.school || "Institución sin cargar"}</span>
              </div>
              <div>
                <FaLayerGroup />
                <span>
                  {student.educationLevel || "Nivel"} ·{" "}
                  {student.yearGrade || "Año"}
                </span>
              </div>
              <div>
                <FaBookOpen />
                <span>{student.subjects.join(", ") || "Materia sin definir"}</span>
              </div>
              <div>
                <FaCalendarAlt />
                <span>
                  {student.nextBooking
                    ? `Próximo: ${formatShortDate(student.nextBooking)} ${formatTime(student.nextBooking)} hs`
                    : "Sin próximo turno"}
                </span>
              </div>
            </div>
            <div className="student-card-footer">
              <div>
                <small>Próximo paso</small>
                <strong>
                  {student.nextBooking ? "Preparar clase" : "Sin turno"}
                </strong>
              </div>
              <button
                type="button"
                className="inline-link-btn"
                onClick={() => {
                  const match = sortedBookings.find(
                    (booking) => studentKey(booking) === student.key,
                  );
                  if (match) onSelectBooking(match);
                }}
              >
                Ver ficha
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  </section>
);

export default StudentsView;
