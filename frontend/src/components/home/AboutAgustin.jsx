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
  { value: "+8", label: "años acompañando alumnos" },
  { value: "5+", label: "materias principales, y más a consultar" },
  { value: "Todos", label: "los niveles, de primaria a universitario" },
];

const AboutAgustin = () => (
  <section className="hp-section" aria-labelledby="hp-about-title">
    <div className="hp-section-inner">
      <SectionHead
        index="06"
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
                <dt className="hp-about-stat-value">{s.value}</dt>
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
              href="https://wa.me/5491164236675?text=Hola%20Agust%C3%ADn,%20quiero%20hacerte%20una%20consulta."
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
