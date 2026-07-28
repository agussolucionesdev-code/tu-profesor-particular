/**
 * Encabezado editorial numerado, compartido por todas las secciones del sitio.
 * Mismo sistema que la app de turnos: hairline, índice, antetítulo en
 * versalitas, titular en serif y bajada en columna aparte.
 */
const SectionHead = ({ index, kicker, title, titleId, lead }) => (
  <header className="head">
    <div className="head-rule" data-reveal="up" aria-hidden="true" />
    <p className="head-meta" data-reveal="up">
      <span className="head-index">{index}</span>
      <span className="head-dash" aria-hidden="true" />
      <span className="head-kicker">{kicker}</span>
    </p>
    <div className="head-body">
      <h2 id={titleId} className="display display--lg" data-reveal="clip">
        {title}
      </h2>
      {lead && (
        <p className="lead" data-reveal="up">
          {lead}
        </p>
      )}
    </div>
  </header>
);

export default SectionHead;
