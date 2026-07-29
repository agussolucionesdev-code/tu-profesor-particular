import { FAQS } from "../data/site.js";
import "./FaqList.css";

/* Acordeón de preguntas frecuentes, compartido por el Inicio y /como-trabajo.
   Usa <details>/<summary> nativos: funcionan sin JavaScript, son accesibles por
   teclado de fábrica y los buscadores leen el contenido aunque esté cerrado. */
const FaqList = ({ limit }) => {
  const items = limit ? FAQS.slice(0, limit) : FAQS;

  return (
    <ul className="fq-list" data-reveal-group="60">
      {items.map((item) => (
        <li key={item.q} data-reveal="up">
          <details className="fq-item">
            <summary>
              <span className="fq-q">{item.q}</span>
              <span className="fq-plus" aria-hidden="true" />
            </summary>
            <div className="fq-answer">
              <p>{item.a}</p>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
};

export default FaqList;
