import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaCalculator,
  FaCalendarCheck,
  FaCheckCircle,
  FaClipboardCheck,
  FaClipboardList,
  FaExternalLinkAlt,
  FaFlask,
  FaGraduationCap,
  FaLaptopCode,
  FaMapMarkerAlt,
  FaMedal,
  FaRegClock,
  FaRegLightbulb,
  FaStar,
  FaUserCheck,
  FaUserGraduate,
  FaWhatsapp,
} from "react-icons/fa";
import { usePageMeta } from "../hooks/useDocumentTitle";
import ThemeLogo from "../components/ui/ThemeLogo";
import agustinPhoto from "../assets/images/agustin-sosa.jpg";
import "./HomePage.css";

/* ── datos ────────────────────────────────────────── */

const SUBJECTS = [
  { icon: FaCalculator, label: "Matemática",   desc: "Desde aritmética hasta cálculo avanzado" },
  { icon: FaFlask,      label: "Física",       desc: "Mecánica, electromagnetismo, óptica" },
  { icon: FaFlask,      label: "Química",      desc: "General, orgánica e inorgánica" },
  { icon: FaCalculator, label: "Álgebra",      desc: "Lineal, vectorial y abstracta" },
  { icon: FaCalculator, label: "Estadística",  desc: "Descriptiva, probabilidad, inferencia" },
  { icon: FaLaptopCode, label: "Programación", desc: "Lógica, Python, algoritmos y más" },
];

const LEVELS = [
  "Primaria",
  "Secundaria",
  "Secundaria Técnica",
  "Terciario / Superior",
  "Universitario",
];

const STATS = [
  { value: "+5",   label: "años enseñando",      icon: FaStar },
  { value: "6",    label: "materias cubiertas",   icon: FaGraduationCap },
  { value: "5",    label: "niveles educativos",   icon: FaMedal },
  { value: "100%", label: "personalizado",        icon: FaUserCheck },
];

const STEPS = [
  {
    num: "01",
    icon: FaUserGraduate,
    title: "Completá tu perfil",
    desc: "Nombre, nivel educativo, materia y contexto. Menos de 2 minutos desde cualquier dispositivo.",
    detail: "Sin registro. Sin contraseña.",
  },
  {
    num: "02",
    icon: FaRegClock,
    title: "Elegí día y horario",
    desc: "Calendario en tiempo real. Solo ves los turnos disponibles — nada que ya esté ocupado.",
    detail: "Horarios de lun. a sáb.",
  },
  {
    num: "03",
    icon: FaClipboardList,
    title: "Confirmá tu turno",
    desc: "Recibís un código único para gestionar, reprogramar o cancelar cuando necesites.",
    detail: "Comprobante por email (opcional).",
  },
  {
    num: "04",
    icon: FaClipboardCheck,
    title: "¡Nos vemos!",
    desc: "Llega con tus dudas. Si algo cambia antes de la clase, entrá al portal con tu código.",
    detail: "Jujuy 414, Temperley.",
  },
];

const BENEFITS = [
  {
    icon: FaRegLightbulb,
    title: "A tu medida, siempre",
    desc: "Cada clase se diseña desde donde estás, no desde donde deberías estar. Sin recetas genéricas.",
  },
  {
    icon: FaRegClock,
    title: "Horario real y flexible",
    desc: "Elegís el día y la hora que te queda bien. Podés reprogramar desde el portal sin llamar.",
  },
  {
    icon: FaMedal,
    title: "Seguimiento clase a clase",
    desc: "Registramos tu evolución. Sabemos exactamente en qué punto estás y hacia dónde vamos.",
  },
  {
    icon: FaGraduationCap,
    title: "Para cualquier nivel",
    desc: "Desde las primeras sumas hasta los finales universitarios más exigentes. Con el lenguaje correcto para cada etapa.",
  },
];

/* ── componente ───────────────────────────────────── */

