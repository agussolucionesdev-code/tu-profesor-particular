import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaCalculator,
  FaCalendarCheck,
  FaCheckCircle,
  FaClipboardList,
  FaFlask,
  FaGraduationCap,
  FaLaptopCode,
  FaMapMarkerAlt,
  FaMedal,
  FaRegClock,
  FaRegLightbulb,
  FaUserGraduate,
  FaWhatsapp,
} from "react-icons/fa";
import { usePageMeta } from "../hooks/useDocumentTitle";
import ThemeLogo from "../components/ui/ThemeLogo";
import agustinPhoto from "../assets/images/agustin-sosa.jpg";
import "./HomePage.css";

/* ─────────────────────── datos ─────────────────────── */

const SUBJECTS = [
  { icon: FaCalculator,    label: "Matemática",   desc: "Aritmética, álgebra, cálculo" },
  { icon: FaFlask,         label: "Física",       desc: "Mecánica, electromagnetismo" },
  { icon: FaFlask,         label: "Química",      desc: "General, orgánica, analítica" },
  { icon: FaCalculator,    label: "Álgebra",      desc: "Lineal, abstracta, vectorial" },
  { icon: FaCalculator,    label: "Estadística",  desc: "Descriptiva e inferencial" },
  { icon: FaLaptopCode,    label: "Programación", desc: "Python, lógica, algoritmos" },
];

const LEVELS = [
  "Primaria",
  "Secundaria",
  "Secundaria Técnica",
  "Terciario / Superior",
  "Universitario",
];

const STATS = [
  { value: "+5",    label: "años de experiencia" },
  { value: "6",     label: "áreas de enseñanza" },
  { value: "100%",  label: "clases personalizadas" },
  { value: "5",     label: "niveles educativos" },
];

const STEPS = [
  {
    num: "01",
    icon: FaUserGraduate,
    title: "Completá tu perfil",
    desc: "Nombre, nivel educativo, materia y un breve contexto. En menos de 2 minutos.",
  },
  {
    num: "02",
    icon: FaRegClock,
    title: "Elegí día y horario",
    desc: "Calendario en tiempo real. Solo aparecen los turnos disponibles.",
  },
  {
    num: "03",
    icon: FaClipboardList,
    title: "Confirmá tu turno",
    desc: "Recibís un código único para gestionar o reprogramar cuando quieras.",
  },
  {
    num: "04",
    icon: FaCheckCircle,
    title: "¡Nos vemos!",
    desc: "Llega preparado. Si tenés dudas antes, escribime por WhatsApp.",
  },
];

const BENEFITS = [
  {
    icon: FaRegLightbulb,
    title: "Clases a tu medida",
    desc: "Cada clase se arma según tu nivel, ritmo y objetivo puntual. Sin recetas genéricas.",
  },
  {
    icon: FaCalendarCheck,
    title: "Horario flexible",
    desc: "Elegís el día y la hora que más te conviene. Podés reprogramar desde el portal.",
  },
  {
    icon: FaMedal,
    title: "Seguimiento real",
    desc: "Llevamos registro de tu evolución clase a clase para siempre saber dónde estás.",
  },
  {
    icon: FaGraduationCap,
    title: "Todos los niveles",
    desc: "Desde primaria hasta la universidad. Con lenguaje y ejemplos apropiados para cada etapa.",
  },
];

/* ─────────────────────── componente ─────────────────── */

