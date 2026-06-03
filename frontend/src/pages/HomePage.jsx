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
  FaRocket,
  FaShieldAlt,
  FaUserCheck,
  FaUserGraduate,
  FaWhatsapp,
} from "react-icons/fa";
import { usePageMeta } from "../hooks/useDocumentTitle";
import ThemeLogo from "../components/ui/ThemeLogo";
import "./HomePage.css";

/* ── datos ─────────────────────────────────────────── */

const SUBJECTS = [
  { icon: FaCalculator, label: "Matemática",   color: "#2a5298", delay: "0s"    },
  { icon: FaFlask,      label: "Física",        color: "#1a6b4a", delay: "0.15s" },
  { icon: FaFlask,      label: "Química",       color: "#6b1a3a", delay: "0.3s"  },
  { icon: FaCalculator, label: "Álgebra",       color: "#2a5298", delay: "0.45s" },
  { icon: FaCalculator, label: "Estadística",   color: "#4a2a7a", delay: "0.6s"  },
  { icon: FaLaptopCode, label: "Programación",  color: "#1a4a6b", delay: "0.75s" },
];

const LEVELS = [
  { label: "Primaria",             emoji: "✏️" },
  { label: "Secundaria",           emoji: "📐" },
  { label: "Secundaria Técnica",   emoji: "🔧" },
  { label: "Terciario / Superior", emoji: "📚" },
  { label: "Universitario",        emoji: "🎓" },
];

const STEPS = [
  {
    num: "01",
    icon: FaUserGraduate,
    title: "Completá tu perfil",
    desc: "Nombre, nivel y materia. Menos de 2 minutos desde cualquier dispositivo.",
    tag: "Sin registro previo",
  },
  {
    num: "02",
    icon: FaRegClock,
    title: "Elegí día y horario",
    desc: "Calendario en tiempo real. Solo ves los turnos disponibles.",
    tag: "Lun. a Sáb.",
  },
  {
    num: "03",
    icon: FaClipboardList,
    title: "Confirmá tu reserva",
    desc: "Recibís un código único para gestionar, reprogramar o cancelar.",
    tag: "Comprobante por email",
  },
  {
    num: "04",
    icon: FaClipboardCheck,
    title: "¡Clase confirmada!",
    desc: "Llegá con tus dudas. Todo lo gestionás desde el portal del alumno.",
    tag: "Jujuy 414, Temperley",
  },
];

const REASONS = [
  {
    icon: FaRocket,
    title: "Reserva en 3 minutos",
    desc: "Sin llamadas. Sin formularios interminables. Elegís, confirmás y listo.",
  },
  {
    icon: FaRegClock,
    title: "Horario totalmente flexible",
    desc: "Elegís el día y la hora. Podés reprogramar desde el portal sin hablar con nadie.",
  },
  {
    icon: FaUserCheck,
    title: "Clases 100% personalizadas",
    desc: "Cada clase arranca desde donde estás hoy. Sin contenido genérico ni ritmo impuesto.",
  },
  {
    icon: FaShieldAlt,
    title: "Sin compromiso",
    desc: "Sin pagos por adelantado. Sin contratos. Reservás, venís y decidís si seguís.",
  },
  {
    icon: FaMedal,
    title: "Seguimiento real",
    desc: "Cada clase queda registrada. Siempre sabemos en qué punto estás y qué viene.",
  },
  {
    icon: FaRegLightbulb,
    title: "Todos los niveles",
    desc: "Desde primaria hasta la universidad. Con el lenguaje y los ejemplos que corresponden.",
  },
];

/* ── componente ────────────────────────────────────── */

