import { useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaEye,
  FaFilter,
  FaRegClock,
  FaSearch,
  FaSpinner,
  FaWhatsapp,
} from "react-icons/fa";
import {
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
  normalizeText as norm,
  getResponsibleRelationshipDisplay as responsibleRelationshipLabel,
  toSafeDate as toDate,
} from "../../../utils/bookingFormatters";
import { usePagination } from "../../../hooks/usePagination";

const STATUS_FILTERS = ["Todos", "Pendiente", "Confirmado", "Finalizado", "Cancelado"];
const PAGE_SIZE = 20;

const SortIcon = ({ active, dir }) => {
  if (!active) return <FaChevronDown className="sort-icon inactive" aria-hidden="true" />;
  return dir === "asc"
    ? <FaChevronUp className="sort-icon active" aria-hidden="true" />
    : <FaChevronDown className="sort-icon active" aria-hidden="true" />;
};

const HistoryView = ({
  historyBookings,
  sentMessages,
  dataLoading,
  onSendWhatsApp,
  onSelectBooking,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [sortKey, setSortKey] = useState("timeSlot");
  const [sortDir, setSortDir] = useState("desc");

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = useMemo(() => {
    const term = norm(searchTerm);
    return historyBookings.filter((booking) => {
      const blob = norm(
        [
          booking.studentName,
          booking.responsibleName,
          booking.bookingCode,
          booking.phone,
          booking.email,
          booking.subject,
        ].join(" "),
      );
      const matchesSearch = !term || blob.includes(term);
      const matchesStatus =
        filterStatus === "Todos" || booking.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [historyBookings, searchTerm, filterStatus]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA, valB;
      switch (sortKey) {
        case "timeSlot":
          valA = toDate(a.timeSlot)?.getTime() ?? 0;
          valB = toDate(b.timeSlot)?.getTime() ?? 0;
          break;
        case "studentName":
          valA = (a.studentName || "").toLowerCase();
          valB = (b.studentName || "").toLowerCase();
          break;
        case "status":
          valA = a.status || "";
          valB = b.status || "";
          break;
        case "subject":
          valA = (a.subject || "").toLowerCase();
          valB = (b.subject || "").toLowerCase();
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const {
    currentPage,
    totalPages,
    pageItems,
    startIndex,
    endIndex,
    goToNext,
    goToPrev,
    goToPage,
    hasNext,
    hasPrev,
  } = usePagination(sorted, PAGE_SIZE);

  const thProps = (key, label) => ({
    className: `sortable-th ${sortKey === key ? "is-sorted" : ""}`,
    onClick: () => toggleSort(key),
    "aria-sort": sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none",
    title: `Ordenar por ${label}`,
  });

  return (
    <section className="admin-card">
      <div className="admin-card-header spread">
        <div>
          <span className="card-kicker">Archivo</span>
          <h3>Historial de turnos</h3>
          <p className="card-subtitle">Clases pasadas, finalizadas y canceladas</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search-box">
          <FaSearch aria-hidden="true" />
          <span className="sr-only">Buscar en historial</span>
          <input
            type="search"
            placeholder="Buscar alumno, código, responsable o contacto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="status-filter-row" role="group" aria-label="Filtrar por estado">
          <span aria-hidden="true"><FaFilter /> Filtrar</span>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`status-filter-chip ${filterStatus === s ? "is-active" : ""}`}
              aria-pressed={filterStatus === s}
              onClick={() => setFilterStatus(s)}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {(searchTerm || filterStatus !== "Todos") && (
        <p className="admin-search-count" aria-live="polite" role="status">
          Mostrando {filtered.length} de {historyBookings.length} registros
        </p>
      )}

      {dataLoading ? (
        <div className="admin-loading-state">
          <FaSpinner className="spinner giant" />
          <p>Cargando historial...</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="admin-table-shell hide-mobile">
            <table className="admin-table">
              <thead>
                <tr>
                  <th {...thProps("status", "estado")}>
                    Estado <SortIcon active={sortKey === "status"} dir={sortDir} />
                  </th>
                  <th>Código</th>
                  <th {...thProps("studentName", "alumno")}>
                    Alumno <SortIcon active={sortKey === "studentName"} dir={sortDir} />
                  </th>
                  <th {...thProps("timeSlot", "fecha")}>
                    Horario <SortIcon active={sortKey === "timeSlot"} dir={sortDir} />
                  </th>
                  <th {...thProps("subject", "materia")}>
                    Materia <SortIcon active={sortKey === "subject"} dir={sortDir} />
                  </th>
                  <th>Contacto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-table-state">
                      No se encontraron registros con esos filtros.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((booking) => (
                    <tr
                      key={booking._id}
                      className={booking.status === "Cancelado" ? "row-cancelled" : ""}
                    >
                      <td>
                        <span className={`status-pill ${booking.status}`}>
                          {booking.status}
                        </span>
                      </td>
                      <td>
                        <span className="code-mono">{booking.bookingCode}</span>
                      </td>
                      <td>
                        <div className="table-student">
                          <strong>{booking.studentName}</strong>
                          <span>{responsibleRelationshipLabel(booking)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="table-date">
                          <span>
                            <FaCalendarAlt aria-hidden="true" />
                            {booking.timeSlot ? formatShortDate(toDate(booking.timeSlot)) : "--"}
                          </span>
                          <span>
                            <FaRegClock aria-hidden="true" />
                            {booking.timeSlot ? `${formatTime(toDate(booking.timeSlot))} h` : "--"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="table-subject">{booking.subject || "--"}</span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => onSendWhatsApp(booking)}
                          className={`admin-whatsapp-btn ${sentMessages[booking._id] ? "sent" : ""}`}
                          title="Enviar mensaje por WhatsApp"
                        >
                          <FaWhatsapp aria-hidden="true" />
                          {sentMessages[booking._id] ? "Enviado" : "WA"}
                        </button>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-action neutral"
                            title="Ver ficha completa"
                            aria-label={`Ver ficha de ${booking.studentName}`}
                            onClick={() => onSelectBooking(booking)}
                          >
                            <FaEye aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="booking-cards-list show-mobile">
            {pageItems.length === 0 ? (
              <p className="empty-copy">No se encontraron registros con esos filtros.</p>
            ) : (
              pageItems.map((booking) => (
                <div
                  key={booking._id}
                  className={`booking-card ${booking.status === "Cancelado" ? "row-cancelled" : ""}`}
                >
                  <div className="booking-card-head">
                    <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                    <span className="code-mono">{booking.bookingCode}</span>
                  </div>
                  <div className="booking-card-body">
                    <strong>{booking.studentName}</strong>
                    <span>{booking.subject || "Sin materia"}</span>
                    <div className="booking-card-time">
                      <FaCalendarAlt aria-hidden="true" />
                      {booking.timeSlot
                        ? `${formatShortDate(toDate(booking.timeSlot))} · ${formatTime(toDate(booking.timeSlot))} h`
                        : "--"}
                    </div>
                  </div>
                  <div className="booking-card-actions">
                    <button
                      type="button"
                      className="icon-action neutral"
                      title="Ver"
                      onClick={() => onSelectBooking(booking)}
                    >
                      <FaEye aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`admin-whatsapp-btn compact ${sentMessages[booking._id] ? "sent" : ""}`}
                      onClick={() => onSendWhatsApp(booking)}
                      title="WhatsApp"
                    >
                      <FaWhatsapp aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination-bar" role="navigation" aria-label="Paginación del historial">
              <button
                type="button"
                className="page-btn"
                onClick={goToPrev}
                disabled={!hasPrev}
                title="Página anterior"
              >
                <FaChevronLeft aria-hidden="true" />
              </button>

              <span className="page-info" aria-live="polite">
                {startIndex}–{endIndex} de {sorted.length}
              </span>

              <div className="page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - currentPage) <= 2 || p === 1 || p === totalPages)
                  .reduce((acc, p, i, arr) => {
                    if (i > 0 && p - arr[i - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="page-ellipsis">…</span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`page-num ${p === currentPage ? "is-active" : ""}`}
                        onClick={() => goToPage(p)}
                        aria-current={p === currentPage ? "page" : undefined}
                      >
                        {p}
                      </button>
                    ),
                  )}
              </div>

              <button
                type="button"
                className="page-btn"
                onClick={goToNext}
                disabled={!hasNext}
                title="Página siguiente"
              >
                <FaChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default HistoryView;
