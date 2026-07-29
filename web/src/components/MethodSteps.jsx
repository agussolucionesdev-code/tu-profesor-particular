import { METHOD } from "../data/site.js";
import "./MethodSteps.css";

/* Los cuatro pasos del método, en composición editorial: número display
   grande a la izquierda, contenido a la derecha, separados por hairlines.
   Se eligió esta forma en lugar de tarjetas porque el Inicio ya encadena dos
   grillas de cajas y sumar una tercera lo volvía monótono.

   Componente compartido: lo usan el Inicio y /como-trabajo, así el método se
   cuenta igual en los dos lugares. */
const MethodSteps = () => (
  <ol className="ms-list" data-reveal-group="110">
    {METHOD.map((step) => (
      <li key={step.index} className="ms-step" data-reveal="up">
        <span className="ms-index" aria-hidden="true">
          {step.index}
        </span>
        <div className="ms-body">
          <h3 className="display display--md ms-title">{step.title}</h3>
          <p className="ms-desc">{step.desc}</p>
        </div>
      </li>
    ))}
  </ol>
);

export default MethodSteps;
