import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaAtom,
  FaBolt,
  FaBookOpen,
  FaCalculator,
  FaCalendarCheck,
  FaChalkboardTeacher,
  FaClipboardCheck,
  FaClipboardList,
  FaCogs,
  FaDraftingCompass,
  FaExternalLinkAlt,
  FaFlask,
  FaGlobeAmericas,
  FaGraduationCap,
  FaMapMarkerAlt,
  FaMedal,
  FaPencilAlt,
  FaRegClock,
  FaRegLightbulb,
  FaRocket,
  FaShieldAlt,
  FaUserCheck,
  FaUserGraduate,
  FaWhatsapp,
} from "react-icons/fa";
import { usePageMeta } from "../hooks/useDocumentTitle";
import useScrollReveal from "../hooks/useScrollReveal";
import Magnetic from "../components/ui/Magnetic";
import ThemeLogo from "../components/ui/ThemeLogo";
import AboutAgustin from "../components/home/AboutAgustin";
import BookingStepsShowcase from "../components/home/BookingStepsShowcase";
import FaqSection from "../components/home/FaqSection";
import SectionHead from "../components/home/SectionHead";
import { getSubjectIcon } from "../constants/subjectIcons";
import agustinHero from "../assets/images/agustin-hero.webp";
import "../styles/reveal-system.css";
import "./HomePage.css";

/* ── datos ─────────────────────────────────────────── */

/* Cinta del hero. Reemplaza a los chips estáticos: mismo contenido, sin
   apilar una fila más en la columna de texto. El texto accesible va en un
   <p class="sr-only"> aparte, porque la cinta se duplica para el loop. */
const HERO_TICKER = [
  "Matemáticas",
  "Física",
  "Fisicoquímica",
  "Química",
  "Inglés",
  "Análisis Matemático",
  "Álgebra",
  "Biología",
  "Y muchas más a consultar",
];

/* Cada materia aporta un color sólido (regla del proyecto: sin degradados)
   que viste el ícono, el número y la barra de acento de su fila en el índice
   editorial. `ink` es la variante clara del mismo tono para dark mode: los
   colores base dan 1.5–2.9:1 sobre el fondo oscuro — invisibles. El tagline +
   hook, el copy que vende, está siempre visible (antes lo escondía un flip). */
