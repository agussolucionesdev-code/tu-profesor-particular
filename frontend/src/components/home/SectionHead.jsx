import "./SectionHead.css";

/**
 * Encabezado editorial compartido por todas las secciones del Inicio.
 *
 * El índice continúa la numeración que abre el hero (01), así la página
 * se lee como una secuencia y no como bloques sueltos.
 *
 * @param {string}  index   Índice de dos dígitos ("02", "03", ...).
 * @param {string}  kicker  Antetítulo corto, se muestra en versalitas.
 * @param {string}  title   Titular de la sección.
 * @param {string}  titleId id del <h2>, para el aria-labelledby de la <section>.
 * @param {string}  [lead]  Bajada opcional, va en la columna derecha.
 * @param {boolean} [light] true sobre fondos navy.
 */
const SectionHead = ({ index, kicker, title, titleId, lead, light = false }) => (
  <header className={`sh${light ? " sh--light" : ""}`}>
    <div className="sh-rule" aria-hidden="true" />

    <p className="sh-meta">
      <span className="sh-index">{index}</span>
      <span className="sh-dash" aria-hidden="true" />
      <span className="sh-kicker">{kicker}</span>
    </p>

    <div className="sh-body">
      <h2 id={titleId} className="sh-title">
        {title}
      </h2>
      {lead && <p className="sh-lead">{lead}</p>}
    </div>
  </header>
);

export default SectionHead;
