import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBan,
  FaBell,
  FaCalendarAlt,
  FaCalendarCheck,
  FaChartLine,
  FaClipboardList,
  FaCog,
  FaDollarSign,
  FaEllipsisH,
  FaExclamationTriangle,
  FaHistory,
  FaKeyboard,
  FaPlus,
  FaSignOutAlt,
  FaTimes,
  FaUsers,
} from "react-icons/fa";
import { sendWhatsApp, getSentMessages } from "../utils/whatsappHelper";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { toSafeDate as toDate } from "../utils/bookingFormatters";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useBookingsData } from "../hooks/useBookingsData";
import { useBookingFilters } from "../hooks/useBookingFilters";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useBookingEditModal } from "../hooks/useBookingEditModal";
import { useFocusTrap } from "../hooks/useFocusTrap";
import AdminLoginScreen from "./admin/AdminLoginScreen";
import BookingEditModal from "./admin/BookingEditModal";
import BookingDetailModal from "./admin/BookingDetailModal";
const OverviewView = lazy(() => import("./admin/views/OverviewView"));
const AgendaView = lazy(() => import("./admin/views/AgendaView"));
const StudentsView = lazy(() => import("./admin/views/StudentsView"));
const BookingsView = lazy(() => import("./admin/views/BookingsView"));
const BlockedDatesView = lazy(() => import("./admin/views/BlockedDatesView"));
const ScheduleSettingsView = lazy(() => import("./admin/views/ScheduleSettingsView"));
const CalendarView = lazy(() => import("./admin/views/CalendarView"));
const HistoryView = lazy(() => import("./admin/views/HistoryView"));
import { SkeletonKPI } from "./admin/shared/Skeleton";
import logoIcon from "../assets/images/logo-icon-sin-fondo.png";
import "../styles/tokens.css";
import "./AdminPanel.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const VIEW_OPTIONS = [
  { id: "overview", label: "Resumen", icon: FaChartLine },
  { id: "agenda", label: "Agenda", icon: FaCalendarCheck },
  { id: "calendar", label: "Calendario", icon: FaCalendarAlt },
  { id: "students", label: "Alumnos", icon: FaUsers },
  { id: "bookings", label: "Turnos", icon: FaClipboardList },
  { id: "history", label: "Historial", icon: FaHistory },
  { id: "availability", label: "Disponibilidad", icon: FaBan },
  { id: "settings", label: "Ajustes", icon: FaCog },
];

