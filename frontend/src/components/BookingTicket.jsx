import {
  FaCalendarAlt,
  FaClock,
  FaHashtag,
  FaCheckCircle,
  FaEdit,
  FaTrashAlt,
  FaUserTie,
  FaUserGraduate,
  FaEnvelope,
  FaWhatsapp,
  FaBookOpen,
  FaTimesCircle,
  FaPhoneAlt,
  FaIdCard,
} from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
  formatDurationOptionLabel,
  getBookingStatusLabel,
  getResponsibleRelationshipDisplay,
  isAdultBooking,
} from "../utils/bookingFormatters";

const BookingTicket = ({ booking, onEdit, onCancel, onDelete }) => {
  const dateStr = formatDateLong(booking.timeSlot);

  const endTimeObj = new Date(
    new Date(booking.timeSlot).getTime() + booking.duration * 60 * 60 * 1000,
  );

  const timeStart = formatTime(booking.timeSlot);
  const timeEnd = formatTime(endTimeObj);

  const displayStatus = getBookingStatusLabel(booking.status);
  const isAdultStudent = isAdultBooking(booking);
  const relationshipLabel = getResponsibleRelationshipDisplay(booking);

  return (
    <div className={`ticket-card ${displayStatus}`}>
      <div className="ticket-header">
        <span
          className="ticket-code"
          aria-label={`Código de reserva: ${booking.bookingCode}`}
        >
          <FaHashtag className="ticket-code-icon" aria-hidden="true" />
          {booking.bookingCode}
        </span>
        <div className={`status-badge ${displayStatus}`}>
          {displayStatus === "Cancelado" ? (
            <FaTimesCircle aria-hidden="true" />
          ) : (
            <FaCheckCircle aria-hidden="true" />
          )}{" "}
          {displayStatus}
        </div>
      </div>

      <div className="ticket-body">
        <div className="info-section">
          {!isAdultStudent && (
            <>
              <div className="info-block">
                <div className="label">
                  <FaUserTie aria-hidden="true" /> Adulto responsable
                </div>
                <div className="value-primary">{booking.responsibleName}</div>
              </div>

              <div className="info-block">
                <div className="label">
                  <FaIdCard aria-hidden="true" /> Parentesco
                </div>
                <div className="value-secondary">{relationshipLabel}</div>
              </div>
            </>
          )}

          <div className="info-block">
            <div className="label">
              <FaUserGraduate aria-hidden="true" /> Alumno
            </div>
            <div className="value-secondary highlight-name">
              {booking.studentName}
            </div>

            <div className="student-contact-mini">
              {booking.phone && (
                <span>
                  <FaPhoneAlt aria-hidden="true" />
                  <span className="sr-only">Teléfono: </span>
                  {booking.phone}
                </span>
              )}
              {booking.email && (
                <span>
                  <FaEnvelope aria-hidden="true" />
                  <span className="sr-only">Email: </span>
                  {booking.email}
                </span>
              )}
            </div>
          </div>

          {booking.subject && (
            <div className="info-block">
              <div className="label">
                <FaBookOpen aria-hidden="true" /> Materia / Tema
              </div>
              <div className="value-tertiary">{booking.subject}</div>
            </div>
          )}
        </div>

        <div className="info-section">
          <div className="info-block">
            <div className="label">
              <FaCalendarAlt aria-hidden="true" /> Fecha y hora
            </div>
            <div className="value-primary date-highlight">{dateStr}</div>

            <div className="value-secondary time-highlight">
              <FaClock aria-hidden="true" /> {timeStart} - {timeEnd} hs
              <span className="duration-badge">
                {formatDurationOptionLabel(booking.duration)}
              </span>
            </div>
          </div>

          <div className="info-block contact-signature">
            <div className="label">Contacto del profesor</div>
            <div className="contact-list">
              <div className="contact-item">
                <FaEnvelope aria-hidden="true" className="teacher-contact-email" />
                agustinsosa.profe@gmail.com
              </div>

              <div className="contact-item">
                <FaWhatsapp aria-hidden="true" className="teacher-contact-whatsapp" />
                11-6423-6675
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ticket-footer">
        {displayStatus === "Cancelado" && (
          <div className="cancelled-note" role="status">
            Este turno ya fue cancelado. Podés ocultarlo cuando termines de
            revisarlo.
          </div>
        )}

        {displayStatus !== "Cancelado" && (
          <>
            <button
              type="button"
              onClick={() => onEdit(booking)}
              className="btn-action btn-reschedule"
              aria-label={`Reprogramar turno de ${booking.studentName}`}
            >
              <FaEdit aria-hidden="true" /> Reprogramar
            </button>
            <button
              type="button"
              onClick={() => onCancel(booking)}
              className="btn-action btn-cancel"
              aria-label={`Cancelar turno de ${booking.studentName}`}
            >
              <FaTimesCircle aria-hidden="true" /> Cancelar turno
            </button>
          </>
        )}

        {displayStatus === "Cancelado" && (
          <button
            type="button"
            onClick={() => onDelete(booking._id)}
            className="btn-action btn-delete-forever"
            aria-label={`Ocultar turno cancelado de ${booking.studentName}`}
          >
            <FaTrashAlt aria-hidden="true" /> Eliminar historial
          </button>
        )}
      </div>
    </div>
  );
};

export default BookingTicket;
