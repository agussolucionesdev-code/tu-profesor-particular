import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaDollarSign,
  FaFlag,
  FaRegClock,
  FaTrashAlt,
  FaWhatsapp,
} from "react-icons/fa";
import {
  formatLongDateLabel as formatDate,
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
} from "../../../utils/bookingFormatters";

/* ─── countdown helper ─── */
const formatCountdown = (ms) => {
  if (ms <= 0) return "ahora mismo";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `en ${h}h ${m}min`;
  if (h > 0) return `en ${h}h`;
  return `en ${m}min`;
};

/* ─── Next class widget with live countdown ─── */
const NextClassWidget = ({ next, onSendWhatsApp, onQuickStatusChange }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!next) {
    return (
      <p className="empty-copy">No hay clases programadas próximamente.</p>
    );
  }

  const isInProgress =
    next.start && next.end && now >= next.start && now < next.end;
  const msUntil = next.start ? next.start.getTime() - now.getTime() : null;
  const countdown =
    msUntil !== null && !isInProgress ? formatCountdown(msUntil) : null;

  return (
    <>
      <div className="next-class-info">
        {isInProgress && (
          <div className="next-class-live-badge" aria-live="polite">
            <span className="live-dot" aria-hidden="true" />
            En clase
          </div>
        )}
        <strong className="next-class-student">{next.studentName}</strong>
        <span className="next-class-subject">{next.subject}</span>
        <div className="next-class-time">
          <FaRegClock aria-hidden="true" />
          {next.start
            ? `${formatDate(next.start)} · ${formatTime(next.start)} hs`
            : "--"}
        </div>
        {countdown && (
          <div className="next-class-countdown">{countdown}</div>
        )}
      </div>

      <div className="next-class-actions">
        <button
          type="button"
          className="admin-primary-btn slim"
          title="Contactar por WhatsApp"
          onClick={() => onSendWhatsApp(next)}
        >
          <FaWhatsapp aria-hidden="true" /> WhatsApp
        </button>
        {next.status === "Pendiente" && (
          <button
            type="button"
            className="admin-secondary-btn slim"
            title="Confirmar clase"
            onClick={() => onQuickStatusChange(next._id, "Confirmado")}
          >
            <FaCheckCircle aria-hidden="true" /> Confirmar
          </button>
        )}
        {(next.status === "Confirmado" || isInProgress) && (
          <button
            type="button"
            className="admin-secondary-btn slim"
            title="Marcar como finalizada"
            onClick={() => onQuickStatusChange(next._id, "Finalizado")}
          >
            <FaFlag aria-hidden="true" /> Finalizar
          </button>
        )}
      </div>
    </>
  );
};