const AdminPanel = () => {
  useDocumentTitle("Panel de administracion");
  const {
    authConfig,
    isAuthenticated,
    username,
    password,
    loading,
    authError,
    setUsername,
    setPassword,
    handleLogin,
    handleLogout,
  } = useAdminAuth();

  const {
    bookings,
    sortedBookings,
    dataLoading,
    handleQuickStatusChange,
    updateBookingFields,
    deleteBooking,
    deleteAllBookings,
    clearBookings,
  } = useBookingsData({ authConfig, isAuthenticated, handleLogout });

  const { activeBookings, historyBookings } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const active = [];
    const history = [];

    sortedBookings.forEach((b) => {
      const date = toDate(b.timeSlot);
      const isActive =
        date &&
        date >= todayStart &&
        (b.status === "Pendiente" || b.status === "Confirmado");
      (isActive ? active : history).push(b);
    });

    return { activeBookings: active, historyBookings: history };
  }, [sortedBookings]);

  const {
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredBookings,
    matchCount,
    totalCount,
  } = useBookingFilters(activeBookings);

  const { dashboard, overviewData, heroText } =
    useDashboardStats(sortedBookings);

  const {
    selectedBooking,
    editNotes,
    editEvolution,
    editEmotionalState,
    setEditNotes,
    setEditEvolution,
    setEditEmotionalState,
    openEditBooking,
    closeEditBooking,
    handleSave,
    handleStatusChange,
  } = useBookingEditModal(updateBookingFields);

  usePushNotifications(isAuthenticated ? authConfig : null);

  const [activeView, setActiveView] = useState("overview");
  const [viewBooking, setViewBooking] = useState(null);
  const [sentMessages, setSentMessages] = useState(getSentMessages);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showMoreNav, setShowMoreNav] = useState(false);
  const moreNavRef = useRef(null);

  const shortcutsRef = useFocusTrap(showShortcuts);

  useEffect(() => {
    if (!isAuthenticated) return;
    const VIEW_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const handleKeyDown = (e) => {
      // Skip if inside an input/textarea
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }
      if (e.key === "Escape" && showShortcuts) {
        setShowShortcuts(false);
        return;
      }
      const idx = VIEW_KEYS.indexOf(e.key);
      if (idx !== -1 && idx < VIEW_OPTIONS.length) {
        e.preventDefault();
        setActiveView(VIEW_OPTIONS[idx].id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, showShortcuts]);

  useEffect(() => {
    if (!showMoreNav) return;
    const handler = (e) => {
      if (moreNavRef.current && !moreNavRef.current.contains(e.target)) {
        setShowMoreNav(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreNav]);

  const handleSendWhatsApp = (booking) => {
    const updated = sendWhatsApp(booking);
    if (updated) setSentMessages(updated);
  };

  if (!isAuthenticated) {
    return (
      <AdminLoginScreen
        username={username}
        password={password}
        loading={loading}
        authError={authError}
        onUsernameChange={(e) => setUsername(e.target.value)}
        onPasswordChange={(e) => setPassword(e.target.value)}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <div className="admin-shell">
      <a href="#admin-main-content" className="skip-link">Saltar al contenido principal</a>
      <aside className="admin-sidebar-shell">
        <div className="admin-brand-panel">
          <div className="admin-brand-badge admin-brand-badge--logo">
            <img src={logoIcon} alt="" aria-hidden="true" />
          </div>
          <div>
            <strong>Agustín Sosa</strong>
            <span>Panel del profesor</span>
          </div>
        </div>

        <div className="admin-sidebar-card">
          <span className="sidebar-kicker">Hoy</span>
          <p className="sidebar-stat-headline" aria-label={`${overviewData.todayBookings.length} clases activas hoy`}>
            {overviewData.todayBookings.length} clases activas
          </p>
          <p>{heroText}</p>
          <div className="sidebar-inline-stats">
            <div>
              <strong>{dashboard.stats.confirmed}</strong>
              <span>Confirmados</span>
            </div>
            <div>
              <strong>{overviewData.students.length}</strong>
              <span>Alumnos</span>
            </div>
          </div>
        </div>

        <nav className="admin-nav-grid" aria-label="Vistas del panel">
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                className={`admin-nav-btn ${activeView === option.id ? "is-active" : ""}`}
                aria-pressed={activeView === option.id}
                onClick={() => setActiveView(option.id)}
              >
                <Icon aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-card compact">
          <span className="sidebar-kicker">Atajos</span>
          <div className="sidebar-alert-list">
            <div>
              <FaBell />
              <span>{overviewData.upcoming24h.length} en 24 h</span>
            </div>
            <div>
              <FaExclamationTriangle />
              <span>{dashboard.stats.cancelled} cancelados</span>
            </div>
            <div>
              <FaUsers />
              <span>{overviewData.students.length} alumnos</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="admin-logout-btn"
          onClick={() => {
            handleLogout();
            clearBookings();
          }}
        >
          <FaSignOutAlt />
          Cerrar sesión
        </button>
      </aside>

      <main id="admin-main-content" className="admin-main-shell" tabIndex={-1}>
        <header className="admin-hero">
          <div>
            <span className="admin-eyebrow">Hola, Agustín</span>
            <h1>Tu agenda al día</h1>
            <p>{heroText}</p>
          </div>

          <div className="admin-hero-actions">
            <button
              type="button"
              className="admin-secondary-btn slim"
              onClick={() => setShowShortcuts(true)}
              title="Atajos de teclado (?)"
            >
              <FaKeyboard />
              Atajos
            </button>
            <Link to="/" className="admin-secondary-btn" target="_blank">
              <FaPlus />
              Nueva reserva
            </Link>
            <button
              type="button"
              className="admin-primary-btn slim"
              onClick={() => setActiveView("bookings")}
            >
              <FaClipboardList />
              Ver turnos
            </button>
          </div>
        </header>

        <section
          className="admin-kpi-grid"
          aria-live="polite"
          aria-label="Estadísticas del panel"
        >
          {dataLoading ? (
            <>
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
              <SkeletonKPI />
            </>
          ) : (
            <>
              <article className="admin-kpi-card">
                <div className="kpi-icon emerald">
                  <FaCalendarCheck />
                </div>
                <div>
                  <span>Clases hoy</span>
                  <strong>{overviewData.todayBookings.length}</strong>
                  <small>
                    {overviewData.upcoming24h.length} en las próximas 24 h
                  </small>
                </div>
              </article>
              <article className="admin-kpi-card">
                <div className="kpi-icon amber">
                  <FaExclamationTriangle />
                </div>
                <div>
                  <span>Pendientes</span>
                  <strong>{dashboard.stats.pending}</strong>
                  <small>
                    {overviewData.overduePending.length > 0
                      ? `${overviewData.overduePending.length} vencidos`
                      : "Sin vencidos"}
                  </small>
                </div>
              </article>
              <article className="admin-kpi-card">
                <div className="kpi-icon blue">
                  <FaUsers />
                </div>
                <div>
                  <span>Alumnos activos</span>
                  <strong>
                    {overviewData.students.filter((s) => s.nextBooking).length}
                  </strong>
                  <small>{overviewData.students.length} registrados</small>
                </div>
              </article>
              <article className="admin-kpi-card">
                <div className="kpi-icon success">
                  <FaDollarSign />
                </div>
                <div>
                  <span>Ingresos del mes</span>
                  <strong>
                    ${overviewData.monthRevenue.toLocaleString("es-AR")}
                  </strong>
                  <small>
                    {overviewData.lastMonthRevenue > 0
                      ? `${overviewData.monthRevenue >= overviewData.lastMonthRevenue ? "+" : ""}${Math.round(((overviewData.monthRevenue - overviewData.lastMonthRevenue) / overviewData.lastMonthRevenue) * 100)}% vs mes anterior`
                      : "Sin datos del mes anterior"}
                  </small>
                </div>
              </article>
            </>
          )}
        </section>

        <Suspense fallback={<div className="admin-view-loading" aria-live="polite">Cargando vista…</div>}>
          {activeView === "overview" && (
            <OverviewView
              overviewData={overviewData}
              dashboard={dashboard}
              onSelectBooking={setViewBooking}
              onSendWhatsApp={handleSendWhatsApp}
              onQuickStatusChange={handleQuickStatusChange}
            />
          )}

          {activeView === "agenda" && (
            <AgendaView
              overviewData={overviewData}
              onSendWhatsApp={handleSendWhatsApp}
              onQuickStatusChange={handleQuickStatusChange}
            />
          )}

          {activeView === "students" && (
            <StudentsView
              students={overviewData.students}
              sortedBookings={sortedBookings}
              onSelectBooking={setViewBooking}
              onSendWhatsApp={handleSendWhatsApp}
            />
          )}

          {activeView === "bookings" && (
            <BookingsView
              searchTerm={searchTerm}
              filterStatus={filterStatus}
              filteredBookings={filteredBookings}
              bookings={bookings}
              sentMessages={sentMessages}
              dataLoading={dataLoading}
              matchCount={matchCount}
              totalCount={totalCount}
              onSearchTermChange={setSearchTerm}
              onFilterStatusChange={setFilterStatus}
              onSendWhatsApp={handleSendWhatsApp}
              onSelectBooking={setViewBooking}
              onEditBooking={openEditBooking}
              onDeleteBooking={deleteBooking}
              onDeleteAll={deleteAllBookings}
              onQuickStatusChange={handleQuickStatusChange}
            />
          )}

          {activeView === "history" && (
            <HistoryView
              historyBookings={historyBookings}
              sentMessages={sentMessages}
              dataLoading={dataLoading}
              onSendWhatsApp={handleSendWhatsApp}
              onSelectBooking={setViewBooking}
            />
          )}

          {activeView === "calendar" && (
            <CalendarView
              sortedBookings={sortedBookings}
              onSelectBooking={setViewBooking}
            />
          )}

          {activeView === "availability" && (
            <BlockedDatesView authConfig={authConfig} />
          )}

          {activeView === "settings" && (
            <ScheduleSettingsView authConfig={authConfig} />
          )}
        </Suspense>
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav className="admin-bottom-nav" aria-label="Navegación principal">
        {[
          { id: "overview", label: "Resumen", icon: FaChartLine },
          { id: "agenda", label: "Agenda", icon: FaCalendarCheck },
          { id: "bookings", label: "Turnos", icon: FaClipboardList },
          { id: "settings", label: "Ajustes", icon: FaCog },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-btn${activeView === item.id ? " is-active" : ""}`}
              aria-pressed={activeView === item.id}
              onClick={() => { setActiveView(item.id); setShowMoreNav(false); }}
            >
              <Icon aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className="bottom-nav-more-wrapper" ref={moreNavRef}>
          {showMoreNav && (
            <div className="bottom-nav-more-drawer" role="menu" aria-label="Más vistas">
              {[
                { id: "calendar", label: "Calendario", icon: FaCalendarAlt },
                { id: "students", label: "Alumnos", icon: FaUsers },
                { id: "history", label: "Historial", icon: FaHistory },
                { id: "availability", label: "Disponibilidad", icon: FaBan },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`bottom-nav-drawer-btn${activeView === item.id ? " is-active" : ""}`}
                    role="menuitem"
                    onClick={() => { setActiveView(item.id); setShowMoreNav(false); }}
                  >
                    <Icon aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            className={`bottom-nav-btn${showMoreNav ? " is-active" : ""}`}
            aria-expanded={showMoreNav}
            aria-haspopup="menu"
            onClick={() => setShowMoreNav((v) => !v)}
          >
            <FaEllipsisH aria-hidden="true" />
            <span>Más</span>
          </button>
        </div>
      </nav>

      {selectedBooking && (
        <BookingEditModal
          booking={selectedBooking}
          editNotes={editNotes}
          editEvolution={editEvolution}
          editEmotionalState={editEmotionalState}
          onClose={closeEditBooking}
          onNotesChange={(e) => setEditNotes(e.target.value)}
          onEvolutionChange={(e) => setEditEvolution(e.target.value)}
          onEmotionalStateChange={(e) => setEditEmotionalState(e.target.value)}
          onStatusChange={handleStatusChange}
          onSave={handleSave}
        />
      )}

      {viewBooking && (
        <BookingDetailModal
          booking={viewBooking}
          onClose={() => setViewBooking(null)}
          onContactWhatsApp={handleSendWhatsApp}
        />
      )}

      {showShortcuts && (
        <div
          className="admin-shortcuts-overlay"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            ref={shortcutsRef}
            className="admin-shortcuts-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            tabIndex={-1}
          >
            <div className="shortcuts-header">
              <div>
                <FaKeyboard aria-hidden="true" />
                <h3 id="shortcuts-title">Atajos de teclado</h3>
              </div>
              <button
                type="button"
                className="shortcuts-close-btn"
                onClick={() => setShowShortcuts(false)}
                aria-label="Cerrar"
              >
                <FaTimes />
              </button>
            </div>
            <div className="shortcuts-body">
              <div className="shortcuts-section">
                <h4>Vistas</h4>
                <ul>
                  {VIEW_OPTIONS.map((opt, i) => (
                    <li key={opt.id}>
                      <kbd>{i + 1}</kbd>
                      <span>{opt.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="shortcuts-section">
                <h4>General</h4>
                <ul>
                  <li>
                    <kbd>?</kbd>
                    <span>Mostrar / ocultar atajos</span>
                  </li>
                  <li>
                    <kbd>Esc</kbd>
                    <span>Cerrar panel o modal</span>
                  </li>
                  <li>
                    <kbd>Ctrl+R</kbd>
                    <span>Recargar turnos</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
