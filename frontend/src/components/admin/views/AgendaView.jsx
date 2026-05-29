import {
  FaCalendarPlus,
  FaCheckCircle,
  FaTrashAlt,
  FaWhatsapp,
} from "react-icons/fa";
import {
  formatLongDateLabel as formatDate,
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
} from "../../../utils/bookingFormatters";
import { downloadIcs } from "../../../utils/icsExport";

const AgendaView = ({
  overviewData,
  onSendWhatsApp,
  onQuickStatusChange,
}) => (
  <section className="admin-content-grid two-columns">
    <article className="admin-card">
      <div className="admin-card-header spread">
        <div>
          <span className="card-kicker">Próximas 24 horas</span>
          <h3>Seguimiento inmediato</h3>
        </div>
        {overviewData.upcoming24h.length > 0 && (
          <button
            type="button"
            className="admin-secondary-btn slim"
            onClick={() => downloadIcs(overviewData.upcoming24h, "agenda-24h.ics")}
            title="Exportar agenda de las próximas 24 h a iCal"
          >
            <FaCalendarPlus aria-hidden="true" /> .ics
          </button>
        )}
      </div>
      <div className="timeline-list">
        {overviewData.upcoming24h.length === 0 ? (
          <p className="empty-copy">
            No hay clases ni recordatorios en las próximas 24 horas.
          </p>
        ) : (
          overviewData.upcoming24h.map((booking) => (
            <div key={booking._id} className="timeline-item">
              <div className="timeline-copy">
                <strong>{booking.studentName}</strong>
                <span>
                  {booking.start
                    ? `${formatDate(booking.start)} · ${formatTime(booking.start)} h`
                    : "--"}
                </span>
                <small>{booking.subject}</small>
              </div>
              <button
                type="button"
                className="inline-action"
                aria-label={`Contactar a ${booking.studentName} por WhatsApp`}
                onClick={() => onSendWhatsApp(booking)}
              >
                <FaWhatsapp aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </article>

    <article className="admin-card">
      <div className="admin-card-header">
        <div>
          <span className="card-kicker">Estados heredados</span>
          <h3>Registros para normalizar</h3>
        </div>
      </div>
      <div className="timeline-list">
        {overviewData.overduePending.length === 0 ? (
          <p className="empty-copy">No hay registros pendientes heredados.</p>
        ) : (
          overviewData.overduePending.map((booking) => (
            <div key={booking._id} className="timeline-item urgent">
              <div className="timeline-copy">
                <strong>{booking.studentName}</strong>
                <span>
                  {booking.start
                    ? `${formatShortDate(booking.start)} · ${formatTime(booking.start)} h`
                    : "--"}
                </span>
                <small>{booking.subject}</small>
              </div>
              <div className="timeline-actions">
                <button
                  type="button"
                  className="inline-action success"
                  aria-label={`Confirmar reserva de ${booking.studentName}`}
                  onClick={() => onQuickStatusChange(booking._id, "Confirmado")}
                >
                  <FaCheckCircle aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="inline-action danger"
                  aria-label={`Cancelar reserva de ${booking.studentName}`}
                  onClick={() => onQuickStatusChange(booking._id, "Cancelado")}
                >
                  <FaTrashAlt aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </article>
  </section>
);

export default AgendaView;
