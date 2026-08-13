import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowUp,
  FaCalendarAlt,
  FaEnvelope,
  FaInstagram,
  FaLinkedinIn,
  FaMapMarkerAlt,
  FaUserCog,
  FaUserLock,
  FaWhatsapp,
} from "react-icons/fa";
import ThemeLogo from "../components/ui/ThemeLogo";
import { FALLBACK_TEACHER_LOCATION } from "../constants/teacherLocation";
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_DOMAIN,
  CONTACT_EMAIL_USER,
  SOCIAL_PROFILES,
  WHATSAPP_DEFAULT_MESSAGE,
  WHATSAPP_DISPLAY,
  waLink,
} from "../constants/contactChannels";
import "./Footer.css";

/* El pie de página de una HERRAMIENTA, no de un sitio de marketing.
 *
 * La versión anterior medía 1434px de alto en un teléfono de 375px. El contenido de
 * /portal mide 961px y el de /reservar 1252px: el pie era más grande que la página en
 * las dos rutas que la gente realmente usa. Traía una cinta con el eslogan, un CTA
 * para reservar, un párrafo de filosofía, tres etiquetas de valor, tres columnas y un
 * panel inferior — todo repitiendo lo que la página de arriba ya dijo mejor.
 *
 * Y arrastraba dos problemas concretos: tres tarjetas de contacto que se salían 8px
 * del viewport (WhatsApp, email y ubicación quedaban cortadas a la derecha), y 554
 * líneas de CSS para hacer lo que `web/src/components/SiteFooter.css` hace en 99.
 *
 * Un footer se lee cuando alguien busca ALGO PUNTUAL: cómo contactarte, adónde
 * volver, si sos real. Eso es lo que quedó. Nada más.
 *
 * Se quitó también el envoltorio `Reveal`: animar la aparición del pie no aporta nada
 * —nadie llega ahí buscando un efecto— y depende de un IntersectionObserver que, si
 * no dispara, deja todo en `opacity: 0`.
 */

const RUTAS = [
  { to: "/reservar", label: "Reservar un turno", icon: FaCalendarAlt },
  { to: "/portal", label: "Ver mis turnos", icon: FaUserLock },
  { to: "/admin", label: "Panel del profesor", icon: FaUserCog },
];

const ICONO_SOCIAL = {
  instagram: FaInstagram,
  linkedin: FaLinkedinIn,
};

const Footer = () => {
  const anio = new Date().getFullYear();
  const [mostrarSubir, setMostrarSubir] = useState(false);

  useEffect(() => {
    const alScrollear = () => setMostrarSubir(window.scrollY > 400);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  return (
    <>
      <footer className="tpp-footer">
        <div className="tpp-footer-inner">
          <div className="tpp-footer-brand">
            {/* El tamaño se contiene desde el CSS del pie con especificidad de dos
                clases, no con una clase en la imagen: `.theme-logo__image` declara
                `width: auto` y le gana a una clase sola. Es la misma trampa que
                documenta BrandLoader.css, y acá dejaba el monograma de 1254px
                ocupando 267px de ancho. */}
            <ThemeLogo variant="monogram" alt="Tu Profesor Particular" />
            <p className="tpp-footer-person">
              <strong>Agustín Elías Sosa</strong>
              <span>Clases particulares · Temperley, Buenos Aires</span>
            </p>
          </div>

          <nav className="tpp-footer-col" aria-label="Secciones del sistema de turnos">
            <h2 className="tpp-footer-title">Tus turnos</h2>
            <ul>
              {RUTAS.map((ruta) => {
                /* El icono se saca a una const en mayúscula en lugar de
                   desestructurarlo en los parámetros: ESLint no reconoce el uso de un
                   componente en JSX cuando llega como argumento, y lo reportaba como
                   variable sin usar. */
                const Icono = ruta.icon;
                return (
                  <li key={ruta.to}>
                    <Link to={ruta.to}>
                      <Icono aria-hidden="true" />
                      {ruta.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="tpp-footer-col">
            <h2 className="tpp-footer-title">Hablemos</h2>
            <ul>
              {/* WhatsApp primero y con el número a la vista: es el canal principal
                  del negocio, y antes estaba al mismo nivel visual que el resto. */}
              <li>
                <a
                  href={waLink(WHATSAPP_DEFAULT_MESSAGE)}
                  target="_blank"
                  rel="noreferrer"
                  className="tpp-footer-wa"
                >
                  <FaWhatsapp aria-hidden="true" />
                  {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`}>
                  <FaEnvelope aria-hidden="true" />
                  {/* `<wbr>` marca la arroba como el único punto de corte: si el email
                      no entra en la columna, se parte ahí y no en cualquier letra. No
                      aporta caracteres, así que copiar y pegar sigue dando la dirección
                      completa. */}
                  <span>
                    {CONTACT_EMAIL_USER}@<wbr />
                    {CONTACT_EMAIL_DOMAIN}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={FALLBACK_TEACHER_LOCATION.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <FaMapMarkerAlt aria-hidden="true" />
                  {FALLBACK_TEACHER_LOCATION.address}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="tpp-footer-base">
          <p>© {anio} Agustín Elías Sosa. Todos los derechos reservados.</p>

          {SOCIAL_PROFILES.length > 0 && (
            <ul className="tpp-footer-social" aria-label="Redes sociales">
              {SOCIAL_PROFILES.map(({ id, label, href }) => {
                const Icono = ICONO_SOCIAL[id];
                if (!Icono) return null;
                return (
                  <li key={id}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                    >
                      <Icono aria-hidden="true" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </footer>

      <button
        type="button"
        className={`btn-up-floating${mostrarSubir ? " visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Volver al inicio de la página"
      >
        <FaArrowUp aria-hidden="true" />
      </button>
    </>
  );
};

export default Footer;