const SUBJECTS = [
  {
    icon:    FaCalculator,
    label:   "Matemáticas",
    tagline: "No sos malo en matemáticas.",
    hook:    "Nunca te las explicaron bien.",
    color:   "#1a3a6b",
    ink:     "#8fb4e8",
    param:   "Matemáticas",
  },
  {
    icon:    FaBolt,
    label:   "Física",
    tagline: "La física tiene lógica interna.",
    hook:    "Cuando la encontrás, todo encaja solo.",
    color:   "#a34a08",
    ink:     "#f09a55",
    param:   "Física",
  },
  {
    icon:    FaAtom,
    label:   "Fisicoquímica",
    tagline: "El filtro más duro de cualquier carrera.",
    hook:    "Con la guía correcta, se vuelve la más lógica.",
    color:   "#5b21b6",
    ink:     "#c4a5f5",
    param:   "Fisicoquímica",
  },
  {
    icon:    FaFlask,
    label:   "Química",
    tagline: "Basta de memorizar sin entender.",
    hook:    "La química tiene reglas — y tienen sentido.",
    color:   "#065f46",
    ink:     "#5fd4a8",
    param:   "Química",
  },
  {
    icon:    FaGlobeAmericas,
    label:   "Inglés",
    tagline: "No es talento. Es método.",
    hook:    "Y el miedo a hablar se trabaja, no se espera.",
    color:   "#1e3a5f",
    ink:     "#8ab6de",
    param:   "Inglés",
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

/* Los niveles traían emojis (✏️📐🔧📚🎓), lo único emoji de la página junto al
   banner de materias. Al lado del sistema de íconos vectoriales se leían como
   un parche: pasan a react-icons, que además siguen el color de la marca. */
const LEVELS = [
  {
    label: "Primaria",
    icon: FaPencilAlt,
    desc: "Bases sólidas desde el principio. Acompañamiento en las materias troncales, con paciencia y sin apurar etapas.",
  },
  {
    label: "Secundaria",
    icon: FaDraftingCompass,
    desc: "El tramo donde más se necesita claridad. Matemática, Física, Química y más, alineado a lo que te toman en clase.",
  },
  {
    label: "Secundaria Técnica",
    icon: FaCogs,
    desc: "Las materias técnicas con su lógica propia: dibujo, electricidad, electrónica, mecánica y las ciencias que las sostienen.",
  },
  {
    label: "Terciario / Superior",
    icon: FaChalkboardTeacher,
    desc: "Formación docente y carreras superiores: pedagogía, didáctica, metodología de la investigación y más.",
  },
  {
    label: "Universitario",
    icon: FaGraduationCap,
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

  // Motor de scroll-reveal: revela cada elemento [data-reveal] al entrar al
  // viewport, con stagger por grupo. Reemplaza al reveal por-sección anterior.
  const pageRef = useRef(null);
  useScrollReveal(pageRef, []);

  // Parallax sutil: elementos [data-parallax] se desplazan a una fracción del
  // scroll. rAF-throttled y anulado en reduced-motion. Da profundidad sin blur.
  useEffect(() => {
    const root = pageRef.current;
    if (!root) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return undefined;
    }
    const layers = Array.from(root.querySelectorAll("[data-parallax]"));
    if (!layers.length) return undefined;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      layers.forEach((layer) => {
        const speed = Number(layer.getAttribute("data-parallax")) || 0;
        const rect = layer.getBoundingClientRect();
        const offset = (rect.top + rect.height / 2 - mid) * speed;
        layer.style.setProperty("--parallax-y", `${offset.toFixed(1)}px`);
      });
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  // Tilt 3D: el visual del hero sigue al mouse (sutil). Se anula en reduced-motion.
  const tiltRef = useRef(null);
  const handleTilt = (e) => {
    const el = tiltRef.current;
    if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(px * 9).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
  };
  const resetTilt = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  };

  // Gaze del hero: el titular (y los acentos) se desplazan sutilmente siguiendo
  // el cursor — el hero "reacciona al mouse". Se escribe --gaze-x/-y en el hero
  // y el CSS traduce cada capa a distinta profundidad. rAF-throttled, anulado
  // en reduced-motion.
  const heroRef = useRef(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
      return undefined;
    }
    let raf = 0;
    const onMove = (event) => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const r = el.getBoundingClientRect();
        const gx = ((event.clientX - r.left) / r.width - 0.5) * 2;
        const gy = ((event.clientY - r.top) / r.height - 0.5) * 2;
        el.style.setProperty("--gaze-x", gx.toFixed(3));
        el.style.setProperty("--gaze-y", gy.toFixed(3));
      });
    };
    const onLeave = () => {
      el.style.setProperty("--gaze-x", "0");
      el.style.setProperty("--gaze-y", "0");
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hp" ref={pageRef}>

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
          <FaGlobeAmericas className="hp-web-banner-globe" aria-hidden="true" />
          <strong>Sitio principal:</strong>{" "}
          <span className="hp-web-banner-url">tuprofesorparticular.com.ar</span>
        </span>
        <span className="hp-web-banner-cta">
          Visitar <FaExternalLinkAlt aria-hidden="true" />
        </span>
      </a>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="hp-hero" aria-label="Inicio" ref={heroRef}>
        <div className="hp-hero-bg" aria-hidden="true">
          <span className="hp-grid" />
          {/* Acentos planos: un bloque sólido desplazado + un aro de 1px.
              Geometría, no degradados. Parallax sutil para dar profundidad. */}
          <span className="hp-hero-slab" data-parallax="0.09" />
          <span className="hp-hero-ring hp-hero-ring--1" />
        </div>

        <div className="hp-hero-inner">
          {/* ── Rail de marginalia: el gesto editorial ── */}
          <div className="hp-hero-rail" aria-hidden="true">
            <span className="hp-rail-num">01</span>
            <span className="hp-rail-line" />
            <span className="hp-rail-label">Clases particulares</span>
          </div>

          {/* ── Titular: manda él, ocupa todo el ancho ── */}
          <header className="hp-hero-head">
            <p className="hp-hero-eyebrow">
              <span className="hp-eyebrow-dot" aria-hidden="true" />
              Online y presencial
              <span className="hp-eyebrow-sep" aria-hidden="true" />
              Temperley, Buenos Aires
            </p>

            <h1 className="hp-hero-h1">
              <span className="hp-h1-line">
                {["Entendé", "de", "verdad,"].map((w, i) => (
                  <span key={w} className="hp-h1-word" style={{ "--i": i }}>
                    {w}
                  </span>
                ))}
              </span>
              <span className="hp-h1-line hp-h1-line--accent">
                {["no", "de", "memoria"].map((w, i) => (
                  <span key={w} className="hp-h1-word" style={{ "--i": i + 3 }}>
                    {w}
                  </span>
                ))}
              </span>
            </h1>
          </header>

          {/* ── Cuerpo: slogan + promesa + acciones ── */}
          <div className="hp-hero-body">
            <p className="hp-hero-slogan">
              <span className="hp-slogan-a">Juntos,</span>{" "}
              <span className="hp-slogan-b">despejando el camino a</span>{" "}
              <span className="hp-slogan-c">la meta.</span>
            </p>

            <p className="hp-hero-sub">
              ¿Estudiás y el resultado no cambia? Acá está la clase que te
              faltaba.
            </p>

            <div className="hp-hero-ctas">
              <Magnetic strength={0.35}>
                <Link to="/reservar" className="hp-cta-main">
                  <FaCalendarCheck aria-hidden="true" />
                  Reservar mi clase
                  <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
                </Link>
              </Magnetic>
              <Magnetic strength={0.3}>
                <a
                  href="https://wa.me/5491164236675?text=Hola%2C%20tengo%20una%20consulta%20antes%20de%20reservar."
                  className="hp-cta-ghost"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FaWhatsapp aria-hidden="true" />
                  Consultar antes
                </a>
              </Magnetic>
            </div>

            <ul className="hp-hero-trust" aria-label="Cómo funciona">
              <li>Sin adelanto</li>
              <li>Sin registro ni contraseña</li>
              <li>Reservás en menos de un minuto</li>
            </ul>
          </div>

          {/* ── Foto de Agustín: protagonista humano, rompe la grilla ── */}
          <div
            className="hp-hero-aside"
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
          >
            <div className="hp-hero-tilt" ref={tiltRef}>
              <figure className="hp-hero-photo">
                <img
                  src={agustinHero}
                  alt="Agustín Elías Sosa, tu profesor particular"
                  className="hp-hero-photo-img"
                  width="800"
                  height="1069"
                />
                <figcaption className="hp-hero-photo-tag">
                  <strong>Agustín Elías Sosa</strong>
                  <span>Tu profesor de confianza</span>
                </figcaption>
              </figure>

              <span className="hp-hero-float hp-hero-float--a" aria-hidden="true">
                <FaRegClock aria-hidden="true" /> Reservás en 1 minuto
              </span>
            </div>
          </div>
        </div>

        {/* ── Ticker de materias: cinta infinita al pie del hero ── */}
        <div className="hp-hero-ticker" aria-hidden="true">
          <div className="hp-ticker-track">
            {[0, 1].map((pass) => (
              <span className="hp-ticker-run" key={pass}>
                {HERO_TICKER.map((s) => {
                  const Icon = getSubjectIcon(s);
                  return (
                    <span className="hp-ticker-item" key={`${pass}-${s}`}>
                      <Icon aria-hidden="true" />
                      {s}
                    </span>
                  );
                })}
              </span>
            ))}
          </div>
        </div>
        <p className="sr-only">
          Materias: {HERO_TICKER.join(", ")}. Y muchas otras a consultar.
        </p>
      </section>

      {/* ════════════════════════════════════════
          CÓMO RESERVAR — recreación en vivo del kiosco
      ════════════════════════════════════════ */}
      <BookingStepsShowcase />

      {/* ════════════════════════════════════════
          QUIÉN ES AGUSTÍN (presentación temprana, tras mostrar lo fácil que es)
      ════════════════════════════════════════ */}
      <AboutAgustin />

      {/* ════════════════════════════════════════
          MATERIAS — índice editorial

          Antes eran 5 flip-cards cuadradas: gimmick, hostil al touch, y el copy
          más potente (el tagline + hook) quedaba ESCONDIDO detrás del giro. Acá
          es un índice tipo revista — el copy que vende está siempre a la vista,
          cada fila es un link directo a reservar, y numera igual que el resto.
      ════════════════════════════════════════ */}
      <section className="hp-section" aria-labelledby="hp-subjects-title">
        <div className="hp-section-inner">
          <SectionHead
            index="04"
            kicker="Reconocés tu situación acá"
            title="Materias principales"
            titleId="hp-subjects-title"
            lead="Los temas que más complican, dichos sin vueltas. Tocá el tuyo y llegás a la reserva con la materia ya elegida."
          />

          <ol
            className="hp-subject-index"
            aria-label="Materias principales"
            data-reveal-group="70"
          >
            {SUBJECTS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.label} className="hp-subj-row" data-reveal="up">
                  <Link
                    to={`/reservar?materia=${encodeURIComponent(s.param)}`}
                    className="hp-subj-link"
                    style={{ "--subject-color": s.color, "--subject-ink": s.ink }}
                    aria-label={`Reservar clase de ${s.label}`}
                    onMouseMove={(e) => {
                      if (
                        window.matchMedia?.("(prefers-reduced-motion: reduce)")
                          ?.matches
                      )
                        return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const lx =
                        (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
                      e.currentTarget.style.setProperty(
                        "--row-lean",
                        lx.toFixed(3),
                      );
                    }}
                    onMouseLeave={(e) =>
                      e.currentTarget.style.setProperty("--row-lean", "0")
                    }
                  >
                    <span className="hp-subj-num" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="hp-subj-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className="hp-subj-copy">
                      <span className="hp-subj-name">{s.label}</span>
                      <span className="hp-subj-tagline">
                        <b>{s.tagline}</b> {s.hook}
                      </span>
                    </span>
                    <span className="hp-subj-go">
                      Reservar
                      <FaArrowRight aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {/* Banner "más materias" */}
          <div className="hp-more-subjects" data-reveal="up">
            <div className="hp-more-subjects-inner">
              <span className="hp-more-subjects-icon" aria-hidden="true">
                <FaBookOpen />
              </span>
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
          <SectionHead
            index="05"
            kicker="Lo que hace la diferencia"
            title="Por qué esto funciona cuando lo otro no"
            titleId="hp-reasons-title"
            lead="Estudiar más no siempre es la solución. A veces alcanza con una sola clase bien enfocada para que todo lo que veías borroso de repente tenga sentido."
          />

          <ul className="hp-reasons-grid" role="list" data-reveal-group="80">
            {REASONS.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.title} className="hp-reason-card" data-reveal="up">
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
        <div className="hp-section-inner">
          <SectionHead
            index="06"
            kicker="Sin importar dónde estés"
            title="Todos los niveles"
            titleId="hp-levels-title"
            lead={'No hay nivel "demasiado básico" ni "demasiado avanzado". Elegí el tuyo y el formulario de reserva ya lo va a tener marcado.'}
          />
          <p className="hp-levels-hint" data-reveal="up">
            Tocá tu nivel para reservar directamente
          </p>
          <ul className="hp-levels" role="list" data-reveal-group="70">
            {LEVELS.map((l) => {
              const LevelIcon = l.icon;
              return (
              <li key={l.label} data-reveal="up">
                <Link
                  to={`/reservar?nivel=${encodeURIComponent(LEVEL_FORM_MAP[l.label])}`}
                  className="hp-level-card"
                  aria-label={`Reservar clase de nivel ${l.label}`}
                >
                  <span className="hp-level-icon" aria-hidden="true">
                    <LevelIcon />
                  </span>
                  <span className="hp-level-label">{l.label}</span>
                  <span className="hp-level-desc">{l.desc}</span>
                  <span className="hp-level-cta">Reservar →</span>
                </Link>
              </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FAQ
      ════════════════════════════════════════ */}
      <FaqSection />

      {/* ════════════════════════════════════════
          CTA FINAL + web principal
      ════════════════════════════════════════ */}
      <section className="hp-cta-section" aria-label="Reservá tu turno">
        <div className="hp-cta-bg" aria-hidden="true">
          <span className="hp-grid" />
        </div>

        <div className="hp-cta-inner" data-reveal-group="110">
          <ThemeLogo
            variant="monogram"
            imgClassName="hp-cta-monogram"
            alt=""
            aria-hidden="true"
            data-reveal="scale"
          />

          <h2 className="hp-cta-h2" data-reveal="clip">
            El parcial no espera.<br />
            <span className="hp-cta-h2-accent">Empezá hoy.</span>
          </h2>
          <p className="hp-cta-p" data-reveal="up">
            La primera clase es de diagnóstico: entendemos dónde estás y qué necesitás.<br />
            Sin pagos por adelantado. Sin compromiso. Solo una hora que puede cambiar todo.
          </p>

          <div className="hp-cta-actions" data-reveal="up">
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

          <p className="hp-cta-location" data-reveal="up">
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