const HomePage = () => {
  usePageMeta(
    "Agustín Sosa · Clases particulares de Matemática, Física y más — Temperley",
    "Profesor particular de matemática, física, química y programación. Reservá tu turno online en minutos. Temperley, Buenos Aires.",
  );

  return (
    <div className="hp">

      {/* ── Banner web principal ── */}
      <div className="hp-web-banner" role="banner">
        <span className="hp-web-banner-dot" aria-hidden="true" />
        <span>Mi web completa llegará pronto en</span>
        <a
          href="https://tuprofesorparticular.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="hp-web-banner-link"
        >
          tuprofesorparticular.com.ar
          <FaExternalLinkAlt aria-hidden="true" />
        </a>
      </div>

      {/* ════════════════════════════════════════
          HERO — split layout
      ════════════════════════════════════════ */}
      <section className="hp-hero" aria-label="Presentación">
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-hero-blob hp-hero-blob--1" />
          <span className="hp-hero-blob hp-hero-blob--2" />
          <span className="hp-hero-blob hp-hero-blob--3" />
          <span className="hp-hero-grid" />
        </div>

        <div className="hp-hero-inner">

          {/* columna izquierda — texto */}
          <div className="hp-hero-copy">
            <div className="hp-hero-logo-badge">
              <ThemeLogo variant="monogram" imgClassName="hp-hero-monogram" alt="Tu Profesor Particular" />
            </div>

            <p className="hp-hero-kicker">
              Profesor particular · Temperley, Buenos Aires
            </p>

            <h1 className="hp-hero-headline">
              Aprendé con quien<br />
              <span className="hp-hero-accent">realmente te acompaña</span>
            </h1>

            <p className="hp-hero-desc">
              Matemática, Física, Química, Álgebra, Estadística y Programación
              para todos los niveles. Clases personalizadas, a tu ritmo, con seguimiento real.
            </p>

            <div className="hp-hero-trust">
              {["Sin registro previo", "100% online", "Gratis reservar"].map((t) => (
                <span key={t} className="hp-trust-chip">
                  <FaCheckCircle aria-hidden="true" /> {t}
                </span>
              ))}
            </div>

            <div className="hp-hero-actions">
              <Link to="/reservar" className="hp-btn-primary hp-btn-xl">
                <FaCalendarCheck aria-hidden="true" />
                Reservar mi turno
                <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
              </Link>
              <a
                href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
                className="hp-btn-ghost hp-btn-xl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Escribir por WhatsApp
              </a>
            </div>
          </div>

          {/* columna derecha — foto */}
          <div className="hp-hero-photo-col">
            <div className="hp-photo-frame">
              {/* decoraciones detrás */}
              <span className="hp-photo-ring hp-photo-ring--1" aria-hidden="true" />
              <span className="hp-photo-ring hp-photo-ring--2" aria-hidden="true" />

              <img
                src={agustinPhoto}
                alt="Agustín Elías Sosa, profesor particular"
                className="hp-photo-img"
              />

              {/* floating badge — experiencia */}
              <div className="hp-photo-badge hp-photo-badge--exp" aria-hidden="true">
                <FaStar className="hp-badge-icon" />
                <div>
                  <strong>+5 años</strong>
                  <span>de experiencia</span>
                </div>
              </div>

              {/* floating badge — disponibilidad */}
              <div className="hp-photo-badge hp-photo-badge--avail" aria-hidden="true">
                <span className="hp-avail-dot" />
                Disponible para nuevos alumnos
              </div>

              {/* floating badge — materias */}
              <div className="hp-photo-badge hp-photo-badge--subjects" aria-hidden="true">
                <FaGraduationCap className="hp-badge-icon" />
                <span>Matemática · Física · Química</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════
          STATS
      ════════════════════════════════════════ */}
      <section className="hp-stats" aria-label="Números destacados">
        <div className="hp-stats-inner">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="hp-stat">
                <Icon className="hp-stat-icon" aria-hidden="true" />
                <span className="hp-stat-value">{s.value}</span>
                <span className="hp-stat-label">{s.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* ════════════════════════════════════════
          SOBRE MÍ
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-about-title">
        <div className="hp-section-inner hp-about">
          <div className="hp-about-copy">
            <span className="hp-kicker">Quién te enseña</span>
            <h2 id="hp-about-title" className="hp-section-title">
              Hola, soy Agustín 👋
            </h2>
            <p className="hp-about-text">
              Soy profesor particular con más de 5 años ayudando estudiantes
              de todos los niveles a entender lo que en el aula nunca quedó claro.
              Me especializo en matemática, física, química y programación.
            </p>
            <p className="hp-about-text">
              Mi método es simple: <strong>entiendo cómo aprendés vos</strong>, no cómo
              enseña el libro. Cada clase arranca de donde estás hoy y avanza a tu ritmo,
              con ejemplos reales y mucha práctica dirigida.
            </p>
            <ul className="hp-about-tags">
              {["Clases 1 a 1", "Seguimiento continuo", "Horario flexible", "Temperley, GBA"].map((t) => (
                <li key={t} className="hp-about-tag">
                  <FaCheckCircle aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-btn-navy"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Consultame directamente
            </a>
          </div>
          <div className="hp-about-photo-wrap">
            <div className="hp-about-photo-frame">
              <img
                src={agustinPhoto}
                alt="Agustín Sosa, profesor particular de matemática y ciencias"
                className="hp-about-photo"
              />
              <span className="hp-about-accent-ring" aria-hidden="true" />
            </div>
            <div className="hp-about-location">
              <FaMapMarkerAlt aria-hidden="true" />
              Jujuy 414, Temperley · Buenos Aires
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MATERIAS
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-subjects-title">
        <div className="hp-section-inner">
          <div className="hp-section-head">
            <span className="hp-kicker">¿Qué materia necesitás?</span>
            <h2 id="hp-subjects-title" className="hp-section-title">Áreas de enseñanza</h2>
            <p className="hp-section-desc">
              Trabajamos desde los conceptos base hasta los contenidos más avanzados,
              con ejercitación dirigida y ejemplos del mundo real.
            </p>
          </div>
          <ul className="hp-subjects" role="list">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <li key={s.label} className="hp-subject-card">
                  <span className="hp-subject-icon-wrap" aria-hidden="true">
                    <Icon />
                  </span>
                  <strong className="hp-subject-name">{s.label}</strong>
                  <span className="hp-subject-desc">{s.desc}</span>
                </li>
              );
            })}
          </ul>
          <div className="hp-subjects-cta">
            <Link to="/reservar" className="hp-btn-primary">
              <FaCalendarCheck aria-hidden="true" />
              Reservar mi clase
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CÓMO FUNCIONA
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--navy" aria-labelledby="hp-steps-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker hp-kicker--green">Simple y rápido</span>
            <h2 id="hp-steps-title" className="hp-section-title hp-section-title--light">
              Reservar tu turno en 4 pasos
            </h2>
            <p className="hp-section-desc hp-section-desc--light">
              Todo desde el celular o la computadora. Sin llamadas. Sin papeles. En menos de 3 minutos.
            </p>
          </div>

          <ol className="hp-steps" aria-label="Cómo reservar">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.num} className="hp-step">
                  <div className="hp-step-head">
                    <span className="hp-step-num">{step.num}</span>
                    <span className="hp-step-icon"><Icon /></span>
                  </div>
                  <strong className="hp-step-title">{step.title}</strong>
                  <p className="hp-step-desc">{step.desc}</p>
                  <span className="hp-step-detail">{step.detail}</span>
                  {i < STEPS.length - 1 && <span className="hp-step-line" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          <div className="hp-steps-cta">
            <Link to="/reservar" className="hp-btn-green hp-btn-xl">
              <FaCalendarCheck aria-hidden="true" />
              Empezar ahora — es gratis
              <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
            </Link>
            <p className="hp-steps-note">Sin registro. Sin pagos por adelantado.</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          BENEFICIOS
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-benefits-title">
        <div className="hp-section-inner">
          <div className="hp-section-head">
            <span className="hp-kicker">¿Por qué con Agustín?</span>
            <h2 id="hp-benefits-title" className="hp-section-title">Lo que no encontrás en el aula</h2>
          </div>
          <ul className="hp-benefits" role="list">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className="hp-benefit-card">
                  <span className="hp-benefit-icon"><Icon /></span>
                  <div>
                    <strong className="hp-benefit-title">{b.title}</strong>
                    <p className="hp-benefit-desc">{b.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════
          NIVELES
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-levels-title">
        <div className="hp-section-inner hp-section-inner--center">
          <span className="hp-kicker">Para todos</span>
          <h2 id="hp-levels-title" className="hp-section-title">Niveles educativos</h2>
          <p className="hp-section-desc" style={{ margin: "0 auto 32px" }}>
            Desde las primeras operaciones hasta los finales universitarios más exigentes.
          </p>
          <ul className="hp-levels" role="list">
            {LEVELS.map((l) => (
              <li key={l} className="hp-level-pill">
                <FaGraduationCap aria-hidden="true" /> {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA FINAL
      ════════════════════════════════════════ */}
      <section className="hp-cta-final" aria-label="Llamada a la acción">
        <div className="hp-cta-bg" aria-hidden="true">
          <span className="hp-cta-blob hp-cta-blob--1" />
          <span className="hp-cta-blob hp-cta-blob--2" />
          <span className="hp-hero-grid" />
        </div>
        <div className="hp-cta-inner">
          <ThemeLogo variant="monogram" imgClassName="hp-cta-logo" alt="" />
          <h2 className="hp-cta-title">
            ¿Listo para dar el primer paso?
          </h2>
          <p className="hp-cta-desc">
            Reservá en 3 minutos. Sin registro. Sin pagos adelantados.<br />
            Con tu código gestionás todo desde el portal del alumno.
          </p>
          <div className="hp-cta-actions">
            <Link to="/reservar" className="hp-btn-green hp-btn-xl">
              <FaCalendarCheck aria-hidden="true" />
              Reservar mi turno ahora
              <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-btn-ghost hp-btn-xl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hablar con Agustín
            </a>
          </div>
          <div className="hp-cta-footer">
            <span className="hp-cta-location">
              <FaMapMarkerAlt aria-hidden="true" /> Jujuy 414, Temperley · Buenos Aires
            </span>
            <a
              href="https://tuprofesorparticular.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="hp-cta-web-link"
            >
              <FaExternalLinkAlt aria-hidden="true" />
              tuprofesorparticular.com.ar — mi web completa
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
