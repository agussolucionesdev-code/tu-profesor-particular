import { BRAND } from "../data/site.js";
import "./Credentials.css";

/* Franja de datos, justo después del hero. Contesta las cuatro preguntas que
   una familia se hace antes de seguir leyendo: qué materias, para qué nivel,
   dónde y con cuánta experiencia.

   Antes eran cuatro números que contaban desde cero al aparecer («5+
   materias», «2 modalidades»). Se leían como indicadores de éxito sin serlo,
   y dos estaban mal: el «+» de las materias sobraba y los niveles dejaban
   afuera CENS. Lo cuida tests/franjaQueInforma.test.js. */
const ITEMS = [
  {
    label: "Materias",
    value: "Matemáticas, Física, Fisicoquímica, Química e Inglés",
  },
  {
    label: "Niveles",
    value: "Primaria, secundaria, técnica, CENS, terciario y universitario",
  },
  {
    label: "Modalidad",
    value: "Online para toda Argentina o presencial en Temperley",
  },
  {
    label: "Experiencia",
    value: `${BRAND.yearsTeaching} años dando clases particulares`,
  },
];

const Credentials = () => (
  <section className="creds" aria-label="En pocas palabras">
    <div className="shell">
      {/* <dl>: cada ítem es un par nombre-valor, que es exactamente lo que un
          lector de pantalla anuncia con una lista de definiciones. La etiqueta
          NO es un encabezado: cuatro <h3> encabezarían el índice del documento
          por delante de las secciones reales. */}
      <dl className="creds-grid" data-reveal-group="90">
        {ITEMS.map((item) => (
          <div key={item.label} data-reveal="up">
            <dt className="creds-label">{item.label}</dt>
            <dd className="creds-value">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  </section>
);

export default Credentials;
