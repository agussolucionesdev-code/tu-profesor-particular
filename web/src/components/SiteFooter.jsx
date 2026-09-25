import { Link } from "react-router-dom";
import {
  FaArrowUpRightFromSquare,
  FaEnvelope,
  FaInstagram,
  FaLinkedinIn,
  FaLocationDot,
  FaWhatsapp,
} from "react-icons/fa6";
import {
  BOOKING_MANAGE_URL,
  BRAND,
  CONTACT,
  SOCIAL,
  enlaceDeReserva,
  waLink,
} from "../data/site.js";
import "./SiteFooter.css";

/* Se corta en la PRIMERA arroba: es la que separa usuario de dominio, y un email con
   dos arrobas no es válido. Si algún día el dato viniera vacío, `split` devuelve
   ["" ] y el enlace muestra sólo la arroba en lugar de romper el render. */
const [emailAntesDeArroba, emailDespuesDeArroba = ""] = CONTACT.email.split("@");

const SiteFooter = () => (
  <footer className="sfoot">
    <span className="grid-texture" aria-hidden="true" />

    <div className="shell sfoot-inner">
      <div className="sfoot-brand">
        <img
          /* La imagen se nombra por su ruta de `public/` y NO se importa: `prerender.mjs`
             compila con esbuild declarando `".png": "dataurl"`, así que un import la
             convierte en base64 y la deja empotrada en el HTML de CADA página. Este
             monograma llegó a aparecer trece veces en cinco páginas. Lo cuida
             `tests/imagenesServidas.test.js`. */
          src={"/marca-oscuro.webp"}
          alt=""
          className="sfoot-mark"
          aria-hidden="true"
          width="192"
          height="192"
          loading="lazy"
        />
        <p className="sfoot-tagline display display--md">
          <span>Juntos,</span> despejando el camino a <em>la meta.</em>
        </p>
        <p className="sfoot-person">
          {BRAND.person} · {BRAND.name}
        </p>
      </div>

      {/* --links marca la única lista larga del pie: en teléfonos va en dos columnas
          para que los seis enlaces quepan con 44px de alto cada uno. */}
      <nav className="sfoot-col sfoot-col--links" aria-label="Secciones del sitio">
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
            <a href={enlaceDeReserva("pie")} target="_blank" rel="noopener noreferrer">
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
              {/* El email se parte en la arroba y en ningún otro lado.
                  Es la cadena más larga del pie y no tiene espacios: si el navegador
                  necesita cortarla, `<wbr>` le dice DÓNDE. Sin esto partía en cualquier
                  letra ("agustinsosa.profe@gm / ail.com"), que se lee como un error de
                  tipeo y no como una dirección.
                  El texto sigue siendo uno: `<wbr>` no aporta caracteres, así que copiar
                  y pegar, y los lectores de pantalla, funcionan igual. */}
              <span>
                {emailAntesDeArroba}@<wbr />
                {emailDespuesDeArroba}
              </span>
            </a>
          </li>
          <li>
            <a href={CONTACT.mapsUrl} target="_blank" rel="noopener noreferrer">
              <FaLocationDot aria-hidden="true" />
              {CONTACT.addressLine}
            </a>
          </li>
          {/* Las redes de la marca, las mismas del pie de turnos y del JSON-LD
              (`sameAs`): Google cruza los tres para reconocer a la marca. */}
          <li>
            <a href={SOCIAL.instagram} target="_blank" rel="noopener noreferrer">
              <FaInstagram aria-hidden="true" />
              Instagram @tuprofesor.ar
            </a>
          </li>
          <li>
            <a href={SOCIAL.linkedin} target="_blank" rel="noopener noreferrer">
              <FaLinkedinIn aria-hidden="true" />
              LinkedIn
            </a>
          </li>
        </ul>
      </div>
    </div>

    <div className="shell sfoot-base">
      {/* El año sale del prerender (el del último deploy): si el navegador ya
          está en el año siguiente, la hidratación no lo marca como error. */}
      <p suppressHydrationWarning>
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
