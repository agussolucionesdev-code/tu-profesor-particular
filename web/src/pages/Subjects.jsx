import { FaArrowUpRightFromSquare, FaWhatsapp } from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BOOKING_RESERVE_URL, LEVELS, SUBJECTS, waLink } from "../data/site.js";
import "./Inner.css";

const Subjects = () => {
  usePageMeta(
    "Materias y niveles · Tu Profesor Particular",
    "Matemáticas, Física, Fisicoquímica, Química e Inglés, y más materias a consultar. Desde primaria hasta universitario, incluida secundaria técnica.",
  );

  return (
    <>
      <section className="section pagehead" aria-labelledby="subj-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Qué doy"
            title="Materias principales"
            titleId="subj-title"
            lead="Estas son las que más piden. Doy varias más: si la tuya no está, escribime y lo vemos."
          />

          <ul className="subj-cards" data-reveal-group="80">
            {SUBJECTS.map((s) => (
              <li
                key={s.slug}
                className="subj-card"
                style={{ "--subject-color": s.color }}
                data-reveal="up"
              >
                <h3 className="display display--md subj-card-name">{s.label}</h3>
                <p className="subj-card-claim">
                  <b>{s.tagline}</b> {s.hook}
                </p>
                <p className="subj-card-detail">{s.detail}</p>
                <a
                  className="subj-card-cta"
                  href={`${BOOKING_RESERVE_URL}?materia=${encodeURIComponent(s.label)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Reservar {s.label}
                  <FaArrowUpRightFromSquare aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>

          <div className="subj-extra" data-reveal="up">
            <h3>Doy muchas más materias</h3>
            <p>
              Análisis Matemático, Álgebra, Biología, Historia y otras según el
              plan de estudios. Si la tuya no aparece, contame qué necesitás y
              te digo de entrada si puedo ayudarte.
            </p>
            <a
              className="btn btn--primary"
              href={waLink(
                "Hola Agustín, necesito ayuda con una materia que no veo en tu sitio. ¿Me podés ayudar?",
              )}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaWhatsapp aria-hidden="true" />
              Consultar por mi materia
            </a>
          </div>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="subj-levels">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Sin importar dónde estés"
            title="Todos los niveles"
            titleId="subj-levels"
            lead='No hay nivel "demasiado básico" ni "demasiado avanzado". Se arranca desde tu punto real.'
          />
          <ul className="plain-grid" data-reveal-group="70">
            {LEVELS.map((l) => (
              <li key={l.label} data-reveal="up">
                <h3>{l.label}</h3>
                <p>{l.desc}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBlock />
    </>
  );
};

export default Subjects;
