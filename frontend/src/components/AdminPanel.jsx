import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaBell,
  FaCalendarCheck,
  FaChartLine,
  FaClipboardList,
  FaExclamationTriangle,
  FaPlus,
  FaSignOutAlt,
  FaUsers,
} from "react-icons/fa";
import {
  buildStudentKey as studentKey,
  formatDayLabel as formatDay,
  formatLongDateLabel as formatDate,
  formatTimeLabel as formatTime,
  getBookingStatusBucket as bookingStatusBucket,
  getResponsibleDisplay as responsibleLabel,
  getResponsibleRelationshipDisplay as responsibleRelationshipLabel,
  getResponsibleSummary as responsibleSummary,
  isSameCalendarDay as sameDay,
  normalizeText as norm,
  toSafeDate as toDate,
} from "../utils/bookingFormatters";
import {
  fetchAllBookings,
  updateBooking,
  deleteBooking,
  deleteAllBookings,
} from "../api/bookingApi";
import { useAdminAuth } from "../hooks/useAdminAuth";
import AdminLoginScreen from "./admin/AdminLoginScreen";
import BookingEditModal from "./admin/BookingEditModal";
import BookingDetailModal from "./admin/BookingDetailModal";
import OverviewView from "./admin/views/OverviewView";
import AgendaView from "./admin/views/AgendaView";
import StudentsView from "./admin/views/StudentsView";
import BookingsView from "./admin/views/BookingsView";
import logoIcon from "../assets/images/logo-icon-sin-fondo.png";
import "../styles/tokens.css";
import "./AdminPanel.css";
import "../styles/theme-polish.css";
import "../styles/accessibility-system.css";

