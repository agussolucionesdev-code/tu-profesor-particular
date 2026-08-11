import { Link } from "react-router-dom";
import {
  FaArrowUpRightFromSquare,
  FaEnvelope,
  FaLocationDot,
  FaWhatsapp,
} from "react-icons/fa6";
import {
  BOOKING_MANAGE_URL,
  BOOKING_RESERVE_URL,
  BRAND,
  CONTACT,
  waLink,
} from "../data/site.js";
import monogram from "../assets/monogram.png";
import "./SiteFooter.css";

const SiteFooter = () => (
  <footer className="sfoot">
    <span className="grid-texture" aria-hidden="true" />

    <div className="shell sfoot-inner">
      <div className="sfoot-brand">
        <img
          src={monogram}
          alt=""
          className="sfoot-mark"
          aria-hidden="true"
          width="44"
          height="44"
          loading="lazy"
        />
        <p className="sfoot-tagline display display--md">
          <span>Juntos,</span> despejando el camino a <em>la meta.</em>
        </p>
        <p className="sfoot-person">
          {BRAND.person} · {BRAND.name}
        </p>
      </div>

      <nav className="sfoot-col" aria-label="Secciones del sitio">
        <h2 className="sfoot-title">El sitio</h2>
        <ul>
          <li><Link to="/">Inicio</Link></li>
          <li><Link to="/sobre-mi">Sobre mí</Link></li>
          <li><Link to="/materias">Materias y niveles</Link></li>
          <li><Link to="/como-trabajo">Cómo trabajo</Link></li>
          <li><Link to="/contacto">Contacto</Link></li>
          {/* En el footer y no en la navegación principal: es donde la gente ya
              la busca, y no compite con las páginas que traen alumnos. */}
          <li><Link to="/privacidad">Privacidad y datos</Link></li>
        </ul>
      </nav>

      <div className="sfoot-col">
        <h2 className="sfoot-title">Tus turnos</h2>
        <ul>
          <li>
            <a href={BOOKING_RESERVE_URL} target="_blank" rel="noopener noreferrer">
              Reservar una clase <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
          </li>
          <li>
            <a href={BOOKING_MANAGE_URL} target="_blank" rel="noopener noreferrer">
              Ver o gestionar mis turnos{" "}
              <FaArrowUpRightFromSquare aria-hidden="true" />
            </a>
          </li>
        </ul>
      </div>

      <div className="sfoot-col">
        <h2 className="sfoot-title">Hablemos</h2>
        <ul className="sfoot-contact">
          <li>
            <a
              href={waLink(
                "Hola Agustín, vengo desde tu sitio web y quiero hacerte una consulta.",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              {CONTACT.whatsappDisplay}
            </a>
          </li>
          <li>
            <a href={`mailto:${CONTACT.email}`}>
              <FaEnvelope aria-hidden="true" />
              {CONTACT.email}
            </a>
          </li>
          <li>
            <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
              <FaLocationDot aria-hidden="true" />
              {CONTACT.addressLine}
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div className="shell sfoot-base">
      <p>
        © {new Date().getFullYear()} {BRAND.person}. Todos los derechos
        reservados.
      </p>
      <p className="sfoot-base-note">
        Clases online y presenciales · {CONTACT.region}
      </p>
    </div>
  </footer>
);

export default SiteFooter;
