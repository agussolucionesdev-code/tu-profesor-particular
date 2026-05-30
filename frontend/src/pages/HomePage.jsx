import { Link } from "react-router-dom";
import {
  FaCalculator,
  FaCalendarCheck,
  FaFlask,
  FaGraduationCap,
  FaLaptopCode,
  FaWhatsapp,
} from "react-icons/fa";
import { usePageMeta } from "../hooks/useDocumentTitle";
import ThemeLogo from "../components/ui/ThemeLogo";
import "./HomePage.css";

const SUBJECTS = [
  { icon: <FaCalculator aria-hidden="true" />, label: "Matemática" },
  { icon: <FaFlask aria-hidden="true" />, label: "Física" },
  { icon: <FaLaptopCode aria-hidden="true" />, label: "Química" },
  { icon: <FaGraduationCap aria-hidden="true" />, label: "Álgebra" },
  { icon: <FaCalculator aria-hidden="true" />, label: "Estadística" },
  { icon: <FaLaptopCode aria-hidden="true" />, label: "Programación" },
];

const LEVELS = ["Primaria", "Secundaria", "Terciario", "Universitario"];

const HomePage = () => {
  usePageMeta(
    "Agustín Sosa · Clases particulares de Matemática, Física y más",
    "Profesor particular de matemática, física, química y programación. Reservá tu turno online en minutos. Temperley, Buenos Aires.",
  );

  return (
    <div className="home-page">
      {/* ── Hero ── */}
      <section className="home-hero">
        <div className="home-hero-inner">
          <ThemeLogo variant="tagline" imgClassName="home-hero-logo" alt="Tu Profesor Particular" />
          <div className="home-hero-copy">
            <p className="home-hero-kicker">Clases particulares</p>
            <h1 className="home-hero-title">
              Agustín Sosa
            </h1>
            <p className="home-hero-subtitle">
              Matemática · Física · Química · Álgebra · Estadística · Programación
            </p>
            <p className="home-hero-desc">
              Profesor particular con experiencia en todos los niveles educativos.
              Clases personalizadas, a tu ritmo y en tu horario.
              Ubicado en Temperley, Buenos Aires.
            </p>
            <div className="home-hero-actions">
              <Link to="/reservar" className="home-cta-primary">
                <FaCalendarCheck aria-hidden="true" />
                Reservar turno
              </Link>
              <a
                href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
                className="home-cta-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Materias ── */}
      <section className="home-section">
        <div className="home-section-inner">
          <h2 className="home-section-title">Materias y áreas</h2>
          <p className="home-section-desc">
            Trabajo con alumnos de todos los niveles, desde primaria hasta la universidad.
          </p>
          <ul className="home-subjects-grid" role="list">
            {SUBJECTS.map((s) => (
              <li key={s.label} className="home-subject-card">
                <span className="home-subject-icon">{s.icon}</span>
                <span>{s.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Niveles ── */}
      <section className="home-section home-section--alt">
        <div className="home-section-inner">
          <h2 className="home-section-title">Niveles educativos</h2>
          <ul className="home-levels-list" role="list">
            {LEVELS.map((l) => (
              <li key={l} className="home-level-item">
                <FaGraduationCap aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Cómo funciona ── */}
      <section className="home-section">
        <div className="home-section-inner">
          <h2 className="home-section-title">¿Cómo funciona?</h2>
          <ol className="home-steps-list">
            <li className="home-step">
              <span className="home-step-num">1</span>
              <div>
                <strong>Elegí materia y horario</strong>
                <p>Seleccioná la materia, el nivel y el día que te queda mejor.</p>
              </div>
            </li>
            <li className="home-step">
              <span className="home-step-num">2</span>
              <div>
                <strong>Completá tus datos</strong>
                <p>Solo lo esencial: nombre, contacto y contexto académico.</p>
              </div>
            </li>
            <li className="home-step">
              <span className="home-step-num">3</span>
              <div>
                <strong>Confirmá y listo</strong>
                <p>Recibís tu código de reserva y nos vemos en el horario acordado.</p>
              </div>
            </li>
          </ol>
          <Link to="/reservar" className="home-cta-primary home-cta-centered">
            <FaCalendarCheck aria-hidden="true" />
            Reservar ahora
          </Link>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section className="home-section home-section--alt">
        <div className="home-section-inner home-contact">
          <h2 className="home-section-title">Contacto</h2>
          <p className="home-contact-location">
            📍 Jujuy 414, Temperley, Buenos Aires
          </p>
          <a
            href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
            className="home-cta-secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FaWhatsapp aria-hidden="true" />
            +54 9 11 6423-6675
          </a>
          <p className="home-contact-note">
            Escribinos por WhatsApp para consultas rápidas sobre disponibilidad, precios o materias.
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
