import { METHOD } from "../data/site.js";
import "./MethodSteps.css";

/* Los cuatro pasos del método, en composición editorial: número display grande a
   la izquierda, contenido a la derecha, separados por hairlines. Se eligió esta
   forma en lugar de tarjetas porque el Inicio ya encadena dos grillas de cajas y
   sumar una tercera lo volvía monótono.

   DOS MODOS, Y POR QUÉ
   El método estaba COMPLETO en el Inicio y en /como-trabajo: los mismos cuatro
   párrafos, carácter por carácter, en dos URLs. Google trata eso como contenido
   duplicado y tiene que elegir cuál indexar, así que las dos páginas compiten
   entre sí en lugar de sumar.

   Ahora /como-trabajo es la dueña del texto completo —es su razón de existir— y el
   Inicio muestra solo los títulos con un enlace para leerlo entero. No hay texto
   nuevo: son los mismos datos de METHOD, mostrando menos.

   `compacto` y no dos componentes: el orden, la numeración y los títulos tienen
   que ser los mismos en los dos lugares, y con dos archivos eso se desincroniza
   en el primer cambio. */
const MethodSteps = ({ compacto = false }) => (
  <ol
    className={`ms-list ${compacto ? "ms-list--compacto" : ""}`.trim()}
    data-reveal-group="110"
  >
    {METHOD.map((step) => (
      <li key={step.index} className="ms-step" data-reveal="up">
        <span className="ms-index" aria-hidden="true">
          {step.index}
        </span>
        <div className="ms-body">
          <h3 className="display display--md ms-title">{step.title}</h3>
          {!compacto && <p className="ms-desc">{step.desc}</p>}
        </div>
      </li>
    ))}
  </ol>
);

export default MethodSteps;
