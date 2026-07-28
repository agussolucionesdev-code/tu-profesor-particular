import SectionHead from "../components/SectionHead.jsx";
import CtaBlock from "../components/CtaBlock.jsx";
import usePageMeta from "../hooks/usePageMeta.js";
import { FAQS, METHOD } from "../data/site.js";
import "./Inner.css";

const Method = () => {
  usePageMeta(
    "Cómo trabajo · Tu Profesor Particular",
    "Primera clase de diagnóstico, plan concreto, clases con orden y seguimiento del avance. Así se trabaja en Tu Profesor Particular.",
  );

  return (
    <>
      <section className="section pagehead" aria-labelledby="method-title">
        <div className="shell">
          <SectionHead
            index="01"
            kicker="Cómo trabajo"
            title="Un método, no improvisación"
            titleId="method-title"
            lead="Cuatro pasos que se repiten con cada alumno, porque funcionan: entender el punto de partida, planificar, explicar hasta que cierre y medir el avance."
          />

          <ol className="method-list" data-reveal-group="90">
            {METHOD.map((step) => (
              <li key={step.index} className="method-step" data-reveal="up">
                <span className="method-index" aria-hidden="true">
                  {step.index}
                </span>
                <div className="method-copy">
                  <h3 className="display display--md">{step.title}</h3>
                  <p>{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section section--soft" aria-labelledby="method-faq">
        <div className="shell">
          <SectionHead
            index="02"
            kicker="Antes de reservar"
            title="Preguntas frecuentes"
            titleId="method-faq"
            lead="Lo que casi todos quieren saber antes de la primera clase."
          />

          <ul className="faq-list" data-reveal-group="60">
            {FAQS.map((item) => (
              <li key={item.q} data-reveal="up">
                <details className="faq-item">
                  <summary>
                    <span>{item.q}</span>
                    <span className="faq-plus" aria-hidden="true" />
                  </summary>
                  <div className="faq-answer">
                    <p>{item.a}</p>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBlock
        title={
          <>
            Ya sabés cómo trabajo.
            <br />
            <em>Probemos una clase.</em>
          </>
        }
      />
    </>
  );
};

export default Method;