const HomePage = () => {
  usePageMeta(
    "Tu Profesor Particular · Reservá tu clase online — Matemática, Física y más",
    "Reservá tu clase particular de matemática, física, química y programación en 3 minutos. Sin registro. Sin pagos por adelantado. Temperley, Buenos Aires.",
  );

  return (
    <div className="hp">

      {/* ── Banner web principal ── */}
      <a
        href="https://tuprofesorparticular.com.ar"
        target="_blank"
        rel="noopener noreferrer"
        className="hp-web-banner"
        aria-label="Visitá la web completa de Tu Profesor Particular"
      >
        <span className="hp-web-banner-pulse" aria-hidden="true" />
        <span className="hp-web-banner-text">
          🌐 <strong>Próximamente:</strong> mi web completa en{" "}
          <span className="hp-web-banner-url">tuprofesorparticular.com.ar</span>
        </span>
        <span className="hp-web-banner-cta">
          Ver más <FaExternalLinkAlt aria-hidden="true" />
        </span>
      </a>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="hp-hero" aria-label="Inicio">
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-blob hp-blob--1" />
          <span className="hp-blob hp-blob--2" />
          <span className="hp-blob hp-blob--3" />
          <span className="hp-grid" />
        </div>

        <div className="hp-hero-inner">
          <div className="hp-hero-logo" aria-hidden="true">
            <ThemeLogo variant="full" imgClassName="hp-logo-img" alt="Tu Profesor Particular" />
          </div>

          <div className="hp-hero-badge">
            <span className="hp-hero-badge-dot" aria-hidden="true" />
            Sistema de reservas online · Temperley, Buenos Aires
          </div>

          <h1 className="hp-hero-h1">
            Reservá tu clase<br />
            <span className="hp-h1-accent">en&nbsp;3&nbsp;minutos</span>
          </h1>

          <p className="hp-hero-sub">
            Matemática · Física · Química · Álgebra · Estadística · Programación<br />
            Sin llamadas. Sin registro previo. Desde cualquier dispositivo.
          </p>

          <div className="hp-hero-chips" aria-label="Ventajas">
            {[
              { icon: FaCheckCircle, text: "Gratis reservar" },
              { icon: FaCheckCircle, text: "Sin registro" },
              { icon: FaCheckCircle, text: "Reprogramá cuando quieras" },
            ].map((c) => (
              <span key={c.text} className="hp-chip">
                <c.icon aria-hidden="true" /> {c.text}
              </span>
            ))}
          </div>

          <div className="hp-hero-ctas">
            <Link to="/reservar" className="hp-cta-main">
              <FaCalendarCheck aria-hidden="true" />
              Reservar mi clase ahora
              <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-cta-ghost"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hablemos
            </a>
          </div>

          {/* mini preview de pasos en el hero */}
          <div className="hp-hero-steps-preview" aria-hidden="true">
            {["Completá tus datos", "Elegí día y hora", "¡Confirmado!"].map((s, i) => (
              <div key={s} className="hp-preview-step">
                <span className="hp-preview-num">{i + 1}</span>
                <span className="hp-preview-label">{s}</span>
                {i < 2 && <FaArrowRight className="hp-preview-arrow" />}
              </div>
            ))}
          </div>
        </div>

        {/* scroll indicator */}
        <div className="hp-scroll-hint" aria-hidden="true">
          <span className="hp-scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════
          CÓMO RESERVAR — 3D cards
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--dark" aria-labelledby="hp-steps-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker hp-kicker--green">Simple y rápido</span>
            <h2 id="hp-steps-title" className="hp-section-h2 hp-section-h2--light">
              ¿Cómo se reserva un turno?
            </h2>
            <p className="hp-section-p hp-section-p--light">
              Todo online. Todo desde el celular. En menos de 3 minutos estás confirmado.
            </p>
          </div>

          <ol className="hp-steps-grid" aria-label="Pasos para reservar">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.num} className="hp-step-card">
                  <div className="hp-step-card-inner">
                    <div className="hp-step-num-wrap">
                      <span className="hp-step-num">{step.num}</span>
                    </div>
                    <div className="hp-step-icon-wrap">
                      <Icon aria-hidden="true" />
                    </div>
                    <strong className="hp-step-title">{step.title}</strong>
                    <p className="hp-step-desc">{step.desc}</p>
                    <span className="hp-step-tag">{step.tag}</span>
                  </div>
                  <div className="hp-step-glow" aria-hidden="true" />
                </li>
              );
            })}
          </ol>

          <div className="hp-steps-cta">
            <Link to="/reservar" className="hp-cta-main hp-cta-xl">
              <FaCalendarCheck aria-hidden="true" />
              Empezar ahora — es gratis
              <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
            </Link>
            <p className="hp-steps-note">Sin tarjeta. Sin contrato. Sin compromiso.</p>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          MATERIAS — floating 3D cards
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-subjects-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker">¿Qué materia necesitás?</span>
            <h2 id="hp-subjects-title" className="hp-section-h2">
              Áreas de enseñanza
            </h2>
            <p className="hp-section-p">
              Desde los conceptos más básicos hasta los contenidos universitarios
              más exigentes, con ejercitación dirigida y ejemplos reales.
            </p>
          </div>

          <ul className="hp-subjects-grid" role="list">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.label}
                  className="hp-subject-card"
                  style={{ "--float-delay": s.delay, "--icon-color": s.color }}
                >
                  <div className="hp-subject-icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <strong className="hp-subject-name">{s.label}</strong>
                  <div className="hp-subject-shine" aria-hidden="true" />
                </li>
              );
            })}
          </ul>

          <div className="hp-section-cta-center">
            <Link to="/reservar" className="hp-cta-main">
              <FaCalendarCheck aria-hidden="true" />
              Reservar para esta materia
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          POR QUÉ ELEGIRNOS
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-reasons-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker">¿Por qué elegirnos?</span>
            <h2 id="hp-reasons-title" className="hp-section-h2">
              Todo pensado para que aprendas
            </h2>
          </div>

          <ul className="hp-reasons-grid" role="list">
            {REASONS.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.title} className="hp-reason-card">
                  <span className="hp-reason-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <strong className="hp-reason-title">{r.title}</strong>
                  <p className="hp-reason-desc">{r.desc}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════
          NIVELES EDUCATIVOS
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-levels-title">
        <div className="hp-section-inner hp-section-inner--center">
          <span className="hp-kicker">Para todos</span>
          <h2 id="hp-levels-title" className="hp-section-h2">Niveles que trabajamos</h2>
          <p className="hp-section-p" style={{margin:"0 auto 40px"}}>
            Desde las primeras operaciones hasta los finales universitarios más exigentes.
          </p>
          <ul className="hp-levels" role="list">
            {LEVELS.map((l) => (
              <li key={l.label} className="hp-level-card">
                <span className="hp-level-emoji" aria-hidden="true">{l.emoji}</span>
                <span className="hp-level-label">{l.label}</span>
              </li>
            ))}
          </ul>
          <div style={{marginTop:"44px"}}>
            <Link to="/reservar" className="hp-cta-main">
              <FaCalendarCheck aria-hidden="true" />
              Reservar ahora
              <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA FINAL + web principal
      ════════════════════════════════════════ */}
      <section className="hp-cta-section" aria-label="Reservá tu turno">
        <div className="hp-cta-bg" aria-hidden="true">
          <span className="hp-blob hp-blob--1" />
          <span className="hp-blob hp-blob--2" />
          <span className="hp-grid" />
        </div>

        <div className="hp-cta-inner">
          <ThemeLogo variant="monogram" imgClassName="hp-cta-monogram" alt="" aria-hidden="true" />

          <h2 className="hp-cta-h2">
            ¿Listo para reservar<br />tu primera clase?
          </h2>
          <p className="hp-cta-p">
            Sin registro. Sin pagos por adelantado.<br />
            En 3 minutos estás confirmado.
          </p>

          <div className="hp-cta-actions">
            <Link to="/reservar" className="hp-cta-main hp-cta-xl">
              <FaCalendarCheck aria-hidden="true" />
              Reservar mi turno
              <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%2C%20quiero%20consultar%20sobre%20clases%20particulares."
              className="hp-cta-ghost hp-cta-xl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hablemos
            </a>
          </div>

          <p className="hp-cta-location">
            <FaMapMarkerAlt aria-hidden="true" /> Jujuy 414, Temperley · Buenos Aires
          </p>
        </div>

        {/* Web principal — destacada */}
        <a
          href="https://tuprofesorparticular.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="hp-web-section"
          aria-label="Visitá la web completa de Tu Profesor Particular"
        >
          <div className="hp-web-section-inner">
            <ThemeLogo variant="monogram" imgClassName="hp-web-logo" alt="" aria-hidden="true" />
            <div className="hp-web-copy">
              <strong>¿Querés saber más antes de reservar?</strong>
              <span>Visitá mi web completa con toda la información, materias, metodología y más.</span>
              <span className="hp-web-url">
                tuprofesorparticular.com.ar
                <FaExternalLinkAlt aria-hidden="true" />
              </span>
            </div>
            <span className="hp-web-arrow-btn" aria-hidden="true">
              Visitar <FaArrowRight />
            </span>
          </div>
        </a>
      </section>

    </div>
  );
};

export default HomePage;
