import { useMemo, useState } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronLeft,
  FaChevronRight,
  FaChevronUp,
  FaDownload,
  FaEdit,
  FaEye,
  FaFilter,
  FaFlag,
  FaRegClock,
  FaSearch,
  FaSpinner,
  FaTimesCircle,
  FaTrashAlt,
  FaWhatsapp,
} from "react-icons/fa";
import { exportBookingsToCSV } from "../../../utils/csvExport";
import ConfirmDialog from "../../ui/ConfirmDialog";
import {
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
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

const BookingsView = ({
  searchTerm,
  filterStatus,
  filteredBookings,
  bookings,
  sentMessages,
  dataLoading,
  matchCount,
  totalCount,
  onSearchTermChange,
  onFilterStatusChange,
  onSendWhatsApp,
  onSelectBooking,
  onEditBooking,
  onDeleteBooking,
  onDeleteAll,
  onQuickStatusChange,
}) => {
  const [sortKey, setSortKey] = useState("timeSlot");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name } or "all"
  const [deleteError, setDeleteError] = useState("");

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = useMemo(() => {
    return [...filteredBookings].sort((a, b) => {
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
  }, [filteredBookings, sortKey, sortDir]);

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

  /* ── Selection ── */
  const allSelected =
    pageItems.length > 0 && pageItems.every((b) => selectedIds.has(b._id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageItems.forEach((b) => next.delete(b._id));
      else pageItems.forEach((b) => next.add(b._id));
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmedDelete = async () => {
    setDeleteError("");
    try {
      if (confirmDelete === "all") {
        await onDeleteAll();
      } else {
        await onDeleteBooking(confirmDelete.id);
      }
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err.message || "No se pudo completar la acción.");
    }
  };

  const handleBulkAction = async (newStatus) => {
    setBulkLoading(true);
    try {
      await Promise.all([...selectedIds].map((id) => onQuickStatusChange(id, newStatus)));
      setSelectedIds(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

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
          <span className="card-kicker">Gestor</span>
          <h3>Control detallado de turnos</h3>
        </div>
        <button
          type="button"
          className="admin-secondary-btn slim"
          title="Exportar turnos visibles a CSV"
          onClick={() => exportBookingsToCSV(sorted, "turnos.csv")}
          disabled={sorted.length === 0}
        >
          <FaDownload aria-hidden="true" /> CSV
        </button>
      </div>

      <div className="admin-toolbar">
        <label className="admin-search-box">
          <FaSearch aria-hidden="true" />
          <span className="sr-only">Buscar reserva</span>
          <input
            type="search"
            placeholder="Buscar alumno, código, responsable o contacto..."
            value={searchTerm}
            onChange={(e) => { setSelectedIds(new Set()); onSearchTermChange(e.target.value); }}
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
              onClick={() => { setSelectedIds(new Set()); onFilterStatusChange(s); }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {(searchTerm || filterStatus !== "Todos") && (
        <p className="admin-search-count" aria-live="polite" role="status">
          Mostrando {matchCount} de {totalCount} turnos
        </p>
      )}

      {/* Bulk action bar */}
      {someSelected && (
        <div className="bulk-action-bar" role="toolbar" aria-label="Acciones en masa">
          <span className="bulk-count">{selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}</span>
          <button
            type="button"
            className="bulk-btn confirm"
            onClick={() => handleBulkAction("Confirmado")}
            disabled={bulkLoading}
            title="Confirmar seleccionados"
          >
            <FaCheckCircle aria-hidden="true" /> Confirmar
          </button>
          <button
            type="button"
            className="bulk-btn finalize"
            onClick={() => handleBulkAction("Finalizado")}
            disabled={bulkLoading}
            title="Finalizar seleccionados"
          >
            <FaFlag aria-hidden="true" /> Finalizar
          </button>
          <button
            type="button"
            className="bulk-btn cancel"
            onClick={() => handleBulkAction("Cancelado")}
            disabled={bulkLoading}
            title="Cancelar seleccionados"
          >
            <FaTimesCircle aria-hidden="true" /> Cancelar
          </button>
          <button
            type="button"
            className="bulk-btn clear"
            onClick={() => setSelectedIds(new Set())}
          >
            Limpiar selección
          </button>
        </div>
      )}

      {dataLoading ? (
        <div className="admin-loading-state">
          <FaSpinner className="spinner giant" />
          <p>Sincronizando turnos...</p>
        </div>
      ) : (
        <>
          {/* ── Desktop table ── */}
          <div className="admin-table-shell hide-mobile">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="th-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      aria-label="Seleccionar todos en esta página"
                      title="Seleccionar todos"
                    />
                  </th>
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
                    <td colSpan="8" className="empty-table-state">
                      No se encontraron reservas con esos filtros.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((booking) => (
                    <tr
                      key={booking._id}
                      className={[
                        booking.status === "Cancelado" ? "row-cancelled" : "",
                        selectedIds.has(booking._id) ? "row-selected" : "",
                      ].filter(Boolean).join(" ")}
                    >
                      <td className="th-check">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(booking._id)}
                          onChange={() => toggleOne(booking._id)}
                          aria-label={`Seleccionar reserva de ${booking.studentName}`}
                        />
                      </td>
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
                          {booking.status === "Pendiente" && (
                            <button
                              type="button"
                              className="icon-action success"
                              title="Confirmar reserva"
                              aria-label={`Confirmar reserva de ${booking.studentName}`}
                              onClick={() => onQuickStatusChange(booking._id, "Confirmado")}
                            >
                              <FaCheckCircle aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="icon-action neutral"
                            title="Ver ficha completa"
                            aria-label={`Ver ficha de ${booking.studentName}`}
                            onClick={() => onSelectBooking(booking)}
                          >
                            <FaEye aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-action info"
                            title="Editar reserva"
                            aria-label={`Editar reserva de ${booking.studentName}`}
                            onClick={() => onEditBooking(booking)}
                          >
                            <FaEdit aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="icon-action danger"
                            title="Eliminar reserva"
                            aria-label={`Eliminar reserva de ${booking.studentName}`}
                            onClick={() => setConfirmDelete({ id: booking._id, name: booking.studentName })}
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

          {/* ── Mobile cards ── */}
          <div className="booking-cards-list show-mobile">
            {pageItems.length === 0 ? (
              <p className="empty-copy">No se encontraron reservas con esos filtros.</p>
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
                    {booking.status === "Pendiente" && (
                      <button
                        type="button"
                        className="icon-action success"
                        title="Confirmar"
                        onClick={() => onQuickStatusChange(booking._id, "Confirmado")}
                      >
                        <FaCheckCircle aria-hidden="true" />
                      </button>
                    )}
                    <button type="button" className="icon-action neutral" title="Ver" onClick={() => onSelectBooking(booking)}>
                      <FaEye aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-action info" title="Editar" onClick={() => onEditBooking(booking)}>
                      <FaEdit aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={`admin-whatsapp-btn compact ${sentMessages[booking._id] ? "sent" : ""}`}
                      onClick={() => onSendWhatsApp(booking)}
                      title="WhatsApp"
                    >
                      <FaWhatsapp aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-action danger" title="Eliminar" onClick={() => setConfirmDelete({ id: booking._id, name: booking.studentName })}>
                      <FaTrashAlt aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="pagination-bar" role="navigation" aria-label="Paginación">
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

      {bookings.length > 0 && import.meta.env.DEV && (
        <div className="admin-danger-zone">
          <div>
            <strong>Zona de resguardo</strong>
            <p>Solo para limpiar datos de prueba. Pide doble confirmación.</p>
          </div>
          <button type="button" className="admin-danger-btn" onClick={() => setConfirmDelete("all")} disabled={dataLoading}>
            <FaTrashAlt /> Limpiar base de prueba
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDelete !== null && confirmDelete !== "all"}
        title="Eliminar reserva"
        message={`¿Eliminás la reserva de ${confirmDelete?.name ?? "este alumno"}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        danger
        onConfirm={handleConfirmedDelete}
        onCancel={() => { setConfirmDelete(null); setDeleteError(""); }}
      />

      <ConfirmDialog
        isOpen={confirmDelete === "all"}
        title="Limpiar base de reservas"
        message={`Se eliminarán permanentemente todos los ${bookings.length} turnos. Usá esto solo para datos de prueba.`}
        confirmLabel="Eliminar todo"
        cancelLabel="Cancelar"
        danger
        typeToConfirm="ELIMINAR"
        onConfirm={handleConfirmedDelete}
        onCancel={() => { setConfirmDelete(null); setDeleteError(""); }}
      />

      {deleteError && (
        <p role="alert" style={{ color: "var(--color-error-deep)", padding: "0.5rem 1rem", fontSize: "0.85rem" }}>
          {deleteError}
        </p>
      )}
    </section>
  );
};

export default BookingsView;
