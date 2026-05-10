import { useEffect, useMemo, useState } from "react";
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
  FaExclamationTriangle,
  FaPlus,
  FaSignOutAlt,
  FaUsers,
} from "react-icons/fa";
import { normalizeText as norm } from "../utils/bookingFormatters";
import { sendWhatsApp, getSentMessages } from "../utils/whatsappHelper";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { useBookingsData } from "../hooks/useBookingsData";
import { useBookingFilters } from "../hooks/useBookingFilters";
import { useDashboardStats } from "../hooks/useDashboardStats";
import { useBookingEditModal } from "../hooks/useBookingEditModal";
import AdminLoginScreen from "./admin/AdminLoginScreen";
import BookingEditModal from "./admin/BookingEditModal";
import BookingDetailModal from "./admin/BookingDetailModal";
import OverviewView from "./admin/views/OverviewView";
import AgendaView from "./admin/views/AgendaView";
import StudentsView from "./admin/views/StudentsView";
import BookingsView from "./admin/views/BookingsView";
import BlockedDatesView from "./admin/views/BlockedDatesView";
import ScheduleSettingsView from "./admin/views/ScheduleSettingsView";
import CalendarView from "./admin/views/CalendarView";
import logoIcon from "../assets/images/logo-icon-sin-fondo.png";
import "../styles/tokens.css";
import "./AdminPanel.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";

const VIEW_OPTIONS = [
  { id: "overview", label: "Resumen", icon: FaChartLine },
  { id: "agenda", label: "Agenda", icon: FaCalendarCheck },
  { id: "calendar", label: "Calendario", icon: FaCalendarAlt },
  { id: "students", label: "Alumnos", icon: FaUsers },
  { id: "bookings", label: "Turnos", icon: FaClipboardList },
  { id: "availability", label: "Disponibilidad", icon: FaBan },
  { id: "settings", label: "Ajustes", icon: FaCog },
];

const AdminPanel = () => {
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

  const {
    searchTerm,
    setSearchTerm,
    filterStatus,
    setFilterStatus,
    filteredBookings,
    matchCount,
    totalCount,
  } = useBookingFilters(sortedBookings);

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

  const [activeView, setActiveView] = useState("overview");
  const [viewBooking, setViewBooking] = useState(null);
  const [sentMessages, setSentMessages] = useState(getSentMessages);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAuthenticated || e.ctrlKey || e.metaKey) return;
      if (e.key === "n" || e.key === "N") {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          window.open("/", "_blank");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated]);

  const handleSendWhatsApp = (booking) => {
    const updated = sendWhatsApp(booking);
    if (updated) setSentMessages(updated);
  };

  const filteredStudents = useMemo(() => {
    const term = norm(searchTerm);
    if (!term) return overviewData.students;
    return overviewData.students.filter((student) =>
      student.searchBlob.includes(term),
    );
  }, [overviewData.students, searchTerm]);

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
          <h3>{overviewData.todayBookings.length} clases activas</h3>
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
              <span>{overviewData.upcoming24h.length} en 24 hs</span>
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

      <main className="admin-main-shell">
        <header className="admin-hero">
          <div>
            <span className="admin-eyebrow">Hola, Agustín</span>
            <h1>Tu agenda al día</h1>
            <p>{heroText}</p>
          </div>

          <div className="admin-hero-actions">
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

        <section className="admin-kpi-grid">
          <article className="admin-kpi-card">
            <div className="kpi-icon emerald">
              <FaCalendarCheck />
            </div>
            <div>
              <span>Clases hoy</span>
              <strong>{overviewData.todayBookings.length}</strong>
              <small>
                {overviewData.upcoming24h.length} en las próximas 24 hs
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
        </section>

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
            filteredStudents={filteredStudents}
            sortedBookings={sortedBookings}
            onSelectBooking={setViewBooking}
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
      </main>

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
    </div>
  );
};

export default AdminPanel;
