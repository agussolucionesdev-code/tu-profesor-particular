import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaBell,
  FaChevronLeft,
  FaChevronRight,
  FaRedoAlt,
  FaSyncAlt,
} from "react-icons/fa";
import {
  fetchAdminNotifications,
  retryAdminNotification,
} from "../../../api/bookingApi";
import {
  NOTIFICATION_STATUSES,
  NOTIFICATION_ERROR_CATEGORY_LABELS,
  NOTIFICATION_STATUS_LABELS,
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NotificationValidationError,
  canRetryNotification,
  formatNotificationDate,
  parseNotificationResponse,
  parseNotificationsListResponse,
  replaceNotification,
} from "../../../utils/notificationCenter";
import "./NotificationsView.css";

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 30_000;

const statusOptions = NOTIFICATION_STATUSES.map((value) => ({
  value,
  label: NOTIFICATION_STATUS_LABELS[value],
}));

const typeOptions = NOTIFICATION_TYPES.map((value) => ({
  value,
  label: NOTIFICATION_TYPE_LABELS[value],
}));

const NotificationsView = ({ authConfig }) => {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowFeedback, setRowFeedback] = useState({});
  const [retryingIds, setRetryingIds] = useState(() => new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const requestSequenceRef = useRef(0);
  const abortRef = useRef(null);

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (!silent) setLoading(true);
    setError("");
    try {
      const response = await fetchAdminNotifications({
        page,
        limit: PAGE_SIZE,
        status,
        type,
      }, authConfig, controller.signal);
      const parsed = parseNotificationsListResponse(response.data);
      if (sequence !== requestSequenceRef.current) return;
      if (parsed.pagination.page !== page) {
        setPage(parsed.pagination.page);
        return;
      }
      setItems(parsed.items);
      setPagination(parsed.pagination);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
      if (requestError instanceof NotificationValidationError) {
        setItems([]);
        setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
        setError("El servidor devolvió una respuesta inválida. No mostramos datos incompletos.");
      } else if (requestError?.response?.status === 401) {
        setItems([]);
        setPagination({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 });
        setError("Tu sesión venció. Volvé a iniciar sesión.");
      } else {
        setError("No pudimos cargar las notificaciones. Intentá nuevamente.");
      }
    } finally {
      if (sequence === requestSequenceRef.current) setLoading(false);
    }
  }, [authConfig, page, status, type]);

  useEffect(() => {
    setRowFeedback({});
    loadNotifications();
    return () => {
      requestSequenceRef.current += 1;
      abortRef.current?.abort();
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const intervalId = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [autoRefresh, loadNotifications]);

  const handleRetry = async (item) => {
    setRetryingIds((current) => new Set(current).add(item.id));
    setRowFeedback((current) => ({
      ...current,
      [item.id]: { type: "", message: "" },
    }));
    try {
      const response = await retryAdminNotification(item.id, authConfig);
      const canonical = parseNotificationResponse(response.data);
      if (canonical.id !== item.id) throw new NotificationValidationError();
      setItems((current) => replaceNotification(current, canonical));
      setRowFeedback((current) => ({
        ...current,
        [item.id]: { type: "success", message: "Reintento solicitado." },
      }));
    } catch (retryError) {
      const isConflict =
        retryError?.response?.status === 409 &&
        retryError?.response?.data?.code === "NOTIFICATION_NOT_RETRYABLE";
      const message = isConflict
        ? "La notificación ya no admite reintento. Actualizamos su estado."
        : retryError instanceof NotificationValidationError
          ? "El servidor devolvió una respuesta inválida. Actualizá la lista antes de reintentar."
          : "No se pudo reintentar. Intentá nuevamente.";
      setRowFeedback((current) => ({
        ...current,
        [item.id]: { type: "error", message },
      }));
      if (isConflict) await loadNotifications({ silent: true });
    } finally {
      setRetryingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }
  };

  return (
    <section className="admin-card notifications-view" aria-busy={loading}>
      <header className="notifications-header">
        <div>
          <span className="card-kicker">Trazabilidad real</span>
          <h2><FaBell aria-hidden="true" /> Centro de notificaciones</h2>
          <p>
            Estado operativo de confirmaciones, cambios, cancelaciones y recordatorios por email.
          </p>
        </div>
        <button
          type="button"
          className="admin-primary-btn slim"
          onClick={() => loadNotifications()}
          disabled={loading}
          aria-label="Actualizar notificaciones"
        >
          <FaSyncAlt aria-hidden="true" /> {loading ? "Actualizando…" : "Actualizar"}
        </button>
      </header>

      <div className="notifications-controls">
        <label htmlFor="notification-status-filter">
          Estado
          <select
            id="notification-status-filter"
            className="settings-input"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label htmlFor="notification-type-filter">
          Tipo
          <select
            id="notification-type-filter"
            className="settings-input"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="notifications-auto-refresh" htmlFor="notifications-auto-refresh">
          <input
            id="notifications-auto-refresh"
            type="checkbox"
            checked={autoRefresh}
            onChange={(event) => setAutoRefresh(event.target.checked)}
          />
          Actualización automática
        </label>
        <div className="notifications-update-meta" aria-live="polite">
          <strong>{pagination.total}</strong> resultado{pagination.total === 1 ? "" : "s"}
          <span>
            {lastUpdatedAt
              ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
              : "Sin actualizar"}
          </span>
        </div>
      </div>

      {loading && items.length === 0 && (
        <p className="admin-view-loading" role="status" aria-live="polite">
          Cargando notificaciones…
        </p>
      )}

      {error && (
        <div className="notifications-load-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => loadNotifications()}
            aria-label="Reintentar carga"
          >
            <FaRedoAlt aria-hidden="true" /> Reintentar
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="empty-copy notifications-empty">
          No hay notificaciones para estos filtros.
        </p>
      )}

      {items.length > 0 && (
        <div className="notifications-table" role="table" aria-label="Notificaciones operativas">
          <div className="notifications-table-header" role="row">
            <span role="columnheader">Estado y tipo</span>
            <span role="columnheader">Turno y destinatario</span>
            <span role="columnheader">Intentos</span>
            <span role="columnheader">Fechas</span>
            <span role="columnheader">Acción</span>
          </div>
          {items.map((item) => {
            const retrying = retryingIds.has(item.id);
            const itemFeedback = rowFeedback[item.id];
            return (
              <div className="notifications-table-row" role="row" key={item.id}>
                <div role="cell" data-label="Estado y tipo" className="notification-state-cell">
                  <span
                    className={`notification-status-badge ${item.status}`}
                    aria-label={`Estado: ${NOTIFICATION_STATUS_LABELS[item.status]}`}
                  >
                    {NOTIFICATION_STATUS_LABELS[item.status]}
                  </span>
                  <strong>{NOTIFICATION_TYPE_LABELS[item.type]}</strong>
                  <span className="notification-channel">Email</span>
                </div>
                <div role="cell" data-label="Turno y destinatario" className="notification-reference-cell">
                  <span>Turno <strong>{item.booking.bookingCode}</strong></span>
                  <span>{item.recipient.masked}</span>
                </div>
                <div role="cell" data-label="Intentos" className="notification-attempt-cell">
                  <strong>{item.attempts} de {item.maxAttempts}</strong>
                </div>
                <div role="cell" data-label="Fechas" className="notification-dates-cell">
                  <span>Creada: {formatNotificationDate(item.createdAt)}</span>
                  {item.nextAttemptAt && (
                    <span>Próximo intento: {formatNotificationDate(item.nextAttemptAt)}</span>
                  )}
                  {item.expiresAt && (
                    <span>Vigente hasta: {formatNotificationDate(item.expiresAt)}</span>
                  )}
                  {item.sentAt && <span>Enviada: {formatNotificationDate(item.sentAt)}</span>}
                  {item.lastError && (
                    <p className="notification-safe-error">
                      <strong>Motivo:</strong> {item.lastError.message}
                    </p>
                  )}
                  {(item.lastError || item.providerMessageId) && (
                    <details className="notification-technical-details">
                      <summary>Detalle técnico</summary>
                      <dl>
                        {item.lastError && (
                          <>
                            <dt>Categoría</dt>
                            <dd>{NOTIFICATION_ERROR_CATEGORY_LABELS[item.lastError.category]}</dd>
                          </>
                        )}
                        {item.providerMessageId && (
                          <>
                            <dt>Identificador del proveedor</dt>
                            <dd><code>{item.providerMessageId}</code></dd>
                          </>
                        )}
                      </dl>
                    </details>
                  )}
                </div>
                <div role="cell" data-label="Acción" className="notification-action-cell">
                  {canRetryNotification(item.retryable) ? (
                    <button
                      type="button"
                      className="admin-primary-btn slim"
                      onClick={() => handleRetry(item)}
                      disabled={retrying}
                      aria-label={retrying
                        ? `Reintentando notificación ${item.booking.bookingCode}`
                        : `Reintentar notificación ${item.booking.bookingCode}`}
                    >
                      <FaRedoAlt aria-hidden="true" />
                      {retrying ? "Reintentando…" : "Reintentar"}
                    </button>
                  ) : (
                    <span className="notification-no-action">Sin acciones</span>
                  )}
                  {itemFeedback?.message && (
                    <p
                      className={`notification-row-feedback ${itemFeedback.type}`}
                      role={itemFeedback.type === "error" ? "alert" : "status"}
                      aria-live="polite"
                    >
                      {itemFeedback.message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!error && pagination.totalPages > 1 && (
        <nav className="pagination-bar" aria-label="Paginación de notificaciones">
          <button
            type="button"
            className="page-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => current - 1)}
            aria-label="Página anterior"
          >
            <FaChevronLeft aria-hidden="true" />
          </button>
          <span className="page-info" aria-live="polite">
            Página {pagination.page} de {pagination.totalPages}
          </span>
          <button
            type="button"
            className="page-btn"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            aria-label="Página siguiente"
          >
            <FaChevronRight aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  );
};

export default NotificationsView;
