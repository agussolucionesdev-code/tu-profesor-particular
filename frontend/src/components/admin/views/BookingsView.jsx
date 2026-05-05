import {
  FaCalendarAlt,
  FaCheckCircle,
  FaEdit,
  FaEye,
  FaFilter,
  FaRegClock,
  FaSearch,
  FaSpinner,
  FaTrashAlt,
  FaWhatsapp,
} from "react-icons/fa";
import {
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
  getBookingStatusLabel as bookingStatusLabel,
  getResponsibleRelationshipDisplay as responsibleRelationshipLabel,
  toSafeDate as toDate,
} from "../../../utils/bookingFormatters";

const STATUS_FILTERS = ["Todos", "Confirmado", "Cancelado"];

const BookingsView = ({
  searchTerm,
  filterStatus,
  filteredBookings,
  bookings,
  sentMessages,
  dataLoading,
  onSearchTermChange,
  onFilterStatusChange,
  onSendWhatsApp,
  onSelectBooking,
  onEditBooking,
  onDeleteBooking,
  onDeleteAll,
  onQuickStatusChange,
}) => (
  <section className="admin-card">
    <div className="admin-card-header spread">
      <div>
        <span className="card-kicker">Gestor</span>
        <h3>Control detallado de turnos</h3>
      </div>
    </div>

    <div className="admin-toolbar">
      <label className="admin-search-box">
        <FaSearch aria-hidden="true" />
        <span className="sr-only">Buscar reserva</span>
        <input
          type="search"
          placeholder="Buscar alumno, código, responsable o contacto..."
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          autoComplete="off"
        />
      </label>
      <div className="status-filter-row" role="group" aria-label="Filtrar por estado">
        <span aria-hidden="true">
          <FaFilter /> Filtrar
        </span>
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            className={`status-filter-chip ${filterStatus === status ? "is-active" : ""}`}
            aria-pressed={filterStatus === status}
            onClick={() => onFilterStatusChange(status)}
          >
            {status}
          </button>
        ))}
      </div>
    </div>

    {dataLoading ? (
      <div className="admin-loading-state">
        <FaSpinner className="spinner giant" />
        <p>Sincronizando turnos...</p>
      </div>
    ) : (
      <div className="admin-table-shell">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Estado</th>
              <th>Código</th>
              <th>Alumno</th>
              <th>Horario</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table-state">
                  No se encontraron reservas con esos filtros.
                </td>
              </tr>
            ) : (
              filteredBookings.map((booking) => (
                <tr
                  key={booking._id}
                  className={booking.status === "Cancelado" ? "row-cancelled" : ""}
                >
                  <td>
                    <span className={`status-pill ${bookingStatusLabel(booking.status)}`}>
                      {bookingStatusLabel(booking.status)}
                    </span>
                  </td>
                  <td>
                    <span className="code-mono">{booking.bookingCode}</span>
                  </td>
                  <td>
                    <div className="table-student">
                      <strong>{booking.studentName}</strong>
                      <span>
                        {responsibleRelationshipLabel(booking)} ·{" "}
                        {booking.subject}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-date">
                      <span>
                        <FaCalendarAlt />
                        {booking.timeSlot
                          ? formatShortDate(toDate(booking.timeSlot))
                          : "--"}
                      </span>
                      <span>
                        <FaRegClock />
                        {booking.timeSlot
                          ? `${formatTime(toDate(booking.timeSlot))} hs`
                          : "--"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => onSendWhatsApp(booking)}
                      className={`admin-whatsapp-btn ${sentMessages[booking._id] ? "sent" : ""}`}
                    >
                      <FaWhatsapp aria-hidden="true" />
                      {sentMessages[booking._id] ? "Enviado" : "WhatsApp"}
                    </button>
                  </td>
                  <td>
                    <div className="table-actions">
                      {booking.status === "Pendiente" && (
                        <button
                          type="button"
                          className="icon-action success"
                          aria-label={`Confirmar reserva de ${booking.studentName}`}
                          onClick={() =>
                            onQuickStatusChange(booking._id, "Confirmado")
                          }
                        >
                          <FaCheckCircle aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-action neutral"
                        aria-label={`Ver ficha de ${booking.studentName}`}
                        onClick={() => onSelectBooking(booking)}
                      >
                        <FaEye aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-action info"
                        aria-label={`Editar reserva de ${booking.studentName}`}
                        onClick={() => onEditBooking(booking)}
                      >
                        <FaEdit aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="icon-action danger"
                        aria-label={`Eliminar reserva de ${booking.studentName}`}
                        onClick={() => onDeleteBooking(booking._id)}
                      >
                        <FaTrashAlt aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    )}
    {bookings.length > 0 && import.meta.env.DEV && (
      <div className="admin-danger-zone">
        <div>
          <strong>Zona de resguardo</strong>
          <p>
            Solo para limpiar datos de prueba. Pide doble confirmación antes de
            ejecutarse.
          </p>
        </div>
        <button
          type="button"
          className="admin-danger-btn"
          onClick={onDeleteAll}
          disabled={dataLoading}
        >
          <FaTrashAlt />
          Limpiar base de prueba
        </button>
      </div>
    )}
  </section>
);

export default BookingsView;
