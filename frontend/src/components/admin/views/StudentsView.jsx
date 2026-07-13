import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCalendarAlt, FaSearch, FaUserGraduate } from "react-icons/fa";
import { fetchStudentById, fetchStudents } from "../../../api/bookingApi";
import {
  buildStudentKey,
  formatShortDateLabel as formatShortDate,
  formatTimeLabel as formatTime,
  normalizeText,
} from "../../../utils/bookingFormatters";
import StudentDetailView from "./StudentDetailView";

const PAGE_SIZE = 12;

const isStudentFeatureUnavailable = (error) => {
  const status = error?.response?.status;
  const code = String(error?.response?.data?.code || "").toUpperCase();
  return status === 404 || status === 501 || code === "FEATURE_UNAVAILABLE";
};

const activityFor = (student) => {
  if (student.metrics?.nextBookingAt) return "active";
  return student.active === false ? "inactive" : "recent";
};

const ACTIVITY_LABELS = {
  active: "Con próximo turno",
  recent: "Activo",
  inactive: "Inactivo",
};

const legacyMatchesSearch = (student, term) =>
  normalizeText([
    student.studentName,
    student.responsibleSummary,
    ...(student.subjects || []),
  ].join(" ")).includes(normalizeText(term));

const profileResponsibleSummary = (student) => {
  if (student.studentType === "adult" || student.responsible?.relationship === "self") {
    return "Alumno mayor de edad";
  }
  if (!student.responsible?.name) return "Sin responsable informado";
  return `${student.responsible.relationshipOther || student.responsible.relationship || "Responsable"}: ${student.responsible.name}`;
};