/* ─── Main view ─── */
const OverviewView = ({
  overviewData,
  dashboard,
  onSelectBooking,
  onSendWhatsApp,
  onQuickStatusChange,
}) => {
  const { monthRevenue, lastMonthRevenue } = overviewData;
  const maxWeekFlow = Math.max(
    ...overviewData.weekFlow.map((day) => day.count),
    1,
  );
  const topSubjectMax = overviewData.topSubjects[0]?.count || 1;

  return (
    <>
      <section className="admin-content-grid two-columns">
        <article className="admin-card next-class-widget">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Próxima clase</span>
              <h3>Quién sigue</h3>
            </div>
          </div>
          <div className="next-class-details">
            <NextClassWidget
              next={overviewData.upcomingBookings[0]}
              onSendWhatsApp={onSendWhatsApp}
              onQuickStatusChange={onQuickStatusChange}
            />
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Pulso semanal</span>
              <h3>Próximos 7 días</h3>
            </div>
          </div>
          <div
            className="admin-bars-chart"
            role="img"
            aria-label={`Pulso semanal: ${overviewData.weekFlow.map((d) => `${d.label} ${d.count} clase${d.count !== 1 ? "s" : ""}`).join(", ")}`}
          >
            {overviewData.weekFlow.map((item) => (
              <div
                key={item.label}
                className={[
                  "admin-bar-column",
                  item.isToday ? "is-today" : "",
                  item.isPast ? "is-past" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-hidden="true"
                title={`${item.fullLabel}: ${item.count} clase${item.count !== 1 ? "s" : ""}`}
              >
                <span className="admin-bar-value">{item.count}</span>
                <div className="admin-bar-track">
                  <div
                    className="admin-bar-fill"
                    style={{
                      height: `${Math.max(
                        (item.count / maxWeekFlow) * 100,
                        item.count ? 14 : 4,
                      )}%`,
                    }}
                  />
                </div>
                <span className="admin-bar-label">{item.label}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-content-grid two-columns">
        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Demanda</span>
              <h3>Materias más solicitadas</h3>
            </div>
          </div>
          <div className="admin-progress-list">
            {overviewData.topSubjects.length === 0 ? (
              <p className="empty-copy">Todavía no hay materias registradas.</p>
            ) : (
              overviewData.topSubjects.map((subject) => (
                <div key={subject.label} className="progress-row">
                  <div className="progress-copy">
                    <strong>{subject.label}</strong>
                    <span>{subject.count} reservas</span>
                  </div>
                  <div className="progress-track" aria-hidden="true">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${(subject.count / topSubjectMax) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Atención inmediata</span>
              <h3>Pendientes vencidos</h3>
            </div>
          </div>
          <div className="timeline-list">
            {overviewData.overduePending.length === 0 ? (
              <p className="empty-copy">No hay registros pendientes vencidos.</p>
            ) : (
              overviewData.overduePending.map((booking) => (
                <div key={booking._id} className="timeline-item urgent">
                  <div className="timeline-copy">
                    <strong>{booking.studentName}</strong>
                    <span>
                      {booking.start
                        ? `${formatShortDate(booking.start)} · ${formatTime(booking.start)} hs`
                        : "--"}
                    </span>
                    <small>{booking.subject}</small>
                  </div>
                  <div className="timeline-actions">
                    <button
                      type="button"
                      className="inline-action success"
                      title="Confirmar reserva"
                      aria-label={`Confirmar reserva de ${booking.studentName}`}
                      onClick={() =>
                        onQuickStatusChange(booking._id, "Confirmado")
                      }
                    >
                      <FaCheckCircle aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="inline-action danger"
                      title="Cancelar reserva"
                      aria-label={`Cancelar reserva de ${booking.studentName}`}
                      onClick={() =>
                        onQuickStatusChange(booking._id, "Cancelado")
                      }
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

      <section className="admin-content-grid three-columns">
        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Hoy</span>
              <h3>Tu agenda del día</h3>
            </div>
          </div>
          <div className="admin-agenda-list">
            {overviewData.todayBookings.length === 0 ? (
              <p className="empty-copy">Hoy no hay clases activas.</p>
            ) : (
              overviewData.todayBookings.map((booking) => (
                <button
                  key={booking._id}
                  type="button"
                  className="agenda-item"
                  onClick={() => onSelectBooking(booking)}
                >
                  <div>
                    <strong>{booking.studentName}</strong>
                    <span>{booking.subject}</span>
                  </div>
                  <div className="agenda-time">
                    <span>
                      {booking.start ? formatTime(booking.start) : "--:--"}
                    </span>
                    <small>{booking.duration || 1} h</small>
                  </div>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Próximas 24 horas</span>
              <h3>Lo que viene</h3>
            </div>
          </div>
          <div className="timeline-list">
            {overviewData.upcoming24h.length === 0 ? (
              <p className="empty-copy">Sin movimientos en las próximas 24 hs.</p>
            ) : (
              overviewData.upcoming24h.map((booking) => (
                <div key={booking._id} className="timeline-item">
                  <div className="timeline-copy">
                    <strong>{booking.studentName}</strong>
                    <span>
                      {booking.start
                        ? `${formatDate(booking.start)} · ${formatTime(booking.start)} hs`
                        : "--"}
                    </span>
                    <small>{booking.subject}</small>
                  </div>
                  <button
                    type="button"
                    className="inline-action"
                    title="Contactar por WhatsApp"
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
              <span className="card-kicker">Actividad reciente</span>
              <h3>Últimos movimientos</h3>
            </div>
          </div>
          <div className="admin-activity-list">
            {overviewData.recentActivity.length === 0 ? (
              <p className="empty-copy">Todavía no hay actividad.</p>
            ) : (
              overviewData.recentActivity.map((booking) => (
                <button
                  key={booking._id}
                  type="button"
                  className="activity-item"
                  onClick={() => onSelectBooking(booking)}
                >
                  <div className="activity-copy">
                    <strong>{booking.studentName}</strong>
                    <span>
                      {booking.subject} ·{" "}
                      <span className={`inline-status ${booking.status}`}>
                        {booking.status}
                      </span>
                    </span>
                  </div>
                  <small>
                    {booking.start
                      ? `${formatShortDate(booking.start)} ${formatTime(booking.start)}`
                      : "--"}
                  </small>
                </button>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="admin-content-grid">
        <article className="admin-card">
          <div className="admin-card-header">
            <div>
              <span className="card-kicker">Resumen rápido</span>
              <h3>Cómo está el panel</h3>
            </div>
          </div>
          <div className="admin-priority-stack">
            <div className="priority-card warning">
              <strong>Reservas confirmadas</strong>
              <span>{dashboard.stats.confirmed}</span>
              <p>Volumen real de la agenda activa.</p>
            </div>
            <div className="priority-card info">
              <strong>Clases para hoy</strong>
              <span>{overviewData.todayBookings.length}</span>
              <p>Resumen del día para abrir el panel y saber dónde estás parado.</p>
            </div>
            <div className="priority-card success">
              <strong>Alumnos con seguimiento</strong>
              <span>{overviewData.students.length}</span>
              <p>Perfiles, materias y próximos encuentros con contexto.</p>
            </div>
            <div className="priority-card success">
              <div className="priority-card-title">
                <FaDollarSign aria-hidden="true" />
                <strong>Ingresos del mes</strong>
              </div>
              <span className="priority-card-value">
                ${monthRevenue.toLocaleString("es-AR")}
              </span>
              <p>
                {lastMonthRevenue > 0
                  ? `${monthRevenue >= lastMonthRevenue ? "+" : ""}${Math.round(((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)}% vs mes anterior`
                  : "Suma de clases finalizadas con precio cargado."}
              </p>
            </div>
          </div>
        </article>
      </section>
    </>
  );
};

export default OverviewView;
