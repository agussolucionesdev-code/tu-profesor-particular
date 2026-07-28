import {
  FaArrowUpRightFromSquare,
  FaEnvelope,
  FaLocationDot,
  FaWhatsapp,
} from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BOOKING_URL, CONTACT, waLink } from "../data/site.js";
import "./Inner.css";

const Contact = () => {
  usePageMeta(
    "Contacto · Tu Profesor Particular",
    `Escribime por WhatsApp al ${CONTACT.whatsappDisplay} o por email. Clases presenciales en ${CONTACT.addressLine} y online.`,
  );

  return (
    <section className="section pagehead" aria-labelledby="contact-title">
      <div className="shell">
        <SectionHead
          index="01"
          kicker="Hablemos"
          title="Contacto"
          titleId="contact-title"
          lead="Si querés reservar, el sistema de turnos es el camino más rápido. Y si tenés una duda antes, escribime por donde te resulte más cómodo."
        />

        <div className="contact-grid" data-reveal-group="80">
          {/* La reserva es la acción principal: va primera y destacada. */}
          <a
            className="contact-card contact-card--primary"
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-reveal="up"
          >
            <span className="contact-kicker">Lo más rápido</span>
            <h3 className="display display--md">Reservar un turno</h3>
            <p>
              Elegís materia, modalidad y horario en menos de un minuto. Sin
              registro y sin pagos por adelantado.
            </p>
            <span className="contact-action">
              Ir al sistema de turnos
              <FaArrowUpRightFromSquare aria-hidden="true" />
            </span>
          </a>

          <a
            className="contact-card"
            href={waLink(
              "Hola Agustín, vengo desde tu sitio web y quiero hacerte una consulta.",
            )}
            target="_blank"
            rel="noopener noreferrer"
            data-reveal="up"
          >
            <span className="contact-icon" aria-hidden="true">
              <FaWhatsapp />
            </span>
            <h3>WhatsApp</h3>
            <p>{CONTACT.whatsappDisplay}</p>
            <span className="contact-action">Escribir por WhatsApp</span>
          </a>

          <a
            className="contact-card"
            href={`mailto:${CONTACT.email}`}
            data-reveal="up"
          >
            <span className="contact-icon" aria-hidden="true">
              <FaEnvelope />
            </span>
            <h3>Email</h3>
            <p>{CONTACT.email}</p>
            <span className="contact-action">Enviar un email</span>
          </a>

          <a
            className="contact-card"
            href={CONTACT.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-reveal="up"
          >
            <span className="contact-icon" aria-hidden="true">
              <FaLocationDot />
            </span>
            <h3>Clases presenciales</h3>
            <p>
              {CONTACT.addressLine}
              <br />
              {CONTACT.region}
            </p>
            <span className="contact-action">Ver en el mapa</span>
          </a>
        </div>
      </div>
    </section>
  );
};

export default Contact;
