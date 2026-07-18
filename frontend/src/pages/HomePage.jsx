import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaAtom,
  FaBolt,
  FaCalculator,
  FaCalendarCheck,
  FaCheckCircle,
  FaClipboardCheck,
  FaClipboardList,
  FaExternalLinkAlt,
  FaFlask,
  FaGlobeAmericas,
  FaGraduationCap,
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
import BookingStepsShowcase from "../components/home/BookingStepsShowcase";
import { getSubjectIcon } from "../constants/subjectIcons";
import "./HomePage.css";

/* ── datos ─────────────────────────────────────────── */

const SUBJECTS = [
  {
    icon:     FaCalculator,
    label:    "Matemáticas",
    tagline:  "No sos malo en matemáticas.",
    hook:     "Nunca te las explicaron bien.",
    color:    "#1a3a6b",
    gradient: "linear-gradient(135deg,#1a3a6b,#2a5298)",
    param:    "Matemáticas",
    delay:    "0s",
  },
  {
    icon:     FaBolt,
    label:    "Física",
    tagline:  "La física tiene lógica interna.",
    hook:     "Cuando la encontrás, todo encaja solo.",
    color:    "#b45309",
    gradient: "linear-gradient(135deg,#92400e,#d97706)",
    param:    "Física",
    delay:    "0.4s",
  },
  {
    icon:     FaAtom,
    label:    "Fisicoquímica",
    tagline:  "El filtro más duro de cualquier carrera.",
    hook:     "Con la guía correcta, se vuelve la más lógica.",
    color:    "#5b21b6",
    gradient: "linear-gradient(135deg,#4c1d95,#7c3aed)",
    param:    "Fisicoquímica",
    delay:    "0.8s",
  },
  {
    icon:     FaFlask,
    label:    "Química",
    tagline:  "Basta de memorizar sin entender.",
    hook:     "La química tiene reglas — y tienen sentido.",
    color:    "#065f46",
    gradient: "linear-gradient(135deg,#064e3b,#059669)",
    param:    "Química",
    delay:    "1.2s",
  },
  {
    icon:     FaGlobeAmericas,
    label:    "Inglés",
    tagline:  "No es talento. Es método.",
    hook:     "Y el miedo a hablar se trabaja, no se espera.",
    color:    "#1e3a5f",
    gradient: "linear-gradient(135deg,#0c2340,#1a4a7a)",
    param:    "Inglés",
    delay:    "1.6s",
  },
];

// Mapa nivel homepage → valor del formulario
const LEVEL_FORM_MAP = {
  "Primaria":             "Primaria",
  "Secundaria":           "Secundaria",
  "Secundaria Técnica":   "Secundaria Tecnica",
  "Terciario / Superior": "Terciario",
  "Universitario":        "Universitario",
};

const LEVELS = [
  {
    label: "Primaria",
    emoji: "✏️",
    desc: "Bases sólidas desde el principio. Acompañamiento en las materias troncales, con paciencia y sin apurar etapas.",
  },
  {
    label: "Secundaria",
    emoji: "📐",
    desc: "El tramo donde más se necesita claridad. Matemática, Física, Química y más, alineado a lo que te toman en clase.",
  },
  {
    label: "Secundaria Técnica",
    emoji: "🔧",
    desc: "Las materias técnicas con su lógica propia: dibujo, electricidad, electrónica, mecánica y las ciencias que las sostienen.",
  },
  {
    label: "Terciario / Superior",
    emoji: "📚",
    desc: "Formación docente y carreras superiores: pedagogía, didáctica, metodología de la investigación y más.",
  },
  {
    label: "Universitario",
    emoji: "🎓",
    desc: "El filtro de los primeros años: Análisis, Álgebra, Física, Química, Estadística y las materias que frenan a todos.",
  },
];

