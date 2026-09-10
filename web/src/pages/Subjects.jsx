import { FaArrowUpRightFromSquare, FaWhatsapp } from "react-icons/fa6";
import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { BOOKING_RESERVE_URL, LEVELS, SUBJECTS, waLink } from "../data/site.js";
import "./Inner.css";

const Subjects = () => {
  usePageMeta("/materias");

  return (
    <>
      <section className="section pagehead" aria-labelledby="subj-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Qué doy"
            title="Materias principales"
            titleId="subj-title"
            as="h1"
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
                {/* h2 y no h3: el encabezado de esta sección ES el h1 de la
                    página (SectionHead con as="h1"), así que sus hijos directos
                    son de segundo nivel. Con h3 quedaba un salto h1→h3, que en
                    un lector de pantalla se lee como si faltara contenido. */}
                <h2 className="display display--md subj-card-name">{s.label}</h2>
                <p className="subj-card-claim">
                  <b>{s.tagline}</b> {s.hook}
                </p>
                <p className="subj-card-detail">{s.detail}</p>
                <a
                  className="subj-card-cta"
                  /* `bookingParam` y NO `label`: el kiosco llama a la materia
                     "Matemática" y acá el título dice "Matemáticas". Mandar el
                     plural dejaba la tarjeta sin preseleccionar y —lo caro— la
                     clase cotizada a la tarifa base. Ver `site.js`. */
                  href={`${BOOKING_RESERVE_URL}?materia=${encodeURIComponent(s.bookingParam)}`}
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
            {/* h2 por el mismo motivo que las tarjetas: sigue colgando del h1.
                Los niveles de la sección 02, en cambio, sí van en h3, porque esa
                sección tiene su propio h2. */}
            <h2>Doy muchas más materias</h2>
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
