import {
  FaCalendarAlt,
  FaClock,
  FaHashtag,
  FaCheckCircle,
  FaEdit,
  FaTimesCircle,
  FaTrashAlt,
} from "react-icons/fa";
import {
  formatDateLong,
  formatTime,
  formatDurationOptionLabel,
  getBookingStatusLabel,
  getResponsibleRelationshipDisplay,
  isAdultBooking,
} from "../utils/bookingFormatters";

const BookingTicket = ({ booking, onEdit, onCancel, onDelete, onConfirmAttendance }) => {
  const dateStr = formatDateLong(booking.timeSlot);
  const endTimeObj = booking.endTime
    ? new Date(booking.endTime)
    : new Date(new Date(booking.timeSlot).getTime() + booking.duration * 60 * 60 * 1000);
  const timeStart = formatTime(booking.timeSlot);
  const timeEnd = formatTime(endTimeObj);
  const displayStatus = getBookingStatusLabel(booking.status);
  const isAdult = isAdultBooking(booking);
  const isReadOnly =
    displayStatus === "Finalizado" ||
    displayStatus === "Cancelado" ||
    endTimeObj <= new Date();
  const canConfirmAttendance =
    !isReadOnly &&
    booking.status === "Pendiente" &&
    typeof onConfirmAttendance === "function";
  const canReschedule = !isReadOnly && typeof onEdit === "function";
  const canCancel = !isReadOnly && typeof onCancel === "function";
  const canHide = !isReadOnly && typeof onDelete === "function";
  const hasActions =
    canConfirmAttendance || canReschedule || canCancel || canHide;

  return (
    <div className={`ticket-card ${displayStatus}`}>
      <div className="ticket-header">
        <span className="ticket-code" aria-label={`Código: ${booking.bookingCode}`}>
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
        <strong className="ticket-student">{booking.studentName}</strong>
        <span className="ticket-meta">
          {booking.subject || "Sin materia"} · {formatDurationOptionLabel(booking.duration)}
        </span>

        {!isAdult && booking.responsibleName && (
          <span className="ticket-responsible">
            {getResponsibleRelationshipDisplay(booking)}: {booking.responsibleName}
          </span>
        )}

        <div className="ticket-datetime">
          <span>
            <FaCalendarAlt aria-hidden="true" /> {dateStr}
          </span>
          <span>
            <FaClock aria-hidden="true" /> {timeStart} – {timeEnd} h
          </span>
        </div>
      </div>

      {hasActions && (
        <div className="ticket-footer">
          {canConfirmAttendance && (
            <button
              type="button"
              onClick={() => onConfirmAttendance(booking)}
              className="btn-action btn-confirm-attendance"
              aria-label={`Confirmar asistencia al turno de ${booking.studentName}`}
            >
              <FaCheckCircle aria-hidden="true" /> Confirmar asistencia
            </button>
          )}
          {canReschedule && (
            <button
              type="button"
              onClick={() => onEdit(booking)}
              className="btn-action btn-reschedule"
              aria-label={`Reprogramar turno de ${booking.studentName}`}
            >
              <FaEdit aria-hidden="true" /> Reprogramar
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(booking)}
              className="btn-action btn-cancel"
              aria-label={`Cancelar turno de ${booking.studentName}`}
            >
              <FaTimesCircle aria-hidden="true" /> Cancelar
            </button>
          )}
          {canHide && (
            <button
              type="button"
              onClick={() => onDelete(booking.bookingCode)}
              className="btn-action btn-delete-forever"
              aria-label={`Ocultar turno de ${booking.studentName}`}
            >
              <FaTrashAlt aria-hidden="true" /> Ocultar
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingTicket;