const VIEW_OPTIONS = [
  { id: "overview", label: "Resumen", icon: FaChartLine },
  { id: "agenda", label: "Agenda", icon: FaCalendarCheck },
  { id: "students", label: "Alumnos", icon: FaUsers },
  { id: "bookings", label: "Turnos", icon: FaClipboardList },
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

  const [bookings, setBookings] = useState([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [sentMessages, setSentMessages] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("Todos");
  const [activeView, setActiveView] = useState("overview");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [viewBooking, setViewBooking] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editEvolution, setEditEvolution] = useState("");
  const [editEmotionalState, setEditEmotionalState] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isAuthenticated) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "n" || e.key === "N") {
          e.preventDefault();
          window.open("/", "_blank");
        }
        if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          setDataLoading(true);
          fetchAllBookings(authConfig)
            .then((res) =>
              setBookings(Array.isArray(res.data.data) ? res.data.data : []),
            )
            .catch((error) => console.error("Error al recargar reservas:", error))
            .finally(() => setDataLoading(false));
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAuthenticated, authConfig]);

  useEffect(() => {
    const loadBookings = async () => {
      setDataLoading(true);
      try {
        const response = await fetchAllBookings(authConfig);
        setBookings(Array.isArray(response.data.data) ? response.data.data : []);
      } catch (error) {
        console.error("Error al cargar reservas:", error);
        if (error.response?.status === 401) {
          handleLogout();
          setBookings([]);
        }
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) loadBookings();
  }, [authConfig, isAuthenticated, handleLogout]);

  const sortedBookings = useMemo(
    () =>
      [...bookings].sort((a, b) => {
        const first = toDate(a.timeSlot)?.getTime() ?? 0;
        const second = toDate(b.timeSlot)?.getTime() ?? 0;
        return first - second;
      }),
    [bookings],
  );

  const filteredBookings = useMemo(() => {
    const term = norm(searchTerm);
    return sortedBookings.filter((booking) => {
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
        filterStatus === "Todos" ||
        bookingStatusBucket(booking.status) === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [filterStatus, searchTerm, sortedBookings]);

  const dashboard = useMemo(() => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const enriched = sortedBookings.map((booking) => ({
      ...booking,
      start: toDate(booking.timeSlot),
      end: toDate(booking.endTime),
    }));

    const stats = {
      total: enriched.length,
      pending: enriched.filter((booking) => booking.status === "Pendiente").length,
      confirmed: enriched.filter(
        (booking) => bookingStatusBucket(booking.status) === "Confirmado",
      ).length,
      cancelled: enriched.filter((booking) => booking.status === "Cancelado").length,
      finalized: enriched.filter((booking) => booking.status === "Finalizado").length,
    };

    return { now, today, next24h, enriched, stats };
  }, [sortedBookings]);

  const overviewData = useMemo(() => {
    const todayBookings = dashboard.enriched.filter(
      (booking) =>
        booking.start &&
        sameDay(booking.start, dashboard.today) &&
        booking.status !== "Cancelado",
    );
    const upcomingBookings = dashboard.enriched.filter(
      (booking) =>
        booking.start &&
        booking.start >= dashboard.now &&
        booking.status !== "Cancelado",
    );
    const upcoming24h = upcomingBookings.filter(
      (booking) => booking.start && booking.start <= dashboard.next24h,
    );
    const overduePending = dashboard.enriched.filter(
      (booking) =>
        booking.status === "Pendiente" &&
        booking.start &&
        booking.start < dashboard.now,
    );
    const weekFlow = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(dashboard.today);
      date.setDate(dashboard.today.getDate() + index);
      const count = dashboard.enriched.filter(
        (booking) =>
          booking.start &&
          sameDay(booking.start, date) &&
          booking.status !== "Cancelado",
      ).length;
      return { label: formatDay(date), count };
    });

    const subjectsMap = new Map();
    dashboard.enriched.forEach((booking) => {
      const subject =
        String(booking.subject || "Sin materia").trim() || "Sin materia";
      subjectsMap.set(subject, (subjectsMap.get(subject) || 0) + 1);
    });
    const topSubjects = [...subjectsMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const studentsMap = new Map();
    dashboard.enriched.forEach((booking) => {
      const key = studentKey(booking);
      const existing = studentsMap.get(key);
      if (!existing) {
        studentsMap.set(key, {
          key,
          studentName: booking.studentName,
          responsibleName: responsibleLabel(booking),
          responsibleRelationship: responsibleRelationshipLabel(booking),
          responsibleSummary: responsibleSummary(booking),
          school: booking.school,
          educationLevel: booking.educationLevel,
          yearGrade: booking.yearGrade,
          phone: booking.phone,
          email: booking.email,
          totalBookings: 1,
          nextBooking:
            booking.start &&
            booking.start >= dashboard.now &&
            booking.status !== "Cancelado"
              ? booking.start
              : null,
          subjects: new Set([booking.subject].filter(Boolean)),
          searchBlob: norm(
            [
              booking.studentName,
              booking.responsibleName,
              responsibleRelationshipLabel(booking),
              booking.phone,
              booking.email,
              booking.subject,
              booking.school,
            ].join(" "),
          ),
        });
        return;
      }

      existing.totalBookings += 1;
      if (booking.subject) existing.subjects.add(booking.subject);
      if (
        booking.start &&
        booking.start >= dashboard.now &&
        booking.status !== "Cancelado" &&
        (!existing.nextBooking || booking.start < existing.nextBooking)
      ) {
        existing.nextBooking = booking.start;
      }
    });

    const students = [...studentsMap.values()]
      .map((student) => ({ ...student, subjects: [...student.subjects] }))
      .sort(
        (a, b) =>
          (a.nextBooking?.getTime() ?? Infinity) -
          (b.nextBooking?.getTime() ?? Infinity),
      );

    const recentActivity = [...dashboard.enriched]
      .sort(
        (a, b) =>
          (toDate(b.updatedAt)?.getTime() ?? 0) -
          (toDate(a.updatedAt)?.getTime() ?? 0),
      )
      .slice(0, 6);

    return {
      todayBookings,
      upcomingBookings,
      upcoming24h,
      overduePending,
      weekFlow,
      topSubjects,
      students,
      recentActivity,
    };
  }, [dashboard]);

  const filteredStudents = useMemo(() => {
    const term = norm(searchTerm);
    if (!term) return overviewData.students;
    return overviewData.students.filter((student) =>
      student.searchBlob.includes(term),
    );
  }, [overviewData.students, searchTerm]);

  const heroText = useMemo(() => {
    if (!dashboard.stats.total) return "Todavía no hay reservas cargadas.";
    if (overviewData.todayBookings.length > 0) {
      return `Hoy tenés ${overviewData.todayBookings.length} clases activas y ${overviewData.upcoming24h.length} movimientos en las próximas 24 horas.`;
    }
    if (dashboard.stats.pending > 0) {
      return `Tenés ${dashboard.stats.pending} registros pendientes para revisar.`;
    }
    return "Todo en orden. Buen momento para revisar alumnos y agenda.";
  }, [
    dashboard.stats.pending,
    dashboard.stats.total,
    overviewData.todayBookings.length,
    overviewData.upcoming24h.length,
  ]);

  const handleQuickStatusChange = async (id, newStatus) => {
    try {
      await updateBooking(id, { status: newStatus }, authConfig);
      setBookings((current) =>
        current.map((booking) =>
          booking._id === id ? { ...booking, status: newStatus } : booking,
        ),
      );
    } catch {
      alert("No se pudo actualizar el estado.");
    }
  };

  const sendWhatsApp = (booking) => {
    if (!booking.phone) {
      alert("Este registro no tiene un teléfono válido para WhatsApp.");
      return;
    }

    let phone = String(booking.phone).replace(/\D/g, "");
    if (phone.length === 10) phone = `549${phone}`;
    const start = toDate(booking.timeSlot);
    const when = start
      ? `${formatDate(start)} a las ${formatTime(start)} hs`
      : "fecha pendiente";
    const name = booking.studentName || "Alumno";
    const message = `Hola ${name}, soy Agustín Sosa. Te escribo por tu turno de ${booking.subject} previsto para ${when}.`;
    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      "_blank",
    );
    setSentMessages((current) => ({ ...current, [booking._id]: true }));
  };

  const handleUpdate = async () => {
    try {
      const payload = {
        status: selectedBooking.status,
        notes: editNotes,
        studentEvolution: editEvolution,
        emotionalState: editEmotionalState,
      };
      await updateBooking(selectedBooking._id, payload, authConfig);
      setBookings((current) =>
        current.map((booking) =>
          booking._id === selectedBooking._id
            ? { ...booking, ...payload }
            : booking,
        ),
      );
      setSelectedBooking(null);
    } catch {
      alert("No se pudieron guardar los cambios.");
    }
  };

  const openEditBooking = (booking) => {
    setSelectedBooking(booking);
    setEditNotes(booking.notes || "");
    setEditEvolution(booking.studentEvolution || "");
    setEditEmotionalState(booking.emotionalState || "");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar esta reserva?")) return;
    try {
      await deleteBooking(id, authConfig);
      setBookings((current) => current.filter((booking) => booking._id !== id));
    } catch {
      alert("Error al eliminar la reserva.");
    }
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm("Estás por borrar toda la base de reservas. ¿Continuar?")
    )
      return;
    const confirmation = prompt("Escribe ELIMINAR para confirmar:");
    if (confirmation !== "ELIMINAR") return;
    setDataLoading(true);
    try {
      await deleteAllBookings(authConfig);
      setBookings([]);
    } catch {
      alert("No se pudo limpiar la base.");
    } finally {
      setDataLoading(false);
    }
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
            setBookings([]);
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
              <span>Próximas clases</span>
              <strong>{overviewData.upcomingBookings.length}</strong>
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
              <span>Agenda confirmada</span>
              <strong>{dashboard.stats.confirmed}</strong>
              <small>{overviewData.upcoming24h.length} próximas 24 hs</small>
            </div>
          </article>
          <article className="admin-kpi-card">
            <div className="kpi-icon blue">
              <FaUsers />
            </div>
            <div>
              <span>Alumnos activos</span>
              <strong>{overviewData.students.length}</strong>
              <small>{dashboard.stats.total} reservas registradas</small>
            </div>
          </article>
          <article className="admin-kpi-card">
            <div className="kpi-icon slate">
              <FaChartLine />
            </div>
            <div>
              <span>Conversión</span>
              <strong>
                {dashboard.stats.total
                  ? Math.round(
                      (dashboard.stats.confirmed / dashboard.stats.total) * 100,
                    )
                  : 0}
                %
              </strong>
              <small>{dashboard.stats.cancelled} cancelados</small>
            </div>
          </article>
        </section>

        {activeView === "overview" && (
          <OverviewView
            overviewData={overviewData}
            dashboard={dashboard}
            onSelectBooking={setViewBooking}
            onSendWhatsApp={sendWhatsApp}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}

        {activeView === "agenda" && (
          <AgendaView
            overviewData={overviewData}
            onSendWhatsApp={sendWhatsApp}
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
            onSearchTermChange={setSearchTerm}
            onFilterStatusChange={setFilterStatus}
            onSendWhatsApp={sendWhatsApp}
            onSelectBooking={setViewBooking}
            onEditBooking={openEditBooking}
            onDeleteBooking={handleDelete}
            onDeleteAll={handleDeleteAll}
            onQuickStatusChange={handleQuickStatusChange}
          />
        )}
      </main>

      {selectedBooking && (
        <BookingEditModal
          booking={selectedBooking}
          editNotes={editNotes}
          editEvolution={editEvolution}
          editEmotionalState={editEmotionalState}
          onClose={() => setSelectedBooking(null)}
          onNotesChange={(e) => setEditNotes(e.target.value)}
          onEvolutionChange={(e) => setEditEvolution(e.target.value)}
          onEmotionalStateChange={(e) => setEditEmotionalState(e.target.value)}
          onStatusChange={(e) =>
            setSelectedBooking({ ...selectedBooking, status: e.target.value })
          }
          onSave={handleUpdate}
        />
      )}

      {viewBooking && (
        <BookingDetailModal
          booking={viewBooking}
          onClose={() => setViewBooking(null)}
          onContactWhatsApp={sendWhatsApp}
        />
      )}
    </div>
  );
};

export default AdminPanel;