const REASONS = [
  {
    icon: FaRocket,
    title: "No perdés más tiempo solo",
    desc: "Estudiar sin entender la base no sirve. Cada hora que invertís sin dirección es una hora perdida. Una clase bien enfocada vale más que una semana de estudio a ciegas.",
  },
  {
    icon: FaRegClock,
    title: "Sin horarios rígidos",
    desc: "Elegís cuándo. Podés reprogramar cuando algo cambia — sin culpa, sin llamadas, sin complicaciones. Usá tu enlace seguro de gestión.",
  },
  {
    icon: FaUserCheck,
    title: "Desde donde vos estás, no desde donde deberías",
    desc: "No hay un \"deberías saber esto ya\". Arrancamos desde tu punto actual, sin juicios y sin saltar pasos que después te van a cobrar caro.",
  },
  {
    icon: FaShieldAlt,
    title: "Cero riesgo para empezar",
    desc: "Sin pagos por adelantado. Sin contratos. La primera clase es de diagnóstico: si no sentís que avanzaste, no volvés. Así de simple.",
  },
  {
    icon: FaMedal,
    title: "Progreso que se nota clase a clase",
    desc: "Cada sesión queda registrada. Sabemos exactamente en qué punto estás, qué mejoró y qué viene. El avance deja de ser una sensación y se vuelve algo concreto.",
  },
  {
    icon: FaRegLightbulb,
    title: "Entendés de verdad, no de memoria",
    desc: "Memorizar te lleva al parcial. Entender te lleva al final, al ingreso y más allá. La diferencia está en cómo se explica — no en cuánto se repite.",
  },
];

/* ── componente ────────────────────────────────────── */

