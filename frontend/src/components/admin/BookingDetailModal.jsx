import { useEffect } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import {
  FaCalendarAlt,
  FaChartLine,
  FaInfoCircle,
  FaLightbulb,
  FaLock,
  FaSchool,
  FaUserTie,
  FaWhatsapp,
} from "react-icons/fa";
import {
  formatLongDateLabel as formatDate,
  formatTimeLabel as formatTime,
  getBookingStatusLabel as bookingStatusLabel,
  getResponsibleDisplay as responsibleLabel,
  getResponsibleRelationshipDisplay as responsibleRelationshipLabel,
  toSafeDate as toDate,
} from "../../utils/bookingFormatters";

const BookingDetailModal = ({ booking, onClose, onContactWhatsApp }) => {
  const dialogRef = useFocusTrap(true);

  useEffect(() => {
    const trigger = document.activeElement;
    return () => { trigger?.focus?.(); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-modal-card large"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
        tabIndex={-1}
      >
        <div className="admin-modal-header highlight">
          <div className="modal-student-title">
            <div className="modal-icon-shell">
              <FaUserTie />
            </div>
            <div>
              <span className="card-kicker">Ficha completa</span>
              <h3 id="detail-modal-title">{booking.studentName}</h3>
            </div>
          </div>
          <span className={`status-pill ${bookingStatusLabel(booking.status)}`}>
            {bookingStatusLabel(booking.status)}
          </span>
        </div>

        <div className="admin-modal-body">
          <div className="admin-detail-grid">
            <article className="detail-card">
              <h4>
                <FaInfoCircle />
                Contacto
              </h4>
              <p>
                <strong>Responsable</strong>
                <span>{responsibleLabel(booking)}</span>
              </p>
              <p>
                <strong>Parentesco</strong>
                <span>{responsibleRelationshipLabel(booking)}</span>
              </p>
              <p>
                <strong>Teléfono</strong>
                <span>{booking.phone || "No informado"}</span>
              </p>
              <p>
                <strong>Email</strong>
                <span>{booking.email || "No informado"}</span>
              </p>
            </article>

            <article className="detail-card">
              <h4>
                <FaSchool />
                Perfil académico
              </h4>
              <p>
                <strong>Institución</strong>
                <span>{booking.school || "No especificada"}</span>
              </p>
              <p>
                <strong>Nivel</strong>
                <span>{booking.educationLevel || "Sin dato"}</span>
              </p>
              <p>
                <strong>Año / grado</strong>
                <span>{booking.yearGrade || "Sin dato"}</span>
              </p>
              <p>
                <strong>Materia</strong>
                <span>{booking.subject || "Sin materia"}</span>
              </p>
            </article>
          </div>

          <article className="detail-card full">
            <h4>
              <FaCalendarAlt />
              Turno agendado
            </h4>
            <p>
              <strong>Fecha</strong>
              <span>
                {booking.timeSlot
                  ? formatDate(toDate(booking.timeSlot))
                  : "No disponible"}
              </span>
            </p>
            <p>
              <strong>Horario</strong>
              <span>
                {booking.timeSlot
                  ? `${formatTime(toDate(booking.timeSlot))} h`
                  : "--"}
              </span>
            </p>
            <p>
              <strong>Duración</strong>
              <span>{booking.duration || 1} hora(s)</span>
            </p>
          </article>

          <article className="detail-card full note">
            <h4>
              <FaLightbulb />
              Contexto del alumno
            </h4>
            <p className="stacked">
              {booking.academicSituation ||
                "No dejó comentarios adicionales en el momento de reservar."}
            </p>
          </article>

          <article className="detail-card full">
            <h4>
              <FaChartLine /> Evolución Pedagógica
            </h4>
            <p className="stacked">
              {booking.studentEvolution || "Sin registros de evolución aún."}
            </p>
          </article>

          <article className="detail-card full">
            <h4>
              <FaUserTie /> Estado Emocional y Actitudinal
            </h4>
            <p className="stacked">
              {booking.emotionalState ||
                "Sin registros sobre el estado emocional."}
            </p>
          </article>

          {booking.notes && (
            <article className="detail-card full private">
              <h4>
                <FaLock />
                Notas privadas
              </h4>
              <p className="stacked">{booking.notes}</p>
            </article>
          )}
        </div>

        <div className="admin-modal-footer">
          <button
            type="button"
            className="admin-secondary-btn"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            type="button"
            className="admin-primary-btn slim"
            onClick={() => onContactWhatsApp(booking)}
          >
            <FaWhatsapp />
            Contactar
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailModal;
