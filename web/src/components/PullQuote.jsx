import "./PullQuote.css";

/* Momento de respiro tipográfico entre secciones. El Inicio venía encadenando
   grillas de tarjetas: esta banda corta esa monotonía con una sola idea a
   escala grande, sin ilustraciones ni degradados. El peso lo hace la letra.

   El texto es la frase de marca — no una promesa nueva. */
const PullQuote = () => (
  <section className="pq section--dark" aria-label="Nuestra manera de trabajar">
    <span className="pq-rule" aria-hidden="true" />

    <div className="shell pq-inner">
      <p className="pq-mark" aria-hidden="true">
        “
      </p>

      <blockquote className="pq-quote">
        <p className="display">
          Estudiar más no es la solución.
          <br />
          <em>Entender de una vez, sí.</em>
        </p>
      </blockquote>

      <p className="pq-attr">
        <span className="pq-line" aria-hidden="true" />
        La idea detrás de cada clase
      </p>
    </div>
  </section>
);

export default PullQuote;
