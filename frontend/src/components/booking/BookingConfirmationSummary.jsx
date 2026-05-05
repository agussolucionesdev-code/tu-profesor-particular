import {
  FaBookOpen,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaEnvelope,
  FaIdCard,
  FaLayerGroup,
  FaPhoneAlt,
  FaSchool,
  FaSearch,
  FaShieldAlt,
  FaTicketAlt,
  FaUserGraduate,
  FaUserTie,
} from "react-icons/fa";

const BookingConfirmationSummary = ({
  dateLabel,
  durationLabel,
  timeRangeLabel,
  studentName,
  responsibleName,
  responsibleRelationshipLabel,
  isAdult,
  educationLevel,
  subject,
  school,
  email,
  phone,
  lookupHint,
}) => {
  const managementMethods = [
    {
      icon: <FaSearch aria-hidden="true" />,
      label: "Código",
      value: "Se muestra al confirmar",
      helper: "Es la forma más rápida de volver a entrar desde Mis Turnos.",
    },
    ...(email
      ? [
          {
            icon: <FaEnvelope aria-hidden="true" />,
            label: "Email",
            value: email,
            helper: "También podrás buscar el turno con este correo.",
          },
        ]
      : []),
    ...(phone
      ? [
          {
            icon: <FaPhoneAlt aria-hidden="true" />,
            label: "Teléfono",
            value: phone,
            helper: "Usa el mismo número que cargas en la reserva.",
          },
        ]
      : []),
  ];

  const detailCards = [
    {
      icon: <FaUserGraduate aria-hidden="true" />,
      label: "Alumno",
      value: studentName || "Sin completar",
      full: false,
    },
    {
      icon: <FaUserTie aria-hidden="true" />,
      label: "Responsable",
      value: isAdult
        ? "Alumno mayor de edad"
        : responsibleName || "Adulto responsable",
      full: false,
    },
    {
      icon: <FaIdCard aria-hidden="true" />,
      label: "Parentesco",
      value: responsibleRelationshipLabel || "Sin completar",
      full: false,
    },
    {
      icon: <FaLayerGroup aria-hidden="true" />,
      label: "Nivel",
      value: educationLevel || "Sin completar",
      full: false,
    },
    {
      icon: <FaSchool aria-hidden="true" />,
      label: "Institución",
      value: school || "Sin completar",
      full: false,
    },
    {
      icon: <FaBookOpen aria-hidden="true" />,
      label: "Materia o tema",
      value: subject || "Sin completar",
      full: true,
    },
  ];

  const supportPills = [
    { icon: <FaCheckCircle aria-hidden="true" />, label: "Sin cruces de horario" },
    { icon: <FaShieldAlt aria-hidden="true" />, label: "Reprogramable después" },
    { icon: <FaTicketAlt aria-hidden="true" />, label: "Código listo para gestionar" },
  ];

  return (
    <div className="booking-summary-card booking-summary-card-expanded">
      <div className="summary-overview-head">
        <div>
          <span className="summary-kicker">Resumen final</span>
          <h4>{dateLabel || "Tu turno todavía necesita una fecha"}</h4>
        </div>
        <span className="summary-duration-badge">
          {durationLabel || "Duración pendiente"}
        </span>
      </div>

      <p className="summary-lead">
        Todo lo importante queda ordenado antes de confirmar, en una sola
        mirada y sin párrafos eternos.
      </p>

      <div className="summary-highlight-grid">
        <article className="summary-highlight-card summary-highlight-time">
          <span className="summary-highlight-icon" aria-hidden="true">
            <FaClock />
          </span>
          <div>
            <span>Horario reservado</span>
            <strong>{timeRangeLabel || "Selecciona un horario"}</strong>
            <p>Este bloque queda confirmado exactamente así.</p>
          </div>
        </article>

        <article className="summary-highlight-card summary-highlight-date">
          <span className="summary-highlight-icon" aria-hidden="true">
            <FaCalendarAlt />
          </span>
          <div>
            <span>Día elegido</span>
            <strong>{dateLabel || "Sin fecha todavía"}</strong>
            <p>Lo revisas ahora y luego lo gestionas desde Mis Turnos.</p>
          </div>
        </article>

        <article className="summary-highlight-card summary-highlight-access">
          <span className="summary-highlight-icon" aria-hidden="true">
            <FaTicketAlt />
          </span>
          <div>
            <span>Acceso posterior</span>
            <strong>Código visible al confirmar</strong>
            <p>También podrás entrar con email o número de teléfono si los cargaste.</p>
          </div>
        </article>
      </div>

      <div className="summary-section-heading">
        <span>Datos cargados</span>
        <p>Así se guardará la reserva cuando presiones confirmar.</p>
      </div>

      <div className="summary-detail-grid">
        {detailCards.map((card) => (
          <div
            key={card.label}
            className={`summary-detail-card ${card.full ? "full" : ""}`}
          >
            <span>
              {card.icon} {card.label}
            </span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <div className="summary-trust-strip">
        {supportPills.map((pill) => (
          <span key={pill.label} className="summary-trust-pill">
            {pill.icon}
            {pill.label}
          </span>
        ))}
      </div>

      <div className="summary-management-note summary-management-note-rich">
        <div className="summary-management-copy">
          <span className="summary-note-kicker">
            Cómo lo vuelves a encontrar después
          </span>
          <h5>Te dejamos varias puertas de entrada</h5>
          <p>
            {lookupHint ||
              "En Mis Turnos podrás usar el código de gestión, tu email o tu número de teléfono para revisar, reprogramar o cancelar el turno."}
          </p>
        </div>

        <div className="summary-management-grid">
          {managementMethods.map((method) => (
            <article key={method.label} className="summary-management-mini-card">
              <span className="summary-management-icon">{method.icon}</span>
              <strong>{method.label}</strong>
              <em>{method.value}</em>
              <small>{method.helper}</small>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationSummary;
