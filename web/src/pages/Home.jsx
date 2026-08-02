import { Link } from "react-router-dom";
import {
  FaArrowRight,
  FaArrowUpRightFromSquare,
  FaCheck,
  FaWhatsapp,
} from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import Typewriter from "../components/Typewriter.jsx";
import MathBackdrop from "../components/MathBackdrop.jsx";
import Credentials from "../components/Credentials.jsx";
import PullQuote from "../components/PullQuote.jsx";
import MethodSteps from "../components/MethodSteps.jsx";
import FaqList from "../components/FaqList.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import {
  BOOKING_RESERVE_URL,
  BRAND,
  CONTACT,
  LEVELS,
  REASONS,
  SUBJECTS,
  waLink,
} from "../data/site.js";
import agustin from "../assets/agustin.webp";
import "./Home.css";

const Home = () => {
  usePageMeta(
    "Tu Profesor Particular · Agustín Elías Sosa | Clases particulares en Temperley y online",
    "Clases particulares de Matemáticas, Física, Fisicoquímica, Química e Inglés. Online y presenciales en Temperley. Desde primaria hasta universitario, sin pagos por adelantado.",
    { path: "/" },
);

  return (
    <>
      {/* ── Hero ── */}
      <section className="section--dark hero" aria-label="Presentación">
        <MathBackdrop />
        <span className="hero-slab" aria-hidden="true" />

        <div className="shell hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow" data-reveal="up">
              <span className="hero-dot" aria-hidden="true" />
              Online y presencial
              <span className="hero-sep" aria-hidden="true" />
              {CONTACT.addressLine}
            </p>

            {/* La frase que el visitante ya pensó, escribiéndose sola: primero
                que se reconozca, después la promesa. */}
            <p className="hero-pain" data-reveal="up">
              <span className="hero-pain-quote" aria-hidden="true">
                «
              </span>
              No entiendo nada de{" "}
              <Typewriter
                className="hero-pain-word"
                words={[
                  "Matemáticas",
                  "Física",
                  "Química",
                  "Análisis Matemático",
                  "Fisicoquímica",
                ]}
              />
              <span className="hero-pain-quote" aria-hidden="true">
                »
              </span>
            </p>

            {/* El {" "} antes del <br> no es decorativo: un <br> corta la línea
                pero no aporta espacio al texto, así que el título se leía
                "Entendé de verdad,no de memoria" —así lo dicta un lector de
                pantalla y así lo indexa Google—. El salto visual no cambia. */}
            <h1 className="display display--xl hero-title" data-reveal="clip">
              Entendé de verdad,{" "}
              <br />
              <em>no de memoria</em>
            </h1>

            <p className="hero-tagline" data-reveal="up">
              <span>Juntos,</span> despejando el camino a{" "}
              <em>la meta.</em>
            </p>

            <p className="lead hero-lead" data-reveal="up">
              Soy {BRAND.person}. Hace más de {BRAND.yearsTeaching} años doy
              clases particulares a estudiantes de primaria, secundaria,
              terciario y universitario. Si estudiás y el resultado no cambia,
              probablemente el problema no seas vos.
            </p>

            <div className="hero-actions" data-reveal="up">
              <a
                className="btn btn--primary"
                href={BOOKING_RESERVE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Reservar mi clase
                <FaArrowUpRightFromSquare aria-hidden="true" />
              </a>
              <Link className="btn btn--ghost" to="/como-trabajo">
                Ver cómo trabajo
                <FaArrowRight aria-hidden="true" />
              </Link>
            </div>

            <ul className="hero-trust" data-reveal="up">
              <li>
                <FaCheck aria-hidden="true" /> Sin pagos por adelantado
              </li>
              <li>
                <FaCheck aria-hidden="true" /> Primera clase de diagnóstico
              </li>
              <li>
                <FaCheck aria-hidden="true" /> Reservás en menos de un minuto
              </li>
            </ul>
          </div>

          <figure className="hero-photo" data-reveal="up">
            <img
              src={agustin}
              alt={`${BRAND.person}, profesor particular`}
              width="800"
              height="1069"
            />
            <figcaption>
              <strong>{BRAND.person}</strong>
              <span>Tu profesor de confianza</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Autoridad en números, apenas termina el hero. */}
      <Credentials />

      {/* ── Materias ── */}
      <section className="section" aria-labelledby="home-subjects">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Reconocés tu situación acá"
            title="Materias principales"
            titleId="home-subjects"
            lead="Los temas que más complican, dichos sin vueltas. Y muchas otras materias a consultar."
          />

          <ol className="subj-list" data-reveal-group="70">
            {SUBJECTS.map((s, i) => (
              <li key={s.slug} data-reveal="up">
                <Link
                  to="/materias"
                  className="subj-row"
                  style={{ "--subject-color": s.color }}
                >
                  <span className="subj-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="subj-copy">
                    <span className="display display--md subj-name">
                      {s.label}
                    </span>
                    <span className="subj-tagline">
                      <b>{s.tagline}</b> {s.hook}
                    </span>
                  </span>
                  <FaArrowRight className="subj-arrow" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>

          <p className="subj-more" data-reveal="up">
            ¿No ves tu materia?{" "}
            <a
              href={waLink(
                "Hola Agustín, necesito ayuda con una materia que no veo en tu sitio. ¿Me podés ayudar?",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" /> Escribime y lo vemos juntos
            </a>
          </p>
        </div>
      </section>

      {/* Corte tipográfico: rompe la cadena de grillas y da aire. */}
      <PullQuote />

      {/* ── Cómo trabajo ── */}
      <section className="section" aria-labelledby="home-method">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Cómo trabajo"
            title="Un método, no improvisación"
            titleId="home-method"
            lead="Cuatro pasos que se repiten con cada alumno, porque funcionan: entender el punto de partida, planificar, explicar hasta que cierre y medir el avance."
          />
          <MethodSteps />
        </div>
      </section>

      {/* ── Niveles ── */}
      <section className="section section--soft" aria-labelledby="home-levels">
        <div className="shell">
          <SectionHead
            index="03"
            kicker="Sin importar dónde estés"
            title="Todos los niveles"
            titleId="home-levels"
            lead='No hay nivel "demasiado básico" ni "demasiado avanzado". Se arranca desde donde estás vos.'
          />

          {/* Lista editorial en lugar de grilla: la sección anterior y la
              siguiente ya usan cajas, y tres grillas seguidas cansan. */}
          <ol className="lvl-list" data-reveal-group="70">
            {LEVELS.map((l, i) => (
              <li key={l.label} data-reveal="up">
                <span className="lvl-num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="display display--md lvl-name">{l.label}</h3>
                <p className="lvl-desc">{l.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Por qué ── */}
      <section className="section" aria-labelledby="home-why">
        <div className="shell">
          <SectionHead
            index="04"
            kicker="Lo que hace la diferencia"
            title="Por qué esto funciona cuando lo otro no"
            titleId="home-why"
            lead="A veces alcanza con una clase bien enfocada para que todo lo que veías borroso tenga sentido. Estas son las condiciones con las que trabajo siempre."
          />

          <ul className="why-grid" data-reveal-group="80">
            {REASONS.map((r) => (
              <li key={r.title} className="why-card" data-reveal="up">
                <h3 className="why-title">{r.title}</h3>
                <p className="why-desc">{r.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Preguntas ── cierra las dudas antes del CTA final. */}
      <section className="section section--soft" aria-labelledby="home-faq">
        <div className="shell">
          <SectionHead
            index="05"
            kicker="Antes de reservar"
            title="Preguntas frecuentes"
            titleId="home-faq"
            lead="Lo que casi todos quieren saber antes de la primera clase."
          />
          <FaqList />
        </div>
      </section>

      <CtaBlock />
    </>
  );
};

export default Home;
