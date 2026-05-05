import { useEffect, useRef } from "react";
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaCopy,
  FaEnvelope,
  FaExclamationCircle,
  FaIdCard,
  FaInfoCircle,
  FaPhoneAlt,
  FaSearch,
  FaUserGraduate,
  FaUserTie,
  FaWhatsapp,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import logoIcon from "../../assets/images/logo-icon-sin-fondo.png";

const getDeliveryAlert = (successData) => {
  const emailRecipient = successData?.notifications?.client?.recipient;
  const emailSent = successData?.notifications?.client?.sent;

  if (emailRecipient && emailSent) {
    return {
      type: "success",
      icon: <FaEnvelope aria-hidden="true" />,
      title: "Comprobante enviado",
      body: `También enviamos el detalle a ${emailRecipient}.`,
    };
  }

  if (successData?.email) {
    return {
      type: "warning",
      icon: <FaExclamationCircle aria-hidden="true" />,
      title: "Guardá el código por las dudas",
      body:
        "La reserva quedó confirmada. Si el correo tarda un poco, podés volver a encontrar el turno desde Mis Turnos con tu código, email o número de teléfono.",
    };
  }

  return {
    type: "info",
    icon: <FaInfoCircle aria-hidden="true" />,
    title: "Gestión sin email",
    body:
      "No cargaste email, así que el código de gestión pasa a ser tu referencia principal para volver a entrar desde Mis Turnos.",
  };
};

