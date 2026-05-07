import {
  FaBookOpen,
  FaIdCard,
  FaLayerGroup,
  FaSchool,
  FaUserGraduate,
  FaUserTie,
} from "react-icons/fa";

const BookingConfirmationSummary = ({
  durationLabel,
  studentName,
  responsibleName,
  responsibleRelationshipLabel,
  isAdult,
  educationLevel,
  subject,
  school,
}) => {
  const detailCards = [
    {
      icon: <FaUserGraduate aria-hidden="true" />,
      label: "Alumno",
      value: studentName || "Sin completar",
    },
    {
      icon: <FaUserTie aria-hidden="true" />,
      label: "Responsable",
      value: isAdult
        ? "Alumno mayor de edad"
        : responsibleName || "Adulto responsable",
    },
    {
      icon: <FaIdCard aria-hidden="true" />,
      label: "Parentesco",
      value: responsibleRelationshipLabel || "Sin completar",
    },
    {
      icon: <FaLayerGroup aria-hidden="true" />,
      label: "Nivel",
      value: educationLevel || "Sin completar",
    },
    {
      icon: <FaSchool aria-hidden="true" />,
      label: "Institución",
      value: school || "Sin completar",
    },
    {
      icon: <FaBookOpen aria-hidden="true" />,
      label: "Materia",
      value: subject || "Sin completar",
    },
  ];

  return (
    <div className="confirm-summary-card">
      <div className="confirm-summary-header">
        <h4>Resumen final</h4>
        {durationLabel && (
          <span className="confirm-summary-badge">{durationLabel}</span>
        )}
      </div>

      <div className="confirm-detail-grid">
        {detailCards.map((card) => (
          <div key={card.label} className="confirm-detail-item">
            <span>
              {card.icon} {card.label}
            </span>
            <strong>{card.value}</strong>
          </div>
        ))}
      </div>

      <p className="confirm-lookup-hint">
        Al confirmar recibirás un código para gestionar tu turno desde Mis
        Turnos.
      </p>
    </div>
  );
};

export default BookingConfirmationSummary;
