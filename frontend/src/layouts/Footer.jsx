import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowUp,
  FaCalendarAlt,
  FaEnvelope,
  FaExternalLinkAlt,
  FaMapMarkerAlt,
  FaUserLock,
  FaWhatsapp,
} from "react-icons/fa";
import { SiFacebook, SiInstagram, SiLinkedin } from "react-icons/si";
import ThemeLogo from "../components/ui/ThemeLogo";
import { FALLBACK_TEACHER_LOCATION } from "../constants/teacherLocation";
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_DOMAIN,
  CONTACT_EMAIL_USER,
  SOCIAL_PROFILES,
  SOCIAL_PROFILES_PROXIMOS,
  WHATSAPP_DEFAULT_MESSAGE,
  WHATSAPP_DISPLAY,
  waLink,
} from "../constants/contactChannels";
import "./Footer.css";

/* EL PIE DE PÁGINA, REESCRITO.
 *
 * Es el pie de una herramienta de reservas: se lee cuando alguien busca algo
 * puntual (cómo contactar, adónde volver, si hay alguien real detrás). Cuatro
 * bloques y nada más: la marca, los turnos, el contacto y las redes.
 *
 * Lo que se sacó a propósito: el enlace al panel del profesor. El panel es
 * privado; anunciarlo en cada página no le sirve a ningún alumno y le muestra a
 * cualquiera dónde está la puerta de entrada. Sigue existiendo en /admin, sin
 * enlaces que lleven ahí.
 *
 * Las redes usan los logos OFICIALES de cada marca (Simple Icons, que reproduce
 * las marcas registradas tal cual) sobre su color oficial: el cuadrado con el
 * degradado de Instagram, el círculo azul de Facebook y el cuadrado azul de
 * LinkedIn. Un ícono genérico de otra librería no es el logo de la marca.
 *
 * El pie es navy en los dos temas, por eso el monograma declara su superficie
 * (brandAssetsContract.test.js). */

const RUTAS = [
  { to: "/reservar", label: "Reservar un turno", icon: FaCalendarAlt },
  { to: "/portal", label: "Ver mis turnos", icon: FaUserLock },
];

const LOGO_SOCIAL = {
  instagram: SiInstagram,
  facebook: SiFacebook,
  linkedin: SiLinkedin,
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
            <div className="tpp-footer-lockup">
              <ThemeLogo variant="monogram" surface="dark" alt="Tu Profesor Particular" />
              <p className="tpp-footer-name">
                Tu Profesor <em>Particular</em>
              </p>
            </div>
            <p className="tpp-footer-about">
              Clases particulares con Agustín Elías Sosa. Online para toda Argentina y
              presencial en Temperley.
            </p>
            <a
              className="tpp-footer-site"
              href="https://tuprofesorparticular.com.ar"
              target="_blank"
              rel="noreferrer"
            >
              tuprofesorparticular.com.ar
              <FaExternalLinkAlt aria-hidden="true" />
            </a>
          </div>

          <nav className="tpp-footer-col" aria-label="Turnos">
            <h2 className="tpp-footer-title">Turnos</h2>
            <ul>
              {RUTAS.map((ruta) => {
                /* El ícono se saca a una const en mayúscula: ESLint no reconoce el
                   uso de un componente que llega desestructurado. */
                const Icono = ruta.icon;
                return (
                  <li key={ruta.to}>
                    <Link to={ruta.to} className="tpp-footer-link">
                      <Icono aria-hidden="true" />
                      {ruta.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="tpp-footer-col">
            <h2 className="tpp-footer-title">Contacto</h2>
            <ul>
              {/* WhatsApp primero y con el número a la vista: es el canal principal. */}
              <li>
                <a
                  href={waLink(WHATSAPP_DEFAULT_MESSAGE)}
                  target="_blank"
                  rel="noreferrer"
                  className="tpp-footer-link tpp-footer-link--wa"
                >
                  <FaWhatsapp aria-hidden="true" />
                  {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="tpp-footer-link">
                  <FaEnvelope aria-hidden="true" />
                  {/* `<wbr>` deja la arroba como único punto de corte: si el email
                      no entra, se parte ahí y no en cualquier letra. */}
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
                  className="tpp-footer-link"
                >
                  <FaMapMarkerAlt aria-hidden="true" />
                  {FALLBACK_TEACHER_LOCATION.address}
                </a>
              </li>
            </ul>
          </div>

          {SOCIAL_PROFILES.length + SOCIAL_PROFILES_PROXIMOS.length > 0 && (
            <div className="tpp-footer-col">
              <h2 className="tpp-footer-title">Redes</h2>
              <ul className="tpp-footer-social">
                {SOCIAL_PROFILES.map(({ id, label, detalle, href }) => {
                  const Logo = LOGO_SOCIAL[id];
                  if (!Logo) return null;
                  return (
                    <li key={id}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className={`tpp-footer-red tpp-footer-red--${id}`}
                      >
                        <span className="tpp-footer-red-logo" aria-hidden="true">
                          <Logo />
                        </span>
                        <span className="tpp-footer-red-texto">
                          <strong>{label}</strong>
                          {detalle && <span>{detalle}</span>}
                        </span>
                        {/* El nombre sale del texto visible (WCAG 2.5.3); sólo
                            se suma, oculto, que se abre aparte. */}
                        <span className="sr-only">(se abre en una pestaña nueva)</span>
                      </a>
                    </li>
                  );
                })}
                {/* Las que todavía no existen: logo oficial y «Próximamente», sin
                    enlace. Ver SOCIAL_PROFILES_PROXIMOS en contactChannels.js. */}
                {SOCIAL_PROFILES_PROXIMOS.map(({ id, label }) => {
                  const Logo = LOGO_SOCIAL[id];
                  if (!Logo) return null;
                  return (
                    <li key={id}>
                      <span className={`tpp-footer-red tpp-footer-red--${id} is-proximo`}>
                        <span className="tpp-footer-red-logo" aria-hidden="true">
                          <Logo />
                        </span>
                        <span className="tpp-footer-red-texto">
                          <strong>{label}</strong>
                          <span>Próximamente</span>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="tpp-footer-base">
          <p>© {anio} Agustín Elías Sosa · Tu Profesor Particular</p>
          <p>Temperley, Buenos Aires · Argentina</p>
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