const HomePage = () => {
  usePageMeta(
    "Tu Profesor Particular · Entendé de verdad, no de memoria — Clases online y presenciales",
    "¿Estudiás pero el resultado no cambia? Clases online y presenciales en Temperley de Matemáticas, Física, Fisicoquímica, Química e Inglés. Sin registro ni pagos por adelantado.",
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
          🌐 <strong>Sitio principal:</strong>{" "}
          <span className="hp-web-banner-url">tuprofesorparticular.com.ar</span>
        </span>
        <span className="hp-web-banner-cta">
          Visitar <FaExternalLinkAlt aria-hidden="true" />
        </span>
      </a>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="hp-hero" aria-label="Inicio">
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-grid" />
        </div>

        <div className="hp-hero-inner">
          {/* ── Columna copy ── */}
          <div className="hp-hero-copy">
            <div className="hp-hero-badge">
              <span className="hp-hero-badge-dot" aria-hidden="true" />
              Clases online y presenciales · Temperley, Buenos Aires
            </div>

            <h1 className="hp-hero-h1">
              Entendé de verdad,<br />
              <span className="hp-h1-accent">no&nbsp;de&nbsp;memoria</span>
            </h1>

            <p className="hp-hero-sub">
              ¿Estudiás y el resultado no cambia? Acá encontrás la clase que te faltaba.
              <span className="hp-hero-subjects-line">
                Matemáticas · Física · Fisicoquímica · Química · Inglés
              </span>
            </p>

            <div className="hp-hero-chips" aria-label="Garantías">
              {[
                { icon: FaCheckCircle, text: "Sin pagos por adelantado" },
                { icon: FaCheckCircle, text: "Primera clase de diagnóstico" },
                { icon: FaCheckCircle, text: "Reserva simple y guiada" },
              ].map((c) => (
                <span key={c.text} className="hp-chip">
                  <c.icon aria-hidden="true" /> {c.text}
                </span>
              ))}
            </div>

            <div className="hp-hero-ctas">
              <Link to="/reservar" className="hp-cta-main">
                <FaCalendarCheck aria-hidden="true" />
                Reservar mi clase — sin adelanto
                <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
              </Link>
              <a
                href="https://wa.me/5491164236675?text=Hola%2C%20tengo%20una%20consulta%20antes%20de%20reservar."
                className="hp-cta-ghost"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Consultar antes
              </a>
            </div>

            <ul className="hp-hero-trust" aria-label="Cómo funciona">
              <li>Sin registro ni contraseña</li>
              <li>Reservás en menos de un minuto</li>
              <li>Gestionás con tu código</li>
            </ul>
          </div>

          {/* ── Columna vista previa en vivo del kiosco ── */}
          <div className="hp-hero-preview" aria-hidden="true">
            <div className="hp-hero-device">
              <div className="hp-hero-device-bar">
                <span className="hp-hero-device-dot" />
                <span className="hp-hero-device-dot" />
                <span className="hp-hero-device-dot" />
                <span className="hp-hero-device-url">turnos.tuprofesorparticular.com.ar</span>
              </div>
              <div className="hp-hero-device-body">
                <div className="hp-hero-mini-stepper">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      className={`hp-hero-mini-dot ${n === 1 ? "is-current" : ""}`}
                    >
                      {n}
                    </span>
                  ))}
                </div>
                <p className="hp-hero-device-title">¿Qué materia?</p>
                <div className="hp-hero-device-grid">
                  {["Matemática", "Física", "Química", "Biología", "Historia", "Inglés"].map(
                    (s, i) => {
                      const Icon = getSubjectIcon(s);
                      return (
                        <span
                          key={s}
                          className={`hp-hero-subject ${i === 0 ? "is-selected" : ""}`}
                        >
                          <Icon aria-hidden="true" />
                          {s}
                        </span>
                      );
                    },
                  )}
                </div>
              </div>
            </div>

            <span className="hp-hero-float hp-hero-float--a">
              <FaCheckCircle aria-hidden="true" /> Sin adelanto
            </span>
            <span className="hp-hero-float hp-hero-float--b">
              <FaRegClock aria-hidden="true" /> Turno en 1 minuto
            </span>
          </div>
        </div>

        {/* scroll indicator */}
        <div className="hp-scroll-hint" aria-hidden="true">
          <span className="hp-scroll-line" />
        </div>
      </section>

      {/* ════════════════════════════════════════
          CÓMO RESERVAR — recreación en vivo del kiosco
      ════════════════════════════════════════ */}
      <BookingStepsShowcase />

      {/* ════════════════════════════════════════
          MATERIAS — flip 3D cards
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-subjects-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker">Reconocés tu situación acá</span>
            <h2 id="hp-subjects-title" className="hp-section-h2">
              Materias principales
            </h2>
            <p className="hp-section-p">
              Pasá el mouse sobre cada tarjeta. Describimos exactamente los temas que más complican —
              y cómo los trabajamos para que dejen de serlo.
            </p>
          </div>

          <ul className="hp-subjects-grid" role="list" aria-label="Materias principales">
            {SUBJECTS.map((s) => {
              const Icon = s.icon;
              return (
                <li
                  key={s.label}
                  className="hp-subject-card"
                  style={{
                    "--float-delay":    s.delay,
                    "--subject-grad":   s.gradient,
                    "--subject-color":  s.color,
                  }}
                >
                  {/* cara delantera */}
                  <div className="hp-subject-front" aria-hidden="false">
                    <div className="hp-subject-icon-wrap">
                      <Icon aria-hidden="true" />
                      <span className="hp-subject-icon-ring" aria-hidden="true" />
                    </div>
                    <strong className="hp-subject-name">{s.label}</strong>
                    <span className="hp-subject-hint">Tocá para ver más</span>
                  </div>

                  {/* cara trasera */}
                  <div className="hp-subject-back">
                    <Icon className="hp-subject-back-icon" aria-hidden="true" />
                    <div className="hp-subject-back-copy">
                      <strong className="hp-subject-back-tagline">{s.tagline}</strong>
                      <span className="hp-subject-back-hook">{s.hook}</span>
                    </div>
                    <Link
                      to={`/reservar?materia=${encodeURIComponent(s.param)}`}
                      className="hp-subject-back-btn"
                    >
                      <FaCalendarCheck aria-hidden="true" />
                      Reservar clase de {s.label}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Banner "más materias" */}
          <div className="hp-more-subjects">
            <div className="hp-more-subjects-inner">
              <span className="hp-more-subjects-icon" aria-hidden="true">📚</span>
              <div className="hp-more-subjects-copy">
                <strong>Doy muchas más materias.</strong>
                <span>
                  Estas son las principales, pero no son todas.
                  Si la tuya no aparece acá, escribime —
                  <em> lo vemos juntos y te digo si puedo ayudarte.</em>
                </span>
              </div>
              <a
                href="https://wa.me/5491164236675?text=Hola%2C%20necesito%20ayuda%20con%20una%20materia%20que%20no%20veo%20en%20la%20web.%20%C2%BFMe%20pod%C3%A9s%20ayudar%3F"
                className="hp-more-subjects-btn"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaWhatsapp aria-hidden="true" />
                Consultame
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* ════════════════════════════════════════
          POR QUÉ ELEGIRNOS
      ════════════════════════════════════════ */}
      <section className="hp-section hp-section--soft" aria-labelledby="hp-reasons-title">
        <div className="hp-section-inner">
          <div className="hp-section-head hp-section-head--center">
            <span className="hp-kicker">Lo que hace la diferencia</span>
            <h2 id="hp-reasons-title" className="hp-section-h2">
              Por qué esto funciona cuando lo otro no
            </h2>
            <p className="hp-section-p" style={{margin:"0 auto"}}>
              Estudiar más no siempre es la solución. A veces alcanza con una sola clase bien enfocada para que todo lo que veías borroso de repente tenga sentido.
            </p>
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
          <span className="hp-kicker">Sin importar dónde estés</span>
          <h2 id="hp-levels-title" className="hp-section-h2">Todos los niveles</h2>
          <p className="hp-section-p" style={{margin:"0 auto 12px"}}>
            No hay nivel "demasiado básico" ni "demasiado avanzado". Elegí el tuyo y el formulario de reserva ya lo va a tener marcado.
          </p>
          <p className="hp-levels-hint">
            ↓ Tocá tu nivel para reservar directamente
          </p>
          <ul className="hp-levels" role="list">
            {LEVELS.map((l) => (
              <li key={l.label}>
                <Link
                  to={`/reservar?nivel=${encodeURIComponent(LEVEL_FORM_MAP[l.label])}`}
                  className="hp-level-card"
                  aria-label={`Reservar clase de nivel ${l.label}`}
                >
                  <span className="hp-level-emoji" aria-hidden="true">{l.emoji}</span>
                  <span className="hp-level-label">{l.label}</span>
                  <span className="hp-level-desc">{l.desc}</span>
                  <span className="hp-level-cta">Reservar →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════
          CTA FINAL + web principal
      ════════════════════════════════════════ */}
      <section className="hp-cta-section" aria-label="Reservá tu turno">
        <div className="hp-cta-bg" aria-hidden="true">
          <span className="hp-grid" />
        </div>

        <div className="hp-cta-inner">
          <ThemeLogo variant="monogram" imgClassName="hp-cta-monogram" alt="" aria-hidden="true" />

          <h2 className="hp-cta-h2">
            El parcial no espera.<br />
            <span className="hp-cta-h2-accent">Empezá hoy.</span>
          </h2>
          <p className="hp-cta-p">
            La primera clase es de diagnóstico: entendemos dónde estás y qué necesitás.<br />
            Sin pagos por adelantado. Sin compromiso. Solo una hora que puede cambiar todo.
          </p>

          <div className="hp-cta-actions">
            <Link to="/reservar" className="hp-cta-main hp-cta-xl">
              <FaCalendarCheck aria-hidden="true" />
              Reservar mi primera clase
              <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
            </Link>
            <a
              href="https://wa.me/5491164236675?text=Hola%2C%20quiero%20consultar%20antes%20de%20reservar."
              className="hp-cta-ghost hp-cta-xl"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Consultar primero
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