const HomePage = () => {
  usePageMeta(
    "Agustín Sosa · Clases particulares de Matemática, Física y más",
    "Profesor particular de matemática, física, química y programación. Reservá tu turno online en minutos. Temperley, Buenos Aires.",
  );

  return (
    <div className="hp">

      {/* ══════════════════════════════════════════
          HERO — pantalla completa, centrado
      ══════════════════════════════════════════ */}
      <section className="hp-hero" aria-label="Presentación">
        {/* capa de fondo decorativa */}
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-hero-blob hp-hero-blob--1" />
          <span className="hp-hero-blob hp-hero-blob--2" />
          <span className="hp-hero-grid" />
        </div>

        <div className="hp-hero-inner">
          <div className="hp-hero-logo-wrap">
            <ThemeLogo variant="tagline" imgClassName="hp-hero-logo" alt="Tu Profesor Particular — Juntos, despejando el camino a la meta" />
          </div>

          <h1 className="hp-hero-headline">
            Aprendé con alguien que<br />
            <span className="hp-hero-accent">realmente te acompaña</span>
          </h1>

          <p className="hp-hero-sub">
            Matemática · Física · Química · Álgebra · Estadística · Programación<br />
            <span className="hp-hero-location">
              <FaMapMarkerAlt aria-hidden="true" /> Temperley, Buenos Aires
            </span>
          </p>

          <div className="hp-hero-actions">
            <Link to="/reservar" className="hp-btn-primary hp-btn-lg">
              <FaCalendarCheck aria-hidden="true" />
              Reservar turno online
              <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-btn-ghost hp-btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Consultar por WhatsApp
            </a>
          </div>

          <div className="hp-hero-scroll" aria-hidden="true">
            <span className="hp-scroll-dot" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS — banda de confianza
      ══════════════════════════════════════════ */}
      <section className="hp-stats" aria-label="Datos destacados">
        <div className="hp-stats-inner">
          {STATS.map((s) => (
            <div key={s.label} className="hp-stat">
              <span className="hp-stat-value">{s.value}</span>
              <span className="hp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SOBRE MÍ
      ══════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-about-title">
        <div className="hp-section-inner hp-about">
          <div className="hp-about-photo-col">
            <div className="hp-about-photo-frame">
              <img
                src={agustinPhoto}
                alt="Agustín Elías Sosa, profesor particular"
                className="hp-about-photo"
              />
              <span className="hp-about-photo-deco" aria-hidden="true" />
            </div>
          </div>
          <div className="hp-about-copy-col">
            <span className="hp-kicker">Quién te enseña</span>
            <h2 id="hp-about-title" className="hp-section-title">
              Hola, soy Agustín
            </h2>
            <p className="hp-about-text">
              Soy profesor particular con más de 5 años de experiencia acompañando
              estudiantes de todos los niveles — desde primaria hasta la universidad.
              Me especializo en matemática, física, química y programación.
            </p>
            <p className="hp-about-text">
              Mi método es simple: entiendo cómo aprendés <em>vos</em>, no cómo
              enseña el libro. Cada clase arranca de donde estás y avanza a tu ritmo.
              Sin presiones, sin juicios. Con mucho ejercicio y ejemplos reales.
            </p>
            <ul className="hp-about-tags" aria-label="Características">
              {[
                "Clases 1 a 1",
                "Seguimiento personalizado",
                "Horario flexible",
                "Temperley, Buenos Aires",
              ].map((t) => (
                <li key={t} className="hp-about-tag">
                  <FaCheckCircle aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-btn-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Escribime por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          MATERIAS
      ══════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-subjects-title">
        <div className="hp-section-inner">
          <div className="hp-section-head">
            <span className="hp-kicker">¿Qué materia necesitás?</span>
            <h2 id="hp-subjects-title" className="hp-section-title">
              Áreas de enseñanza
            </h2>
            <p className="hp-section-desc">
              Trabajamos desde los conceptos base hasta los contenidos más avanzados,
              con ejemplos reales y ejercitación dirigida.
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

      {/* ══════════════════════════════════════════
          CÓMO FUNCIONA — pasos horizontales
      ══════════════════════════════════════════ */}
      <section className="hp-section hp-section--navy" aria-labelledby="hp-steps-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--light">
            <span className="hp-kicker hp-kicker--green">Simple y rápido</span>
            <h2 id="hp-steps-title" className="hp-section-title hp-section-title--light">
              ¿Cómo reservar tu turno?
            </h2>
            <p className="hp-section-desc hp-section-desc--light">
              Todo 100% online. Desde el celular o la computadora, en menos de 3 minutos.
            </p>
          </div>

          <ol className="hp-steps" aria-label="Pasos para reservar">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.num} className="hp-step">
                  <div className="hp-step-num" aria-hidden="true">{step.num}</div>
                  <div className="hp-step-icon-wrap" aria-hidden="true">
                    <Icon />
                  </div>
                  <strong className="hp-step-title">{step.title}</strong>
                  <p className="hp-step-desc">{step.desc}</p>
                  {i < STEPS.length - 1 && (
                    <span className="hp-step-connector" aria-hidden="true" />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="hp-steps-cta">
            <Link to="/reservar" className="hp-btn-green hp-btn-lg">
              <FaCalendarCheck aria-hidden="true" />
              Empezar ahora — es gratis
              <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
            </Link>
            <p className="hp-steps-note">
              Sin registro previo. Sin pagos por adelantado.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          BENEFICIOS
      ══════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-benefits-title">
        <div className="hp-section-inner">
          <div className="hp-section-head">
            <span className="hp-kicker">¿Por qué elegirme?</span>
            <h2 id="hp-benefits-title" className="hp-section-title">
              Lo que te diferencia del aula
            </h2>
          </div>

          <ul className="hp-benefits" role="list">
            {BENEFITS.map((b) => {
              const Icon = b.icon;
              return (
                <li key={b.title} className="hp-benefit-card">
                  <span className="hp-benefit-icon" aria-hidden="true">
                    <Icon />
                  </span>
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

      {/* ══════════════════════════════════════════
          NIVELES
      ══════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-levels-title">
        <div className="hp-section-inner hp-section-inner--center">
          <span className="hp-kicker">Para todos</span>
          <h2 id="hp-levels-title" className="hp-section-title">Niveles educativos</h2>
          <p className="hp-section-desc">
            Desde las operaciones básicas hasta el cálculo universitario más exigente.
          </p>
          <ul className="hp-levels" role="list">
            {LEVELS.map((l) => (
              <li key={l} className="hp-level-pill">
                <FaGraduationCap aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════ */}
      <section className="hp-cta-final" aria-label="Reservá tu turno">
        <div className="hp-cta-final-bg" aria-hidden="true">
          <span className="hp-cta-blob hp-cta-blob--1" />
          <span className="hp-cta-blob hp-cta-blob--2" />
        </div>
        <div className="hp-cta-final-inner">
          <ThemeLogo variant="monogram" imgClassName="hp-cta-logo" alt="" />
          <h2 className="hp-cta-title">
            ¿Listo para dar el primer paso?
          </h2>
          <p className="hp-cta-desc">
            Reservá tu turno ahora y en menos de 3 minutos tenés tu clase agendada.
            <br />Sin papeles. Sin complicaciones.
          </p>
          <div className="hp-cta-actions">
            <Link to="/reservar" className="hp-btn-green hp-btn-lg">
              <FaCalendarCheck aria-hidden="true" />
              Reservar turno
              <FaArrowRight className="hp-btn-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-btn-ghost hp-btn-lg"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hablar con Agustín
            </a>
          </div>
          <p className="hp-cta-location">
            <FaMapMarkerAlt aria-hidden="true" /> Jujuy 414, Temperley · Buenos Aires
          </p>
        </div>
      </section>

    </div>
  );
};

export default HomePage;