const StudentsView = ({
  legacyStudents = [],
  sortedBookings = [],
  authConfig,
  onSelectBooking,
  onSendWhatsApp,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [mode, setMode] = useState("api");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const requestSequence = useRef(0);
  const detailTriggerIdRef = useRef("");
  const detailRequestSequence = useRef(0);
  const detailAbortController = useRef(null);

  const loadStudents = useCallback(async (requestedPage, requestedSearch) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetchStudents({
        page: requestedPage,
        limit: PAGE_SIZE,
        search: requestedSearch,
        scope: "active",
      }, authConfig);
      if (sequence !== requestSequence.current) return;
      const payload = response?.data || {};
      setStudents(Array.isArray(payload.data) ? payload.data : []);
      setPagination(payload.pagination || { page: requestedPage, total: 0, totalPages: 1 });
      setMode("api");
    } catch (requestError) {
      if (sequence !== requestSequence.current) return;
      if (isStudentFeatureUnavailable(requestError)) {
        setMode("legacy");
      } else {
        setError("No pudimos cargar los perfiles de alumnos. Intentá nuevamente.");
      }
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [authConfig]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStudents(page, searchTerm.trim());
    }, searchTerm ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [loadStudents, page, searchTerm]);

  useEffect(() => () => {
    detailAbortController.current?.abort();
    detailRequestSequence.current += 1;
  }, []);

  const enrichedLegacyStudents = useMemo(() => legacyStudents.map((student) => {
    const matchingBookings = sortedBookings
      .filter((booking) => buildStudentKey(booking) === student.key && booking.status !== "Cancelado");
    const pastBookings = matchingBookings
      .filter((booking) => new Date(booking.timeSlot).getTime() < Date.now())
      .sort((first, second) => new Date(second.timeSlot) - new Date(first.timeSlot));
    return { ...student, lastBooking: pastBookings[0]?.timeSlot || null };
  }), [legacyStudents, sortedBookings]);
  const legacyVisible = useMemo(
    () => enrichedLegacyStudents.filter((student) => legacyMatchesSearch(student, searchTerm)),
    [enrichedLegacyStudents, searchTerm],
  );
  const visibleStudents = mode === "legacy" ? legacyVisible : students;
  const total = mode === "legacy" ? legacyVisible.length : pagination.total;

  const openStudent = async (student) => {
    detailAbortController.current?.abort();
    const controller = new AbortController();
    detailAbortController.current = controller;
    const sequence = ++detailRequestSequence.current;
    detailTriggerIdRef.current = mode === "legacy" ? student.key : student.id;
    setSelectedStudent(student);
    setStudentDetail(null);
    setDetailError("");
    if (mode === "legacy") {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    try {
      const response = await fetchStudentById(student.id, authConfig, controller.signal);
      if (sequence !== detailRequestSequence.current) return;
      setStudentDetail(response?.data?.data || null);
    } catch {
      if (sequence !== detailRequestSequence.current) return;
      setDetailError("No pudimos cargar el perfil. Intentá nuevamente.");
    } finally {
      if (sequence === detailRequestSequence.current) setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    const triggerId = detailTriggerIdRef.current;
    detailAbortController.current?.abort();
    detailRequestSequence.current += 1;
    setSelectedStudent(null);
    setStudentDetail(null);
    setDetailError("");
    window.setTimeout(() => {
      const candidate = [...document.querySelectorAll("[data-student-trigger]")]
        .find((element) => element.dataset.studentTrigger === triggerId);
      candidate?.focus();
    }, 0);
  };

  if (selectedStudent) {
    return (
      <StudentDetailView
        data={studentDetail}
        legacyStudent={mode === "legacy" ? selectedStudent : null}
        legacyBookings={sortedBookings}
        loading={detailLoading}
        error={detailError}
        onRetry={() => openStudent(selectedStudent)}
        onBack={closeDetail}
        onSelectBooking={onSelectBooking}
        onSendWhatsApp={onSendWhatsApp}
      />
    );
  }

  return (
    <section className="admin-card" aria-busy={loading}>
      <div className="admin-card-header spread">
        <div><span className="card-kicker">Registro</span><h3>Alumnos y responsables</h3></div>
      </div>

      {mode === "legacy" && (
        <div className="student-migration-notice" role="status">
          <strong>Perfiles pendientes de migración</strong>
          <span>Los perfiles reales todavía no están disponibles. Esta lista provisoria se deriva de reservas y no combina identidades automáticamente.</span>
        </div>
      )}

      <div className="admin-toolbar">
        <label className="admin-search-box">
          <FaSearch aria-hidden="true" />
          <span className="sr-only">Buscar alumno</span>
          <input type="search" placeholder="Buscar alumno, responsable, materia..." value={searchTerm}
            onChange={(event) => { setSearchTerm(event.target.value); setPage(1); }} autoComplete="off" />
        </label>
        <p className="admin-search-count" aria-live="polite">{total} alumno{total !== 1 ? "s" : ""}</p>
      </div>

      {loading && <p className="admin-view-loading" role="status">Cargando perfiles de alumnos…</p>}
      {!loading && error && (
        <div className="student-load-error" role="alert">
          <p>{error}</p><button type="button" className="secondary-button" onClick={() => loadStudents(page, searchTerm.trim())}>Reintentar</button>
        </div>
      )}

      {!loading && !error && (
        <div className="students-grid">
          {visibleStudents.length === 0 ? <p className="empty-copy">No hay alumnos que coincidan con la búsqueda.</p> :
            visibleStudents.map((student) => {
              const legacy = mode === "legacy";
              const metrics = legacy ? { bookingsCount: student.totalBookings, lastBookingAt: student.lastBooking, nextBookingAt: student.nextBooking } : student.metrics || {};
              const subjects = legacy ? (student.subjects || []) : (student.academic?.subjects || []);
              const name = legacy ? student.studentName : student.displayName;
              const responsible = legacy ? student.responsibleSummary : profileResponsibleSummary(student);
              const activity = legacy ? (student.nextBooking ? "active" : "inactive") : activityFor(student);
              const studentKey = legacy ? student.key : student.id;
              return (
                <article key={legacy ? student.key : student.id} className="student-card">
                  <div className="student-card-top">
                    <div className="student-card-name-group"><div className={`student-activity-dot ${activity}`} role="img" aria-label={`Actividad: ${ACTIVITY_LABELS[activity]}`} />
                      <div><strong>{name}</strong><span>{responsible}</span></div></div>
                    <span className="student-metric">{metrics.bookingsCount || 0} turno{metrics.bookingsCount !== 1 ? "s" : ""}</span>
                  </div>
                  {legacy && <span className="student-profile-badge pending">Perfil pendiente de migración</span>}
                  {!legacy && <span className="student-profile-badge verified">Perfil verificado</span>}
                  {subjects.length > 0 && <div className="student-subject-pills">{subjects.slice(0, 3).map((subject) => <span key={subject} className="student-subject-pill">{subject}</span>)}</div>}
                  <div className="student-session-row">
                    <div><FaCalendarAlt aria-hidden="true" /><span>{metrics.lastBookingAt ? `Última: ${formatShortDate(new Date(metrics.lastBookingAt))}` : "Sin sesiones"}</span></div>
                    <div><FaCalendarAlt aria-hidden="true" /><span>{metrics.nextBookingAt ? `Próxima: ${formatShortDate(new Date(metrics.nextBookingAt))} ${formatTime(new Date(metrics.nextBookingAt))}` : "Sin próximo turno"}</span></div>
                  </div>
                  <div className="student-card-footer"><span className={`student-activity-label ${activity}`}>{ACTIVITY_LABELS[activity]}</span>
                    <button type="button" className="inline-link-btn" data-student-trigger={studentKey} onClick={() => openStudent(student)}><FaUserGraduate aria-hidden="true" /> Ver perfil</button></div>
                </article>
              );
            })}
        </div>
      )}

      {mode === "api" && !loading && !error && pagination.totalPages > 1 && (
        <nav className="pagination-bar" aria-label="Paginación de alumnos">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
          <span aria-live="polite">Página {pagination.page} de {pagination.totalPages}</span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
        </nav>
      )}
    </section>
  );
};

export default StudentsView;
