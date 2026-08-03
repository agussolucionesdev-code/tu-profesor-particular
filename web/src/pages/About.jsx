import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BRAND, CONTACT, REASONS } from "../data/site.js";
import agustin from "../assets/agustin.webp";
import "./Inner.css";

const About = () => {
  usePageMeta("/sobre-mi");

  return (
    <>
      <section className="section pagehead" aria-labelledby="about-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Sobre mí"
            title="Quién es Agustín"
            titleId="about-title"
            as="h1"
            lead="No le reservás a una app: le reservás a una persona que se sienta con vos hasta que el tema hace clic."
          />

          <div className="about-grid">
            <figure className="about-photo" data-reveal="up">
              <img
                src={agustin}
                alt={`${BRAND.person} dando clases particulares`}
                width="800"
                height="1069"
                loading="lazy"
              />
            </figure>

            <div className="about-copy">
              <p className="about-bio" data-reveal="up">
                Soy {BRAND.person} y hace más de{" "}
                <b>{BRAND.yearsTeaching} años</b> doy clases particulares.
                Acompaño a estudiantes de primaria, secundaria, secundaria
                técnica, terciario y universitario en Matemáticas, Física,
                Fisicoquímica, Química e Inglés, entre otras materias.
              </p>
              <p className="about-bio" data-reveal="up">
                Mi forma de enseñar es simple: que{" "}
                <b>entiendas de verdad, no que memorices para zafar.</b> La
                mayoría de los que llegan no tienen un problema de capacidad;
                tienen un tema anterior que quedó flojo y nadie se detuvo a
                revisarlo. Ahí empezamos.
              </p>
              <p className="about-bio" data-reveal="up">
                Doy clases <b>online</b> por videollamada y{" "}
                <b>presenciales</b> en {CONTACT.addressLine}. Cada clase tiene
                orden, cercanía y un plan pensado para vos.
              </p>

              <dl className="about-stats" data-reveal="up">
                <div>
                  <dt>+{BRAND.yearsTeaching}</dt>
                  <dd>años acompañando alumnos</dd>
                </div>
                <div>
                  <dt>5+</dt>
                  <dd>materias principales, y más a consultar</dd>
                </div>
                <div>
                  <dt>Todos</dt>
                  <dd>los niveles, de primaria a universitario</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="about-why">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Cómo es trabajar conmigo"
            title="Lo que podés esperar"
            titleId="about-why"
            lead="Nada de letra chica: estas son las condiciones con las que trabajo siempre."
          />
          <ul className="plain-grid" data-reveal-group="80">
            {REASONS.map((r) => (
              <li key={r.title} data-reveal="up">
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBlock
        title={
          <>
            Empecemos por una clase.
            <br />
            <em>Sin compromiso.</em>
          </>
        }
      />
    </>
  );
};

export default About;