const BookingSuccessModal = ({
  show,
  successData,
  whatsappConfirmText,
  onCopyCode,
  onClose,
}) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (show) dialogRef.current?.focus();
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  const deliveryAlert = getDeliveryAlert(successData);
  const managementMethods = successData?.managementMethods || [];
  const nextSteps = [
    {
      step: "1",
      title: "Guardá el código",
      body: "Es la forma más directa de entrar después desde Mis Turnos.",
    },
    {
      step: "2",
      title: "Volvé cuando quieras",
      body: "Si te queda más cómodo, también sirven el email o el número de teléfono cargados.",
    },
    {
      step: "3",
      title: "Gestioná sin vueltas",
      body: "Desde el portal podés revisar, reprogramar o cancelar la reserva.",
    },
  ];

  return (
    <div className="neuro-modal-overlay">
      <div
        ref={dialogRef}
        className="neuro-modal-card success-modal-card success-modal-card-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        tabIndex={-1}
      >
        <div className="modal-top-accent"></div>

        <div className="success-modal-shell">
          <div className="success-main-column">
            <div className="success-hero-band">
              <div className="success-hero-topline">
                <div className="success-hero-badge">
                  <div className="success-check-animation" aria-hidden="true">
                    <FaCheckCircle />
                  </div>
                  <span className="success-eyebrow">Reserva confirmada</span>
                </div>

                <div className="success-brand-lockup">
                  <img src={logoIcon} alt="" aria-hidden="true" />
                  <div>
                    <strong>Tu Profesor Particular</strong>
                    <span>Agustín Elías Sosa</span>
                  </div>
                </div>
              </div>

              <h2 id="booking-success-title">Tu turno ya quedó listo</h2>
              <p>
                Guardá el código una vez y luego gestioná todo desde Mis
                Turnos con una experiencia más simple, clara y agradable.
              </p>

              <div className="success-hero-inline-facts" aria-hidden="true">
                <span>
                  <FaCalendarAlt aria-hidden="true" /> {successData?.day}
                </span>
                <span>
                  <FaClock aria-hidden="true" /> {successData?.startTime} a {successData?.endTime} hs
                </span>
                <span>
                  <FaInfoCircle aria-hidden="true" />{" "}
                  {successData?.durationLabel ||
                    `${successData?.actualDuration || "--"} hs`}
                </span>
              </div>
            </div>

            <div className="modal-body success-modal-body">
              <section className="success-code-panel success-code-panel-prominent">
                <div className="success-code-copy">
                  <span className="success-code-kicker">Código de gestión</span>
                  <h3>{successData?.bookingCode}</h3>
                  <p>
                    Guardalo tal cual aparece. En <strong>Mis Turnos</strong>{" "}
                    podés usar este código para revisar, reprogramar o
                    cancelar la reserva sin fricción.
                  </p>
                </div>

                <div className="success-code-actions">
                  <button
                    type="button"
                    className="btn-copy-code prominent"
                    onClick={onCopyCode}
                  >
                    <FaCopy aria-hidden="true" /> Copiar código
                  </button>
                  <p className="success-code-helper">
                    También queda asociado a tus otros datos de acceso para que
                    siempre tengas una forma cómoda de volver.
                  </p>
                </div>
              </section>

              <section className="success-summary-grid success-summary-grid-wide">
                <article className="success-summary-card summary-card-spotlight">
                  <span><FaCalendarAlt aria-hidden="true" /> Día</span>
                  <strong>{successData?.day}</strong>
                </article>

                <article className="success-summary-card summary-card-spotlight">
                  <span><FaClock aria-hidden="true" /> Horario</span>
                  <strong>
                    {successData?.startTime} a {successData?.endTime} hs
                  </strong>
                </article>

                <article className="success-summary-card summary-card-spotlight">
                  <span><FaInfoCircle aria-hidden="true" /> Duración</span>
                  <strong>
                    {successData?.durationLabel ||
                      `${successData?.actualDuration || "--"} hs`}
                  </strong>
                </article>

                <article className="success-summary-card">
                  <span><FaUserGraduate aria-hidden="true" /> Alumno</span>
                  <strong>{successData?.cleanStudentName}</strong>
                </article>

                <article className="success-summary-card">
                  <span><FaUserTie aria-hidden="true" /> Responsable</span>
                  <strong>{successData?.responsibleLabel}</strong>
                </article>

                <article className="success-summary-card">
                  <span><FaIdCard aria-hidden="true" /> Parentesco</span>
                  <strong>{successData?.responsibleRelationshipLabel}</strong>
                </article>

                <article className="success-summary-card">
                  <span><FaInfoCircle aria-hidden="true" /> Materia</span>
                  <strong>{successData?.subject}</strong>
                </article>

                <article className="success-summary-card">
                  <span><FaInfoCircle aria-hidden="true" /> Nivel</span>
                  <strong>{successData?.educationLevel}</strong>
                </article>

                <article className="success-summary-card">
                  <span><FaInfoCircle aria-hidden="true" /> Institución</span>
                  <strong>{successData?.school}</strong>
                </article>
              </section>
            </div>
          </div>

          <aside className="success-side-column">
            <section className="success-next-steps-card">
              <div className="success-management-head">
                <FaCheckCircle aria-hidden="true" />
                <div>
                  <strong>Cómo seguir desde aquí</strong>
                  <p>
                    Todo quedó ordenado para que vuelvas después sin perderte.
                  </p>
                </div>
              </div>

              <div className="success-step-list">
                {nextSteps.map((item) => (
                  <article key={item.step} className="success-step-item">
                    <span className="success-step-badge">{item.step}</span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="success-management-card">
              <div className="success-management-head">
                <FaSearch aria-hidden="true" />
                <div>
                  <strong>Cómo volver a encontrar este turno</strong>
                  <p>
                    En la sección <strong>Mis Turnos</strong> podés buscar con
                    cualquiera de estos datos y gestionar la reserva en pocos
                    pasos.
                  </p>
                </div>
              </div>

              <div className="success-management-grid">
                {managementMethods.map((method) => (
                  <article
                    key={method.label}
                    className="success-management-pill"
                  >
                    <span>{method.label}</span>
                    <strong>{method.value}</strong>
                    <small>{method.helper}</small>
                  </article>
                ))}
              </div>
            </section>

            <div className={`delivery-alert ${deliveryAlert.type}`}>
              <div className="delivery-alert-icon">{deliveryAlert.icon}</div>
              <div>
                <strong>{deliveryAlert.title}</strong>
                <span>{deliveryAlert.body}</span>
              </div>
            </div>

            <div className="delivery-alert info subdued">
              <div className="delivery-alert-icon" aria-hidden="true">
                <FaPhoneAlt />
              </div>
              <div>
                <strong>Dónde usar el código</strong>
                <span>
                  Andá a <strong>Mis Turnos</strong> cuando quieras gestionar la
                  reserva. Si no tenés el código a mano, también sirven el
                  email o el número de teléfono cargados.
                </span>
              </div>
            </div>
          </aside>
        </div>

        <div className="modal-actions success-modal-actions">
          <Link to="/portal" className="btn-portal-primary">
            <FaSearch aria-hidden="true" /> Ir a Mis Turnos
          </Link>

          <div className="success-secondary-actions">
            <a
              href={`https://wa.me/5491164236675?text=${encodeURIComponent(whatsappConfirmText)}`}
              className="btn-ws-secondary"
              target="_blank"
              rel="noreferrer"
            >
              <FaWhatsapp aria-hidden="true" /> Enviar comprobante
            </a>
            <button type="button" onClick={onClose} className="btn-close-text">
              Cerrar y volver
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccessModal;
