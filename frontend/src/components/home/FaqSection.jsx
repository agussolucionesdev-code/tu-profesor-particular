import { FaPlus } from "react-icons/fa";
import SectionHead from "./SectionHead";
import "./FaqSection.css";
import { FAQS } from "../../constants/preguntasFrecuentes";

/* Acordeón nativo <details>/<summary>: accesible por teclado sin JS. */
const FaqSection = () => (
  <section className="hp-section hp-section--soft" aria-labelledby="hp-faq-title">
    <div className="hp-section-inner">
      <SectionHead
        index="07"
        kicker="Antes de reservar"
        title="Preguntas frecuentes"
        titleId="hp-faq-title"
        lead="Lo que casi todos quieren saber antes de la primera clase. Si te queda una duda, escribime y la resolvemos."
      />

      <ul className="hp-faq-list" data-reveal-group="70">
        {FAQS.map((item) => (
          <li key={item.q} className="hp-faq-item" data-reveal="up">
            <details className="hp-faq-details">
              <summary className="hp-faq-q">
                <span>{item.q}</span>
                <span className="hp-faq-icon" aria-hidden="true">
                  <FaPlus />
                </span>
              </summary>
              {/* El wrapper con grid-template-rows 0fr→1fr permite animar la
                  altura real del contenido sin conocerla de antemano. */}
              <div className="hp-faq-wrap">
                <p className="hp-faq-a">{item.a}</p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FaqSection;
