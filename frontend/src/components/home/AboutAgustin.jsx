import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowRight, FaWhatsapp } from "react-icons/fa";
import SectionHead from "./SectionHead";
import Magnetic from "../ui/Magnetic";
import agustinPhoto from "../../assets/images/agustin-hero.webp";
import "./AboutAgustin.css";

/* "Quién es Agustín". Contenido real: materias y niveles salen del propio sitio,
   el enfoque es el mensaje central de la marca, y los +8 años los confirmó
   Agustín. Sin título/credenciales inventadas (no fue parte de lo elegido). */
const STATS = [
  { value: "+8", count: 8, prefix: "+", label: "años acompañando alumnos" },
  { value: "5+", count: 5, suffix: "+", label: "materias principales, y más a consultar" },
  { value: "Todos", label: "los niveles, de primaria a universitario" },
];

/* Contador que sube al entrar en pantalla. Sólo para los stats numéricos; los
   de texto ("Todos") se muestran tal cual. Respeta reduced-motion (muestra el
   número final de una) y corre una sola vez. */
const skipCountUp = () =>
  typeof window === "undefined" ||
  typeof IntersectionObserver === "undefined" ||
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);

const CountUp = ({ target, prefix = "", suffix = "", duration = 1100 }) => {
  const ref = useRef(null);
  // Estado inicial perezoso: sin animación (reduced-motion o sin observer) el
  // número ya arranca en su valor final, sin setState dentro del efecto.
  const [shown, setShown] = useState(() => (skipCountUp() ? target : 0));

  useEffect(() => {
    const el = ref.current;
    if (!el || skipCountUp()) return undefined;

    let raf = 0;
    let start = 0;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      // easing expo-out: arranca rápido y asienta suave
      setShown(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          raf = requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);

    // Red de seguridad: si el observer no dispara, mostrar el valor final.
    const fallback = window.setTimeout(() => setShown(target), 2500);

    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [target, duration]);

  return (
    <span ref={ref}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
};

const AboutAgustin = () => (
  <section className="hp-section" aria-labelledby="hp-about-title">
    <div className="hp-section-inner">
      <SectionHead
        index="03"
        kicker="Tu profesor"
        title="Quién es Agustín"
        titleId="hp-about-title"
        lead="No le reservás a una app: le reservás a una persona que se sienta con vos hasta que el tema hace clic."
      />

      <div className="hp-about-grid">
        <figure className="hp-about-photo" data-reveal="right">
          <img
            src={agustinPhoto}
            alt="Agustín Elías Sosa dando clases particulares"
            className="hp-about-photo-img"
            width="800"
            height="1069"
            loading="lazy"
          />
        </figure>

        <div className="hp-about-copy">
          <p className="hp-about-bio" data-reveal="up">
            Doy clases particulares de Matemáticas, Física, Fisicoquímica,
            Química e Inglés, entre otras. Hace más de 8 años acompaño a
            estudiantes de primaria, secundaria, secundaria técnica y
            universitario. Mi forma de enseñar es simple: que{" "}
            <b>entiendas de verdad, no que memorices para zafar.</b> Cada clase
            tiene orden, cercanía y un plan pensado para vos.
          </p>

          <dl className="hp-about-stats" data-reveal="up">
            {STATS.map((s) => (
              <div key={s.label} className="hp-about-stat">
                <dt className="hp-about-stat-value">
                  {s.count ? (
                    <CountUp
                      target={s.count}
                      prefix={s.prefix}
                      suffix={s.suffix}
                    />
                  ) : (
                    s.value
                  )}
                </dt>
                <dd className="hp-about-stat-label">{s.label}</dd>
              </div>
            ))}
          </dl>

          <div className="hp-about-ctas" data-reveal="up">
            <Magnetic strength={0.35}>
              <Link to="/reservar" className="hp-cta-main">
                Reservar una clase conmigo
                <FaArrowRight className="hp-cta-arrow" aria-hidden="true" />
              </Link>
            </Magnetic>
            <a
              href="https://wa.me/5491133365937?text=Hola%20Agust%C3%ADn,%20quiero%20hacerte%20una%20consulta."
              className="hp-about-wp"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Hacerle una consulta
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default AboutAgustin;
